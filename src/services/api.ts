import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { demoApi } from './demoApi';
import { addDays } from 'date-fns';
import { localDayKey } from '../domain/dates';
import { datosOcurrencia, recurrenceFrom, routineOccursOn } from '../domain/routines';
import {
  Area, Entrada, EstadoEntrada, Item, ItemInput, ItemPaso, Objetivo, Perfil, Recurrencia, Rutina, RutinaInput, RutinaPaso,
} from '../domain/types';

// Única capa que habla con Supabase: las pantallas no hacen queries directas.
// La seguridad real la dan las políticas RLS (cada fila filtra por
// user_id = auth.uid()); filtrar aquí es una segunda barrera.

export interface Snapshot {
  areas: Area[];
  items: Item[];        // solo pendientes y no eliminados
  entradas: Entrada[];  // las últimas, más nuevas primero
  objetivos: Objetivo[];
  rutinas: Rutina[];
  pasos: RutinaPaso[];      // checklist de todas las rutinas
  itemPasos: ItemPaso[];    // pasos marcados en las ocurrencias pendientes
  hechasSemana: { rutina_id: string; ocurrencia_fecha: string }[]; // para el cumplimiento semanal
  perfil: Perfil | null;
}

// Paso de checklist en el formulario: con id si ya existía
export type PasoInput = { id?: string; texto: string };

export interface ZenApi {
  auth: {
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<unknown>;
    getSession: () => Promise<Session | null>;
    onAuthStateChange: (cb: (session: Session | null) => void) => { unsubscribe: () => void };
  };
  loadAll: () => Promise<Snapshot>;
  createItem: (input: ItemInput & { entrada_id?: string }) => Promise<Item>;
  updateItem: (id: string, patch: ItemInput) => Promise<void>;
  setCompleted: (id: string, done: boolean) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  reprogramar: (item: Item, fechaNueva: string | null, estabaVencida: boolean) => Promise<void>;
  convertToRutina: (item: Item, recurrencia: Recurrencia) => Promise<Rutina>;
  // Rutinas (etapa 3). Después de crear/editar/pausar/eliminar, la app
  // recarga todo: así las ocurrencias y el cumplimiento quedan exactos.
  createRutina: (input: RutinaInput, pasos: PasoInput[]) => Promise<void>;
  updateRutina: (rutina: Rutina, input: RutinaInput, pasos: PasoInput[]) => Promise<void>;
  setRutinaPausada: (id: string, pausada: boolean) => Promise<void>;
  deleteRutina: (id: string) => Promise<void>;
  setPaso: (itemId: string, pasoId: string, hecho: boolean) => Promise<void>;
  createEntrada: (texto: string, origen?: 'texto' | 'voz') => Promise<Entrada>;
  // regla: qué reglas la interpretaron (etapa 2); null al ordenar a mano o al deshacer
  setEntradaEstado: (id: string, estado: EstadoEntrada, regla?: string | null) => Promise<void>;
  createArea: (a: Pick<Area, 'nombre' | 'color' | 'orden'>) => Promise<Area>;
  updateArea: (id: string, patch: Partial<Omit<Area, 'id'>>) => Promise<void>;
  createObjetivo: (titulo: string) => Promise<Objetivo>;
  updateObjetivo: (id: string, patch: Partial<Pick<Objetivo, 'titulo' | 'notas' | 'area_id'>>) => Promise<void>;
  deleteObjetivo: (id: string) => Promise<void>;
  updatePerfil: (patch: Partial<Pick<Perfil, 'username' | 'avatar_url'>>) => Promise<void>;
}

// Mensaje único para "no hay sesión": las pantallas lo detectan con
// isAuthError() para volver al login.
const AUTH_ERROR = 'Usuario no autenticado';
export const isAuthError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return msg === AUTH_ERROR || msg.includes('Auth session missing') || msg.includes('JWT expired');
};

// Id del usuario desde la sesión guardada en el dispositivo, sin viaje de red
const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error(AUTH_ERROR);
  return session.user.id;
};

// Supabase no lanza excepciones: devuelve { data, error }. Esto las lanza.
const must = <T>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

