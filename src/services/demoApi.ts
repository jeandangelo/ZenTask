import type { Session } from '@supabase/supabase-js';
import type { Snapshot, ZenApi } from './api';
import { addDaysKey, localDayKey } from '../domain/dates';
import { recurrenceFrom, routineOccursOn } from '../domain/routines';
import { Area, Entrada, Item, Objetivo, Perfil, Rutina } from '../domain/types';

// Implementación en memoria de ZenApi para el modo demo (EXPO_PUBLIC_DEMO=1).
// Imita las reglas de la base (borrado lógico, XP con nivel que no baja,
// una ocurrencia por rutina y día) con datos de ejemplo. Se pierde al recargar.

let seq = 0;
const uid = () => `demo-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const now = () => new Date().toISOString();
const wait = () => new Promise(r => setTimeout(r, 120)); // simula la red

const today = localDayKey();

const areas: Area[] = [
  ['Universidad', '#6E8BB0'], ['Trabajo', '#C9A15A'], ['Entrenamiento', '#C97A6B'],
  ['Desarrollo', '#5FA8B8'], ['Marca', '#B8679A'], ['Personal', '#6FB59A'], ['Cine', '#9B8AC4'],
].map(([nombre, color], orden) => ({ id: uid(), nombre, color, orden, archivada_at: null }));
const area = (n: string) => areas.find(a => a.nombre === n)!.id;

const objetivos: Objetivo[] = [
  { id: uid(), titulo: 'Aprobar Cálculo II', notas: null, area_id: area('Universidad'), fecha_meta: null, completado_at: null },
  { id: uid(), titulo: 'Banca 100 kg', notas: null, area_id: area('Entrenamiento'), fecha_meta: null, completado_at: null },
];

const rutinas: Rutina[] = [
  { id: uid(), titulo: 'Rutina mañana', notas: null, area_id: area('Personal'), recurrencia: 'diaria', dias_semana: null, dia_mes: null, modo_horario: 'sin_hora', hora_inicio: null, marcable: true, objetivo_id: null, pausada_at: null },
  { id: uid(), titulo: 'Entrenar', notas: null, area_id: area('Entrenamiento'), recurrencia: 'diaria', dias_semana: null, dia_mes: null, modo_horario: 'sin_hora', hora_inicio: null, marcable: true, objetivo_id: objetivos[1].id, pausada_at: null },
];

const item = (p: Partial<Item> & Pick<Item, 'titulo'>): Item & { deleted?: boolean } => ({
  id: uid(), tipo: 'tarea', notas: null, area_id: null, fecha: null, hora_inicio: null, duracion_min: null,
  objetivo_id: null, rutina_id: null, ocurrencia_fecha: null, entrada_id: null, completada_at: null, created_at: now(), ...p,
});

const items: (Item & { deleted?: boolean })[] = [
  item({ titulo: 'Entregar informe de laboratorio', fecha: addDaysKey(today, -2), area_id: area('Universidad'), objetivo_id: objetivos[0].id }),
  item({ titulo: 'Prueba de cálculo', fecha: addDaysKey(today, 3), hora_inicio: '10:00:00', area_id: area('Universidad'), objetivo_id: objetivos[0].id, notas: 'Capítulos 4 y 5' }),
  item({ titulo: 'Revisar correos', fecha: today, area_id: area('Trabajo') }),
  item({ titulo: 'Llamar al dentista', fecha: today, hora_inicio: '16:30:00' }),
  item({ titulo: 'Publicar post de la marca', fecha: addDaysKey(today, 12), area_id: area('Marca') }),
  item({ titulo: 'Ordenar escritorio' }),
  item({ titulo: 'Leche', tipo: 'compra', area_id: area('Personal') }),
  item({ titulo: 'Proteína', tipo: 'compra', area_id: area('Entrenamiento') }),
  item({ titulo: 'Dune: Parte Dos', area_id: area('Cine') }),
];

const entradas: Entrada[] = [
  { id: uid(), texto: 'idea: widget de captura rápida', origen: 'texto', estado: 'sin_ordenar', created_at: now(), procesada_at: null },
];

const perfil: Perfil = { id: 'demo', username: 'Demo', avatar_url: null, xp_points: 1680, level: 17 };

const find = (id: string) => {
  const it = items.find(i => i.id === id);
  if (!it) throw new Error('Ítem no encontrado');
  return it;
};
const visible = ({ deleted, ...i }: Item & { deleted?: boolean }) => i;
const fakeSession = { user: { id: 'demo', email: 'demo@zentask' } } as unknown as Session;

export const demoApi: ZenApi = {
  auth: {
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => undefined,
    getSession: async () => fakeSession,
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  },

  loadAll: async (): Promise<Snapshot> => {
    await wait();
    const d = new Date();
    const hoy = localDayKey(d);
    for (const r of rutinas.filter(r => routineOccursOn(r, d))) {
      if (!items.some(i => i.rutina_id === r.id && i.ocurrencia_fecha === hoy)) {
        items.push(item({ titulo: r.titulo, area_id: r.area_id, objetivo_id: r.objetivo_id, rutina_id: r.id, ocurrencia_fecha: hoy, fecha: hoy }));
      }
    }
    return {
      areas: [...areas].sort((a, b) => a.orden - b.orden),
      items: items.filter(i => !i.deleted && !i.completada_at).map(visible),
      entradas: [...entradas].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      objetivos: [...objetivos],
      rutinas: [...rutinas],
      perfil: { ...perfil },
    };
  },

  createItem: async input => {
    await wait();
    const it = item({ titulo: input.titulo ?? '', ...input, tipo: input.tipo ?? 'tarea' });
    items.push(it);
    return visible(it);
  },
  updateItem: async (id, patch) => { await wait(); Object.assign(find(id), patch); },
  setCompleted: async (id, done) => {
    await wait();
    const it = find(id);
    if (done === !!it.completada_at) return;
    it.completada_at = done ? now() : null;
    perfil.xp_points += done ? 10 : -10;
    perfil.level = Math.max(perfil.level, Math.floor(perfil.xp_points / 100) + 1);
  },
  deleteItem: async id => { await wait(); find(id).deleted = true; },
  restoreItem: async id => { await wait(); find(id).deleted = false; },
  reprogramar: async (it, fecha) => {
    await wait();
    const t = find(it.id);
    t.fecha = fecha;
    if (!fecha) t.hora_inicio = null;
  },
  convertToRutina: async (it, recurrencia) => {
    await wait();
    const dia = it.fecha ?? localDayKey();
    const r: Rutina = {
      id: uid(), titulo: it.titulo, notas: it.notas, area_id: it.area_id, objetivo_id: it.objetivo_id,
      modo_horario: it.hora_inicio ? 'fija' : 'sin_hora', hora_inicio: it.hora_inicio, marcable: true, pausada_at: null,
      ...recurrenceFrom(recurrencia, new Date(dia + 'T12:00:00')),
    };
    rutinas.push(r);
    Object.assign(find(it.id), { rutina_id: r.id, ocurrencia_fecha: dia, fecha: dia });
    return r;
  },

  createEntrada: async (texto, origen = 'texto') => {
    await wait();
    const e: Entrada = { id: uid(), texto, origen, estado: 'sin_ordenar', created_at: now(), procesada_at: null };
    entradas.push(e);
    return e;
  },
  setEntradaEstado: async (id, estado) => {
    await wait();
    const e = entradas.find(x => x.id === id)!;
    e.estado = estado;
    e.procesada_at = estado === 'sin_ordenar' ? null : now();
  },

  createArea: async a => {
    await wait();
    if (areas.some(x => !x.archivada_at && x.nombre.toLowerCase() === a.nombre.trim().toLowerCase())) {
      throw new Error('duplicate key value violates unique constraint "areas_nombre_activo_unico"');
    }
    const nueva = { id: uid(), archivada_at: null, ...a };
    areas.push(nueva);
    return nueva;
  },
  updateArea: async (id, patch) => { await wait(); Object.assign(areas.find(a => a.id === id)!, patch); },

  createObjetivo: async titulo => {
    await wait();
    const o: Objetivo = { id: uid(), titulo, notas: null, area_id: null, fecha_meta: null, completado_at: null };
    objetivos.push(o);
    return o;
  },
  updateObjetivo: async (id, patch) => { await wait(); Object.assign(objetivos.find(o => o.id === id)!, patch); },
  deleteObjetivo: async id => {
    await wait();
    objetivos.splice(objetivos.findIndex(o => o.id === id), 1);
    for (const it of items) if (it.objetivo_id === id) it.objetivo_id = null;
  },

  updatePerfil: async patch => { await wait(); Object.assign(perfil, patch); },
};
