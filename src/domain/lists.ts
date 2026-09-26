import { dayKeyOf, localDayKey } from './dates';

// Lista SHOPPING: columna real por defecto, detectada por título
// (se crea sola y está protegida contra borrado).
export const isShoppingTitle = (title: string | null | undefined): boolean => /SHOP|COMPRA/i.test(title || '');

// Tarea programada: pendiente y con fecha posterior a hoy (por día local).
export const isScheduledFuture = (item: { due_date?: string | null; status: string }): boolean => {
  if (item.status === 'done') return false;
  const key = dayKeyOf(item.due_date);
  return key !== null && key > localDayKey();
};
