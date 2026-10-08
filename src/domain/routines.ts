import { getDaysInMonth } from 'date-fns';
import { Recurrencia, Rutina } from './types';

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
