// Modelos de vista del tablero (camelCase), derivados de DbItem / DbColumn.

export interface Task {
  id: string;
  columnId: string;
  type: 'task' | 'goal';
  title: string;
  description?: string;
  status: 'pending' | 'done';
  tag: string;
  linkedGoalId?: string;
  due_date?: string | null;
  recurrence?: string;
}

export interface ColumnData {
  id: string;
  title: string;
  isGoalColumn?: boolean;
  // Listas virtuales (no existen en la base): PROGRAMADAS y MIS OBJETIVOS
  isScheduledColumn?: boolean;
}
