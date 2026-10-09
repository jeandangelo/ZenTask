import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { demoApi } from './demoApi';
import { localDayKey } from '../domain/dates';
import { recurrenceFrom, routineOccursOn } from '../domain/routines';
import {
  Area, Entrada, EstadoEntrada, Item, ItemInput, Objetivo, Perfil, Recurrencia, Rutina,
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
  perfil: Perfil | null;
}

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
  createEntrada: (texto: string, origen?: 'texto' | 'voz') => Promise<Entrada>;
  setEntradaEstado: (id: string, estado: EstadoEntrada) => Promise<void>;
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
const RUTINA_COLS = 'id,titulo,notas,area_id,recurrencia,dias_semana,dia_mes,modo_horario,hora_inicio,marcable,objetivo_id,pausada_at';

// Genera (si falta) la ocurrencia de HOY de cada rutina activa. La base
// tiene una restricción única (rutina_id, ocurrencia_fecha): si otro
// dispositivo ya la creó, el insert se ignora en vez de duplicarla.
const generateTodayOccurrences = async (userId: string, rutinas: Rutina[]): Promise<Item[]> => {
  const now = new Date();
  const today = localDayKey(now);
  const rows = rutinas.filter(r => routineOccursOn(r, now)).map(r => ({
    user_id: userId,
    tipo: 'tarea',
    titulo: r.titulo,
    notas: r.notas,
    area_id: r.area_id,
    objetivo_id: r.objetivo_id,
    rutina_id: r.id,
    ocurrencia_fecha: today,
    fecha: today,
    hora_inicio: r.modo_horario === 'fija' ? r.hora_inicio : null,
  }));
  if (rows.length === 0) return [];
  return must(await supabase.from('items')
    .upsert(rows, { onConflict: 'rutina_id,ocurrencia_fecha', ignoreDuplicates: true })
    .select(ITEM_COLS)) as Item[];
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
    const [areas, items, entradas, objetivos, rutinas, perfil] = await Promise.all([
      supabase.from('areas').select('id,nombre,color,orden,archivada_at').eq('user_id', uid).order('orden'),
      supabase.from('items').select(ITEM_COLS).eq('user_id', uid)
        .not('tipo', 'is', null).is('deleted_at', null).is('completada_at', null),
      supabase.from('entradas').select('id,texto,origen,estado,created_at,procesada_at').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('objetivos').select('id,titulo,notas,area_id,fecha_meta,completado_at').eq('user_id', uid)
        .is('deleted_at', null).order('created_at'),
      supabase.from('rutinas').select(RUTINA_COLS).eq('user_id', uid).is('deleted_at', null).order('created_at'),
      supabase.from('profiles').select('id,username,avatar_url,xp_points,level').eq('id', uid).maybeSingle(),
    ]);
    const rutinasData = must(rutinas) as Rutina[];
    const itemsData = must(items) as Item[];
    const nuevas = await generateTodayOccurrences(uid, rutinasData);
    return {
      areas: must(areas) as Area[],
      items: [...itemsData, ...nuevas],
      entradas: must(entradas) as Entrada[],
      objetivos: must(objetivos) as Objetivo[],
      rutinas: rutinasData,
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

  createEntrada: async (texto, origen = 'texto') => {
    const uid = await requireUserId();
    return must(await supabase.from('entradas').insert({ user_id: uid, texto, origen })
      .select('id,texto,origen,estado,created_at,procesada_at').single()) as Entrada;
  },
  setEntradaEstado: async (id, estado) => {
    must(await supabase.from('entradas').update({
      estado, procesada_at: estado === 'sin_ordenar' ? null : new Date().toISOString(),
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
