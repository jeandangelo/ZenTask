import { getDaysInMonth } from 'date-fns';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RoutineRule {
  recurrence?: string | null;
  // weekly: 0 = domingo … 6 = sábado. monthly: día del mes (1-31).
  recurrence_day?: number | null;
}

// ¿La rutina corresponde a esta fecha? Única fuente de verdad: la usan el
// generador de tareas (api.ts), el calendario y el formulario de creación.
export const routineOccursOn = (routine: RoutineRule, date: Date): boolean => {
  const day = routine.recurrence_day ?? -1;
  switch (routine.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return date.getDay() === day;
    case 'monthly': {
      // Una rutina del 31 cae el último día en los meses más cortos
      // (30 de abril, 28/29 de febrero); si no, esos meses se saltaba.
      const lastDay = getDaysInMonth(date);
      return date.getDate() === Math.min(day, lastDay);
    }
    default:
      return false;
  }
};

// Día de referencia al crear una rutina hoy: el día de la semana para las
// semanales y el día del mes para las mensuales.
export const recurrenceDayFor = (recurrence: Recurrence, date: Date = new Date()): number => {
  if (recurrence === 'weekly') return date.getDay();
  if (recurrence === 'monthly') return date.getDate();
  return 0;
};

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'NUNCA',
  daily: 'DIARIO',
  weekly: 'SEMANAL',
  monthly: 'MENSUAL',
};
