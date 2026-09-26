import { format, isValid, parseISO } from 'date-fns';

// Clave de día en hora LOCAL ('yyyy-MM-dd').
// No usar toISOString().split('T')[0]: eso da el día UTC, que en Chile
// ya es "mañana" pasadas las ~20:00-21:00.
export const localDayKey = (date: Date = new Date()): string => format(date, 'yyyy-MM-dd');

// Día local de una fecha ISO guardada en la base, o null si no es válida.
export const dayKeyOf = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? localDayKey(d) : null;
};
