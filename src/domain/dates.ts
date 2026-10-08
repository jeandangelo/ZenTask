import { addDays, format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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

// 'yyyy-MM-dd' + n días, sin pasar por UTC
export const addDaysKey = (key: string, n: number): string => localDayKey(addDays(parseISO(key), n));

// Próximo sábado (o el de esta semana si hoy es lunes a viernes; si hoy ya
// es fin de semana, el sábado siguiente).
export const nextWeekendKey = (from: Date = new Date()): string => {
  const day = from.getDay(); // 0 dom … 6 sáb
  const diff = day === 6 ? 7 : day === 0 ? 6 : 6 - day;
  return localDayKey(addDays(from, diff));
};

// "hoy", "mañana", "ayer" o "jue 16 oct"
export const friendlyDay = (key: string, today: string = localDayKey()): string => {
  if (key === today) return 'hoy';
  if (key === addDaysKey(today, 1)) return 'mañana';
  if (key === addDaysKey(today, -1)) return 'ayer';
  return format(parseISO(key), 'EEE d MMM', { locale: es }).replace('.', '');
};

// '09:30:00' → '09:30'
export const shortTime = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);
