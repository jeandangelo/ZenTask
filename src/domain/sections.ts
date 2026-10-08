import { addDaysKey, localDayKey } from './dates';
import { Item } from './types';

// Secciones de la pestaña Tareas (docs/rediseno.md, decisión 5).
// "Sin ordenar" no está aquí: son entradas del Buzón, no ítems.
export type SectionKey = 'vencidas' | 'hoy' | 'pronto' | 'mas_adelante' | 'sin_fecha';

export const SECTION_TITLES: Record<SectionKey, string> = {
  vencidas: 'Vencidas',
  hoy: 'Hoy',
  pronto: 'Pronto',
  mas_adelante: 'Más adelante',
  sin_fecha: 'Sin fecha',
};

// "Pronto" = los próximos 7 días (móviles), sin contar hoy
export const PRONTO_DIAS = 7;

// ¿En qué sección va un ítem pendiente? null = no se muestra.
// - Completados: se ocultan (la UI ofrece Deshacer unos segundos).
// - Ocurrencias de rutinas de días pasados: no cumplidas = se pierden, nunca
//   aparecen como vencidas (decisión 7: sobrevivir a una semana mala).
export const sectionOf = (item: Item, today: string = localDayKey()): SectionKey | null => {
  if (item.completada_at) return null;
  if (!item.fecha) return 'sin_fecha';
  if (item.fecha < today) return item.rutina_id ? null : 'vencidas';
  if (item.fecha === today) return 'hoy';
  if (item.fecha <= addDaysKey(today, PRONTO_DIAS)) return 'pronto';
  return 'mas_adelante';
};

// Orden dentro de una sección: por fecha, luego los que tienen hora (por
// hora), luego los de "todo el día", y por fecha de creación.
const compare = (a: Item, b: Item) =>
  (a.fecha ?? '').localeCompare(b.fecha ?? '') ||
  (a.hora_inicio ? 0 : 1) - (b.hora_inicio ? 0 : 1) ||
  (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '') ||
  a.created_at.localeCompare(b.created_at);

export const ORDERED_SECTIONS: SectionKey[] = ['vencidas', 'hoy', 'pronto', 'mas_adelante', 'sin_fecha'];

export const groupBySection = (items: Item[], today: string = localDayKey()) => {
  const groups: Record<SectionKey, Item[]> = { vencidas: [], hoy: [], pronto: [], mas_adelante: [], sin_fecha: [] };
  for (const item of items) {
    const key = sectionOf(item, today);
    if (key) groups[key].push(item);
  }
  for (const key of ORDERED_SECTIONS) groups[key].sort(compare);
  return groups;
};

// Búsqueda y filtro por área (chips) comunes a Tareas y Compras
export const matchesFilter = (item: Item, areaId: string | null, query: string) => {
  if (areaId && item.area_id !== areaId) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.titulo.toLowerCase().includes(q) || (item.notas ?? '').toLowerCase().includes(q);
};