const ITEM_COLS = 'id,tipo,titulo,notas,area_id,fecha,hora_inicio,duracion_min,objetivo_id,rutina_id,ocurrencia_fecha,entrada_id,completada_at,created_at';
const RUTINA_COLS = 'id,titulo,notas,area_id,recurrencia,dias_semana,dia_mes,modo_horario,hora_inicio,duracion_min,rango_inicio,rango_fin,marcable,objetivo_id,pausada_at,created_at';

// Genera (si falta) la ocurrencia de HOY de cada rutina activa. La base
// tiene una restricción única (rutina_id, ocurrencia_fecha): si otro
// dispositivo ya la creó, el insert se ignora en vez de duplicarla.
const generateTodayOccurrences = async (userId: string, rutinas: Rutina[]): Promise<Item[]> => {
  const now = new Date();
  const today = localDayKey(now);
  const rows = rutinas.filter(r => routineOccursOn(r, now)).map(r => ({
    user_id: userId,
    tipo: 'tarea',
    ...datosOcurrencia(r),
    rutina_id: r.id,
    ocurrencia_fecha: today,
    fecha: today,
  }));
  if (rows.length === 0) return [];
  return must(await supabase.from('items')
    .upsert(rows, { onConflict: 'rutina_id,ocurrencia_fecha', ignoreDuplicates: true })
    .select(ITEM_COLS)) as Item[];
};

// "Toda la rutina": las ocurrencias pendientes desde hoy copian los datos
// nuevos de la rutina. Si hoy ya no le toca (cambió de días o se pausó
// sin pasar por aquí), la ocurrencia pendiente de hoy se elimina (lógico);
// si ahora sí le toca y falta, se genera.
const propagarRutina = async (userId: string, rutina: Rutina) => {
  const today = localDayKey();
  must(await supabase.from('items').update(datosOcurrencia(rutina))
    .eq('rutina_id', rutina.id).gte('ocurrencia_fecha', today)
    .is('completada_at', null).is('deleted_at', null));
  if (!routineOccursOn(rutina, new Date())) {
    must(await supabase.from('items').update({ deleted_at: new Date().toISOString() })
      .eq('rutina_id', rutina.id).eq('ocurrencia_fecha', today).is('completada_at', null));
  } else {
    await generateTodayOccurrences(userId, [rutina]);
  }
};

// Guarda la checklist: borra los pasos quitados, actualiza los que siguen
// (texto y orden) e inserta los nuevos. Las marcas de un paso borrado se
// van con él (on delete cascade en item_pasos).
const guardarPasos = async (userId: string, rutinaId: string, pasos: PasoInput[], anteriores: string[]) => {
  const limpios = pasos.map(p => ({ ...p, texto: p.texto.trim() })).filter(p => p.texto);
  const siguen = new Set(limpios.filter(p => p.id).map(p => p.id!));
  const borrar = anteriores.filter(id => !siguen.has(id));
  if (borrar.length) must(await supabase.from('rutina_pasos').delete().in('id', borrar));
  for (const [orden, p] of limpios.entries()) {
    if (p.id) must(await supabase.from('rutina_pasos').update({ texto: p.texto, orden }).eq('id', p.id));
    else must(await supabase.from('rutina_pasos').insert({ user_id: userId, rutina_id: rutinaId, texto: p.texto, orden }));
  }
};

