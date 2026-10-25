import { addDays, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import { localDayKey } from './dates';
import { routineOccursOn } from './routines';
import { Item, Rutina } from './types';

// Lógica pura del calendario (etapa 4): grilla por horas, días de la
// semana y del mes, bloques que se superponen y proyección de rutinas.

export const MIN_DIA = 24 * 60;
export const PASO_MIN = 15;          // al arrastrar, la hora se ajusta de a 15 min
export const DURACION_DEFECTO = 60;  // un ítem con hora pero sin duración ocupa 1 h en la grilla

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
// se ajusta a 15 min y no se sale del día.
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

// Rango en minutos de un ítem con hora (sin duración = 1 h; no pasa de medianoche)
export const rangoDe = (item: Pick<Item, 'hora_inicio' | 'duracion_min'>): { inicio: number; fin: number } | null => {
  const inicio = minutosDe(item.hora_inicio);
  if (inicio == null) return null;
  return { inicio, fin: Math.min(MIN_DIA, inicio + Math.max(PASO_MIN, item.duracion_min ?? DURACION_DEFECTO)) };
};

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
