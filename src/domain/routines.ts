import { addDays, getDaysInMonth, parseISO, startOfDay } from 'date-fns';
import { localDayKey } from './dates';
import { Recurrencia, Rutina, RutinaInput } from './types';

// ¿La rutina corresponde a esta fecha?
export const routineOccursOn = (
  rutina: Pick<Rutina, 'recurrencia' | 'dias_semana' | 'dia_mes' | 'pausada_at'>,
  date: Date,
): boolean => {
  if (rutina.pausada_at) return false;
  switch (rutina.recurrencia) {
    case 'diaria':
      return true;
    case 'semanal':
      return (rutina.dias_semana ?? []).includes(date.getDay());
    case 'mensual': {
      // Una rutina del 31 cae el último día en los meses más cortos
      // (30 de abril, 28/29 de febrero); si no, esos meses se saltaba.
      if (rutina.dia_mes == null) return false;
      return date.getDate() === Math.min(rutina.dia_mes, getDaysInMonth(date));
    }
    default:
      return false;
  }
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "Todos los días", "Lunes y jueves", "Cada mes, el día 15"
export const describeRecurrence = (r: Pick<Rutina, 'recurrencia' | 'dias_semana' | 'dia_mes'>): string => {
  if (r.recurrencia === 'diaria') return 'Todos los días';
  if (r.recurrencia === 'mensual') return `Cada mes, el día ${r.dia_mes}`;
  const dias = [...(r.dias_semana ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DIAS[d]);
  if (dias.length === 0) return 'Semanal';
  const lista = dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`;
  return lista.charAt(0).toUpperCase() + lista.slice(1);
};

// Regla de la recurrencia al convertir un ítem en rutina "desde este día"
export const recurrenceFrom = (recurrencia: Recurrencia, date: Date) => ({
  recurrencia,
  dias_semana: recurrencia === 'semanal' ? [date.getDay()] : null,
  dia_mes: recurrencia === 'mensual' ? date.getDate() : null,
});

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

// "Sin hora", "09:00 · 8 h", "08:30 · 45 min", "Entre 18:00 y 22:00"
export const describeHorario = (r: Pick<Rutina, 'modo_horario' | 'hora_inicio' | 'duracion_min' | 'rango_inicio' | 'rango_fin'>): string => {
  if (r.modo_horario === 'flexible') return `Entre ${hm(r.rango_inicio)} y ${hm(r.rango_fin)}`;
  if (r.modo_horario === 'fija') {
    const d = r.duracion_min;
    const dur = !d ? '' : d % 60 === 0 ? ` · ${d / 60} h` : d > 60 ? ` · ${Math.floor(d / 60)} h ${d % 60} min` : ` · ${d} min`;
    return `${hm(r.hora_inicio)}${dur}`;
  }
  return 'Sin hora';
};

// Qué está mal en una rutina antes de guardarla (las mismas reglas que la
// base: CHECKs de la tabla rutinas), o null si está bien.
export const validarRutina = (r: Partial<RutinaInput>): string | null => {
  if (!r.titulo?.trim()) return 'Ponle un nombre a la rutina.';
  if (r.recurrencia === 'semanal' && !(r.dias_semana?.length)) return 'Elige al menos un día de la semana.';
  if (r.recurrencia === 'mensual' && !(r.dia_mes && r.dia_mes >= 1 && r.dia_mes <= 31)) return 'Elige un día del mes (1 a 31).';
  if (r.modo_horario === 'fija' && !r.hora_inicio) return 'Una rutina de hora fija necesita su hora.';
  if (r.modo_horario === 'flexible') {
    if (!r.rango_inicio || !r.rango_fin) return 'Una rutina flexible necesita el rango (desde y hasta).';
    if (hm(r.rango_fin) <= hm(r.rango_inicio)) return 'El "hasta" tiene que ser después del "desde".';
  }
  return null;
};

// Lo que copia cada ocurrencia de su rutina (al generarla y al aplicar
// "toda la rutina"). La hora solo en las de hora fija: las flexibles
// quedan "por planificar" hasta que se les asigna una.
export const datosOcurrencia = (r: Pick<Rutina, 'titulo' | 'notas' | 'area_id' | 'objetivo_id' | 'modo_horario' | 'hora_inicio' | 'duracion_min'>) => ({
  titulo: r.titulo,
  notas: r.notas,
  area_id: r.area_id,
  objetivo_id: r.objetivo_id,
  hora_inicio: r.modo_horario === 'fija' ? r.hora_inicio : null,
  duracion_min: r.modo_horario === 'fija' ? r.duracion_min : null,
});

// Cumplimiento de la semana en curso (lunes a hoy): cuántos de los días
// que tocaba la rutina se completaron. Los días sin abrir la app cuentan
// como programados (no cumplidos), sin castigo más allá de eso.
export const cumplimientoSemana = (
  r: Pick<Rutina, 'recurrencia' | 'dias_semana' | 'dia_mes' | 'pausada_at' | 'created_at'>,
  fechasHechas: Set<string>,
  hoy: Date = new Date(),
): { hechas: number; programadas: number } => {
  const lunes = addDays(startOfDay(hoy), -((hoy.getDay() + 6) % 7));
  const creada = localDayKey(parseISO(r.created_at));
  let programadas = 0, hechas = 0;
  for (let d = lunes; d <= hoy; d = addDays(d, 1)) {
    const key = localDayKey(d);
    if (key < creada || !routineOccursOn({ ...r, pausada_at: null }, d)) continue;
    programadas++;
    if (fechasHechas.has(key)) hechas++;
  }
  return { hechas, programadas };
};