const supabaseApi: ZenApi = {
  auth: {
    signIn: async (email, password) => ({ error: (await supabase.auth.signInWithPassword({ email, password })).error }),
    signUp: async (email, password) => ({ error: (await supabase.auth.signUp({ email, password })).error }),
    signOut: () => supabase.auth.signOut(),
    getSession: async () => (await supabase.auth.getSession()).data.session,
    onAuthStateChange: cb => supabase.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription,
  },

  // Todo en paralelo: una sola espera de red para abrir la app
  loadAll: async () => {
    const uid = await requireUserId();
    const hoy = new Date();
    const lunes = localDayKey(addDays(hoy, -((hoy.getDay() + 6) % 7)));
    const [areas, items, entradas, objetivos, rutinas, pasos, hechas, perfil] = await Promise.all([
      supabase.from('areas').select('id,nombre,color,orden,archivada_at').eq('user_id', uid).order('orden'),
      supabase.from('items').select(ITEM_COLS).eq('user_id', uid)
        .not('tipo', 'is', null).is('deleted_at', null).is('completada_at', null),
      supabase.from('entradas').select('id,texto,origen,estado,regla,created_at,procesada_at').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('objetivos').select('id,titulo,notas,area_id,fecha_meta,completado_at').eq('user_id', uid)
        .is('deleted_at', null).order('created_at'),
      supabase.from('rutinas').select(RUTINA_COLS).eq('user_id', uid).is('deleted_at', null).order('created_at'),
      supabase.from('rutina_pasos').select('id,rutina_id,texto,orden').eq('user_id', uid).order('orden'),
      supabase.from('items').select('rutina_id,ocurrencia_fecha').eq('user_id', uid)
        .not('rutina_id', 'is', null).not('completada_at', 'is', null).is('deleted_at', null).gte('ocurrencia_fecha', lunes),
      supabase.from('profiles').select('id,username,avatar_url,xp_points,level').eq('id', uid).maybeSingle(),
    ]);
    const rutinasData = must(rutinas) as Rutina[];
    const itemsData = must(items) as Item[];
    const nuevas = await generateTodayOccurrences(uid, rutinasData);
    const todos = [...itemsData, ...nuevas];
    // Marcas de checklist solo de las ocurrencias pendientes que se muestran
    const conRutina = todos.filter(i => i.rutina_id).map(i => i.id);
    const itemPasos = conRutina.length
      ? must(await supabase.from('item_pasos').select('item_id,paso_id').in('item_id', conRutina)) as ItemPaso[]
      : [];
    return {
      areas: must(areas) as Area[],
      items: todos,
      entradas: must(entradas) as Entrada[],
      objetivos: must(objetivos) as Objetivo[],
      rutinas: rutinasData,
      pasos: must(pasos) as RutinaPaso[],
      itemPasos,
      hechasSemana: must(hechas) as { rutina_id: string; ocurrencia_fecha: string }[],
      perfil: must(perfil) as Perfil | null,
    };
  },

  createItem: async input => {
    const uid = await requireUserId();
    return must(await supabase.from('items')
      .insert({ user_id: uid, tipo: input.tipo ?? 'tarea', ...input })
      .select(ITEM_COLS).single()) as Item;
  },

  updateItem: async (id, patch) => {
    must(await supabase.from('items').update(patch).eq('id', id));
  },

  // La función de la base verifica dueño, es idempotente y suma/resta XP
  setCompleted: async (id, done) => {
    must(await supabase.rpc('completar_item', { p_item_id: id, p_completar: done }));
  },

  // Borrado lógico: la fila queda para poder deshacer y para el historial
  deleteItem: async id => {
    must(await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', id));
  },
  restoreItem: async id => {
    must(await supabase.from('items').update({ deleted_at: null }).eq('id', id));
  },

  // Historial honesto: si estaba vencida, queda registrado aunque se mueva
  reprogramar: async (item, fechaNueva, estabaVencida) => {
    const uid = await requireUserId();
    must(await supabase.from('items')
      .update({ fecha: fechaNueva, ...(fechaNueva ? {} : { hora_inicio: null }) }).eq('id', item.id));
    must(await supabase.from('reprogramaciones').insert({
      user_id: uid, item_id: item.id, fecha_anterior: item.fecha, fecha_nueva: fechaNueva, estaba_vencida: estabaVencida,
    }));
  },

  // El ítem pasa a ser la primera ocurrencia de la rutina nueva
  convertToRutina: async (item, recurrencia) => {
    const uid = await requireUserId();
    const dia = item.fecha ?? localDayKey();
    const rutina = must(await supabase.from('rutinas').insert({
      user_id: uid,
      titulo: item.titulo,
      notas: item.notas,
      area_id: item.area_id,
      objetivo_id: item.objetivo_id,
      modo_horario: item.hora_inicio ? 'fija' : 'sin_hora',
      hora_inicio: item.hora_inicio,
      duracion_min: item.duracion_min,
      ...recurrenceFrom(recurrencia, new Date(dia + 'T12:00:00')),
    }).select(RUTINA_COLS).single()) as Rutina;
    must(await supabase.from('items')
      .update({ rutina_id: rutina.id, ocurrencia_fecha: dia, fecha: dia }).eq('id', item.id));
    return rutina;
  },

  createRutina: async (input, pasos) => {
    const uid = await requireUserId();
    const rutina = must(await supabase.from('rutinas').insert({ user_id: uid, ...input })
      .select(RUTINA_COLS).single()) as Rutina;
    await guardarPasos(uid, rutina.id, pasos, []);
    await generateTodayOccurrences(uid, [rutina]);
  },

  updateRutina: async (rutina, input, pasos) => {
    const uid = await requireUserId();
    const actualizada = must(await supabase.from('rutinas').update(input).eq('id', rutina.id)
      .select(RUTINA_COLS).single()) as Rutina;
    const anteriores = (must(await supabase.from('rutina_pasos').select('id').eq('rutina_id', rutina.id)) as { id: string }[]).map(p => p.id);
    await guardarPasos(uid, rutina.id, pasos, anteriores);
    await propagarRutina(uid, actualizada);
  },

  // Pausar no borra la ocurrencia de hoy si ya existe: solo deja de generar
  setRutinaPausada: async (id, pausada) => {
    const uid = await requireUserId();
    const r = must(await supabase.from('rutinas').update({ pausada_at: pausada ? new Date().toISOString() : null })
      .eq('id', id).select(RUTINA_COLS).single()) as Rutina;
    if (!pausada) await generateTodayOccurrences(uid, [r]);
  },

  // Eliminar = borrado lógico de la rutina y de sus ocurrencias pendientes
  // desde hoy. Las pasadas quedan para el historial.
  deleteRutina: async id => {
    const ahora = new Date().toISOString();
    must(await supabase.from('rutinas').update({ deleted_at: ahora }).eq('id', id));
    must(await supabase.from('items').update({ deleted_at: ahora })
      .eq('rutina_id', id).gte('ocurrencia_fecha', localDayKey()).is('completada_at', null));
  },

  setPaso: async (itemId, pasoId, hecho) => {
    const uid = await requireUserId();
    if (hecho) {
      must(await supabase.from('item_pasos')
        .upsert({ user_id: uid, item_id: itemId, paso_id: pasoId }, { onConflict: 'item_id,paso_id', ignoreDuplicates: true }));
    } else {
      must(await supabase.from('item_pasos').delete().eq('item_id', itemId).eq('paso_id', pasoId));
    }
  },

  createEntrada: async (texto, origen = 'texto') => {
    const uid = await requireUserId();
    return must(await supabase.from('entradas').insert({ user_id: uid, texto, origen })
      .select('id,texto,origen,estado,regla,created_at,procesada_at').single()) as Entrada;
  },
  setEntradaEstado: async (id, estado, regla = null) => {
    must(await supabase.from('entradas').update({
      estado, regla, procesada_at: estado === 'sin_ordenar' ? null : new Date().toISOString(),
    }).eq('id', id));
  },

  createArea: async a => {
    const uid = await requireUserId();
    return must(await supabase.from('areas').insert({ user_id: uid, ...a })
      .select('id,nombre,color,orden,archivada_at').single()) as Area;
  },
  updateArea: async (id, patch) => {
    must(await supabase.from('areas').update(patch).eq('id', id));
  },

  createObjetivo: async titulo => {
    const uid = await requireUserId();
    return must(await supabase.from('objetivos').insert({ user_id: uid, titulo })
      .select('id,titulo,notas,area_id,fecha_meta,completado_at').single()) as Objetivo;
  },
  updateObjetivo: async (id, patch) => {
    must(await supabase.from('objetivos').update(patch).eq('id', id));
  },
  // Borrado lógico del objetivo; sus tareas quedan sin objetivo (no se borran)
  deleteObjetivo: async id => {
    must(await supabase.from('objetivos').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    must(await supabase.from('items').update({ objetivo_id: null }).eq('objetivo_id', id));
  },

  updatePerfil: async patch => {
    const uid = await requireUserId();
    must(await supabase.from('profiles').update(patch).eq('id', uid));
  },
};

// Modo demo (EXPO_PUBLIC_DEMO=1): datos de ejemplo en memoria, nunca toca la
// base. Sirve para probar la interfaz sin cuenta. En la PWA está apagado.
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
export const api: ZenApi = IS_DEMO ? demoApi : supabaseApi;
