import { addDays, parseISO } from 'date-fns';
import { dayKeyOf, localDayKey } from './dates';

// Lógica pura de Progreso (etapa 5, docs/rediseno.md decisiones 8, 8b, 8c).

// Lo hecho antes del rediseño no cuenta para los gráficos semanales
// (decisión de Jean, 8 oct): la migración no sabía cuándo se completó cada
// tarea vieja. Las semanas parten desde aquí.
export const INICIO_PROGRESO = '2026-10-09';

// Lunes (clave) de la semana que contiene `dia`
export const lunesDe = (dia: string): string => {
  const d = parseISO(dia);
  return localDayKey(addDays(d, -((d.getDay() + 6) % 7)));
};

// Las últimas `n` semanas hasta hoy (lunes, la más antigua primero), sin
// las que terminaron antes del inicio del progreso.
export const semanasRecientes = (hoy: string, n: number, inicio = INICIO_PROGRESO): string[] => {
  const actual = lunesDe(hoy);
  const desde = lunesDe(inicio);
  return Array.from({ length: n }, (_, i) => localDayKey(addDays(parseISO(actual), -7 * (n - 1 - i))))
    .filter(l => l >= desde);
};

// Vencidas registradas (historial honesto, decisión 8c): las que se
// reprogramaron estando vencidas + las que siguen vencidas sin completar.
// Una misma tarea vencida en la misma fecha cuenta una vez. Las ocurrencias
// de rutinas nunca vencen (decisión 7).
export const vencidasRegistradas = (
  reprogramaciones: { item_id: string; fecha_anterior: string | null }[],
  pendientes: { id: string; fecha: string | null; rutina_id: string | null; completada_at: string | null }[],
  hoy: string,
): { item_id: string; fecha: string }[] => {
  const vistas = new Map<string, { item_id: string; fecha: string }>();
  for (const r of reprogramaciones) {
    if (r.fecha_anterior) vistas.set(`${r.item_id}|${r.fecha_anterior}`, { item_id: r.item_id, fecha: r.fecha_anterior });
  }
  for (const p of pendientes) {
    if (p.fecha && p.fecha < hoy && !p.rutina_id && !p.completada_at) vistas.set(`${p.id}|${p.fecha}`, { item_id: p.id, fecha: p.fecha });
  }
  return [...vistas.values()];
};

export interface ResumenSemana {
  semana: string;      // lunes
  completadas: number;
  vencidas: number;
}

// Completadas (por el día en que se completaron) vs. vencidas (por el día
// que vencían) en cada semana. Antes de INICIO_PROGRESO no cuenta nada.
export const resumenSemanal = (
  completadas: { completada_at: string }[],
  vencidas: { fecha: string }[],
  semanas: string[],
  inicio = INICIO_PROGRESO,
): ResumenSemana[] => {
  const res = new Map(semanas.map(s => [s, { semana: s, completadas: 0, vencidas: 0 }]));
  for (const c of completadas) {
    const dia = dayKeyOf(c.completada_at);
    if (dia && dia >= inicio) { const r = res.get(lunesDe(dia)); if (r) r.completadas++; }
  }
  for (const v of vencidas) {
    if (v.fecha >= inicio) { const r = res.get(lunesDe(v.fecha)); if (r) r.vencidas++; }
  }
  return semanas.map(s => res.get(s)!);
};

// Avance de un objetivo (decisión 8b): tareas vinculadas completadas /
// total. Las ocurrencias de rutinas no cuentan: los días que no se hicieron
// se pierden (decisión 7) y bajarían el avance sin razón.
export const avanceObjetivo = (vinculadas: { completada_at: string | null; rutina_id: string | null }[]) => {
  const tareas = vinculadas.filter(i => !i.rutina_id);
  const hechas = tareas.filter(i => i.completada_at).length;
  return { hechas, total: tareas.length, pct: tareas.length ? Math.round((hechas / tareas.length) * 100) : 0 };
};
