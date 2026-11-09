import { addDays, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import { localDayKey } from './dates';
import { routineOccursOn } from './routines';
import { Item, Rutina } from './types';

// Lógica pura del calendario (etapa 4): grilla por horas, días de la
// semana y del mes, bloques que se superponen y proyección de rutinas.

export const MIN_DIA = 24 * 60;
export const PASO_MIN = 5;           // al arrastrar o estirar, la hora se ajusta de a 5 min (6:40 es alcanzable)
// Un ítem con hora pero sin duración es un "momento" (levantarse a las 6):
// en la grilla ocupa solo este espacio visual y se muestra sin hora de fin.
export const MIN_VISUAL_MOMENTO = 30; // ~26 px: alcanza para el título en una línea

// 'HH:mm[:ss]' → minutos desde medianoche
export const minutosDe = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const [h, m] = t.split(':').map(n => parseInt(n, 10));
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

// minutos → 'HH:mm'
export const horaDe = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Hora nueva después de arrastrar `deltaPx` en una grilla de `pxPorHora`:
// se ajusta de a PASO_MIN y no se sale del día.
export const moverMinutos = (inicio: number, deltaPx: number, pxPorHora: number, duracion = 0): number => {
  const crudo = inicio + (deltaPx / pxPorHora) * 60;
  const ajustado = Math.round(crudo / PASO_MIN) * PASO_MIN;
  return Math.max(0, Math.min(MIN_DIA - Math.max(PASO_MIN, Math.min(duracion, MIN_DIA)), ajustado));
};

// Lunes a domingo de la semana que contiene `dia`
export const semanaDe = (dia: string): string[] => {
  const d = parseISO(dia);
  const lunes = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(lunes, i)));
};

// 6 semanas (42 días) que cubren el mes de `dia`, empezando en lunes.
// Los días de fuera del mes vienen marcados para mostrarlos apagados.
export const grillaMes = (dia: string): { dia: string; delMes: boolean }[] => {
  const primero = startOfMonth(parseISO(dia));
  const inicio = addDays(primero, -((primero.getDay() + 6) % 7));
  const mes = primero.getMonth();
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(inicio, i);
    return { dia: localDayKey(d), delMes: d.getMonth() === mes };
  }).filter((c, i, arr) => i < 35 || arr.slice(35).some(x => x.delMes)); // 5 semanas si alcanza
};

// Un bloque en la grilla. `col`/`cols` reparten el ancho cuando hay
// bloques que se superponen en el tiempo.
export interface Bloque<T> {
  ref: T;
  inicio: number; // minutos
  fin: number;
  col: number;
  cols: number;
}

// Reparte en columnas los bloques que se tocan (como Google Calendar):
// cada grupo de bloques encadenados comparte el ancho en partes iguales.
export const distribuir = <T>(entradas: { ref: T; inicio: number; fin: number }[]): Bloque<T>[] => {
  const orden = [...entradas].sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const resultado: Bloque<T>[] = [];
  let grupo: Bloque<T>[] = [];
  let finGrupo = -1;
  const cerrar = () => {
    const cols = Math.max(1, ...grupo.map(b => b.col + 1));
    grupo.forEach(b => { b.cols = cols; });
    resultado.push(...grupo);
    grupo = [];
  };
  for (const e of orden) {
    if (grupo.length && e.inicio >= finGrupo) { cerrar(); finGrupo = -1; }
    // primera columna libre (cuyo último bloque ya terminó)
    let col = 0;
    while (grupo.some(b => b.col === col && b.fin > e.inicio)) col++;
    grupo.push({ ...e, col, cols: 1 });
    finGrupo = Math.max(finGrupo, e.fin);
  }
  if (grupo.length) cerrar();
  return resultado;
};

// Rango en minutos de un ítem con hora (no pasa de medianoche). Sin
// duración es un momento: ocupa MIN_VISUAL_MOMENTO y viene marcado como tal.
export const rangoDe = (item: Pick<Item, 'hora_inicio' | 'duracion_min'>): { inicio: number; fin: number; momento: boolean } | null => {
  const inicio = minutosDe(item.hora_inicio);
  if (inicio == null) return null;
  const momento = !item.duracion_min;
  return { inicio, fin: Math.min(MIN_DIA, inicio + (momento ? MIN_VISUAL_MOMENTO : Math.max(PASO_MIN, item.duracion_min!))), momento };
};

// Duración nueva al estirar el borde inferior de un bloque `deltaPx`:
// de a 5 min, mínimo 5 y sin pasar de medianoche. Un momento (sin
// duración) parte desde 0.
export const estirarDuracion = (inicio: number, duracion: number, deltaPx: number, pxPorHora: number): number => {
  const cruda = duracion + (deltaPx / pxPorHora) * 60;
  const ajustada = Math.round(cruda / PASO_MIN) * PASO_MIN;
  return Math.max(PASO_MIN, Math.min(MIN_DIA - inicio, ajustada));
};

// "15 min", "1 h", "1 h 30 min"
export const textoDuracion = (min: number): string =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`;

// Ocurrencia proyectada de una rutina en un día futuro: todavía no existe
// en la base (se genera recién ese día), solo se dibuja para planificar.
export interface Proyeccion {
  rutina: Rutina;
  dia: string;
}

// Solo las de hora fija se proyectan (un turno 9–17 sirve para planificar
// la semana). Las sin hora y flexibles aparecen únicamente el día que se
// generan, para no repetir el ruido que Jean pidió sacar del cronograma.
export const proyectarRutinas = (rutinas: Rutina[], dia: string, hoy: string, yaGeneradas: Set<string>): Proyeccion[] => {
  if (dia <= hoy) return [];
  const fecha = parseISO(dia);
  return rutinas
    .filter(r => r.modo_horario === 'fija' && r.hora_inicio && !yaGeneradas.has(r.id) && routineOccursOn(r, fecha))
    .map(rutina => ({ rutina, dia }));
};

// Días del mes con algo programado (para los puntos de la vista mes). Las
// ocurrencias de rutinas no cuentan (decisión de Jean: el mes sin rutinas).
export const puntosDelMes = (items: Item[]): Map<string, string[]> => {
  const m = new Map<string, string[]>();
  for (const i of items) {
    if (!i.fecha || i.rutina_id || i.completada_at) continue;
    const lista = m.get(i.fecha) ?? [];
    lista.push(i.area_id ?? '');
    m.set(i.fecha, lista);
  }
  return m;
};

export const diasDelMes = (dia: string) => getDaysInMonth(parseISO(dia));

// Dónde cae un ítem arrastrado desde "todo el día" a la grilla. `x`/`y`
// son relativos a la vista de la grilla completa (franja incluida);
// `inicioGrilla` es dónde empiezan las horas y `scroll` cuánto se bajó.
// Devuelve null si se suelta todavía sobre la franja.
export const destinoSoltar = (p: {
  x: number; y: number; inicioGrilla: number; scroll: number;
  pxPorHora: number; margenHoras: number; anchoDia: number; dias: number;
}): { minutos: number; diaIndice: number } | null => {
  if (p.y < p.inicioGrilla) return null;
  const crudo = ((p.y - p.inicioGrilla + p.scroll) / p.pxPorHora) * 60;
  const minutos = Math.max(0, Math.min(MIN_DIA - PASO_MIN, Math.round(crudo / PASO_MIN) * PASO_MIN));
  const diaIndice = Math.max(0, Math.min(p.dias - 1, Math.floor((p.x - p.margenHoras) / Math.max(1, p.anchoDia))));
  return { minutos, diaIndice };
};
