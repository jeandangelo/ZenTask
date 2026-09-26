import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { dayKeyOf, localDayKey } from '../domain/dates';
import { isShoppingTitle } from '../domain/lists';
import { routineOccursOn } from '../domain/routines';

// Única capa que habla con Supabase: las pantallas no hacen queries directas.
// La seguridad real la dan las políticas RLS; filtrar por user_id aquí es
// una segunda barrera y además ayuda al planificador de la base.

// --- TIPOS ---
export interface DbColumn {
  id: string;
  title: string;
  is_goal_column: boolean;
  position: number;
}

export interface DbItem {
  id: string;
  column_id: string;
  type: 'task' | 'goal';
  title: string;
  description?: string;
  status: 'pending' | 'done';
  tag: string;
  linked_goal_id?: string | null;
  due_date?: string | null;
  is_template?: boolean;
  recurrence?: string;
  recurrence_day?: number;
  last_generated?: string | null;
}

export interface DbProfile {
  id: string;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  background_url?: string | null;
  xp_points?: number | null;
  level?: number | null;
}

export interface EfficiencyStats {
  total: number;
  done: number;
  pending: number;
  percent: number;
}

// Mensaje único para "no hay sesión": las pantallas lo detectan con
// isAuthError() para volver al login.
const AUTH_ERROR = 'Usuario no autenticado';

export const isAuthError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return msg === AUTH_ERROR || msg.includes('Auth session missing');
};

// Id del usuario desde la sesión guardada en el dispositivo, sin viaje de
// red (getUser() consulta al servidor en cada llamada).
const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error(AUTH_ERROR);
  return session.user.id;
};

// Crea hoy las tareas de las rutinas que corresponden y aún no se generaron.
// Devuelve true si insertó algo (para recargar la lista de ítems).
const generateRoutineTasks = async (userId: string, templates: DbItem[], columns: DbColumn[]): Promise<boolean> => {
  const firstColumn = columns[0];
  if (!firstColumn || templates.length === 0) return false;

  const today = new Date();
  const todayStr = localDayKey(today);
  const due = templates.filter(t => t.last_generated !== todayStr && routineOccursOn(t, today));
  if (due.length === 0) return false;

  const { error: insertError } = await supabase.from('items').insert(due.map(t => ({
    user_id: userId,
    column_id: firstColumn.id,
    type: t.type,
    title: t.title,
    description: t.description,
    tag: t.tag,
    linked_goal_id: t.linked_goal_id,
    status: 'pending',
    is_template: false,
    recurrence: 'none',
    due_date: today.toISOString(),
  })));
  // Si el insert falla NO se marca como generada: se reintenta en la próxima carga.
  if (insertError) {
    console.error('Error generando rutinas:', insertError.message);
    return false;
  }

  await supabase.from('items').update({ last_generated: todayStr }).in('id', due.map(t => t.id));
  return true;
};

const fetchItems = (userId: string) => supabase
  .from('items')
  .select('*')
  .eq('user_id', userId)
  .eq('is_template', false)
  .order('due_date', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true });

export const api = {

  // --- SESIÓN ---
  auth: {
    signIn: (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email: string, password: string) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
    getSession: () => supabase.auth.getSession(),
    onAuthStateChange: (callback: (session: Session | null) => void) =>
      supabase.auth.onAuthStateChange((_event, session) => callback(session)),
  },

  // Carga del tablero: columnas, ítems y plantillas van en paralelo
  // (antes eran 5-7 consultas en serie, cada una esperando a la anterior).
  getDashboardData: async (): Promise<{ columns: DbColumn[]; items: DbItem[] }> => {
    const userId = await requireUserId();

    const [templatesRes, columnsRes, itemsRes] = await Promise.all([
      supabase.from('items').select('*').eq('user_id', userId).eq('is_template', true),
      supabase.from('columns').select('*').eq('user_id', userId).order('position', { ascending: true }),
      fetchItems(userId),
    ]);
    if (columnsRes.error) throw columnsRes.error;
    if (itemsRes.error) throw itemsRes.error;

    let columns = (columnsRes.data || []) as DbColumn[];
    let items = (itemsRes.data || []) as DbItem[];

    // Usuario nuevo: columnas por defecto
    if (columns.length === 0) {
      const { data: newCols } = await supabase.from('columns').insert([
        { user_id: userId, title: 'HOY [FOCUS]', position: 0 },
        { user_id: userId, title: 'ESTA SEMANA', position: 1 },
      ]).select();
      columns = (newCols || []) as DbColumn[];
    }

    // Solo se recargan los ítems si el generador creó algo (una vez al día)
    if (await generateRoutineTasks(userId, (templatesRes.data || []) as DbItem[], columns)) {
      const { data, error } = await fetchItems(userId);
      if (error) throw error;
      items = (data || []) as DbItem[];
    }

    return { columns, items };
  },

  // --- CRUD BÁSICO ---
  createColumn: async (title: string, position: number) => {
    const userId = await requireUserId();
    return await supabase.from('columns').insert({ user_id: userId, title, position }).select().single();
  },

  createItem: async (item: Partial<DbItem>) => {
    const userId = await requireUserId();
    return await supabase.from('items').insert({
      user_id: userId,
      title: item.title,
      description: item.description,
      type: item.type,
      column_id: item.column_id,
      tag: item.tag,
      linked_goal_id: item.linked_goal_id,
      due_date: item.due_date,
      status: 'pending',
      is_template: item.is_template || false,
      recurrence: item.recurrence || 'none',
      recurrence_day: item.recurrence_day,
      last_generated: item.last_generated
    }).select().single();
  },

  updateItem: async (id: string, updates: Partial<DbItem>) => {
    return await supabase.from('items').update(updates).eq('id', id);
  },

  // Tachar/destachar pasa por una función de la base (toggle_task_status)
  // que además suma o resta XP y recalcula el nivel en el perfil.
  toggleTaskStatus: async (id: string, targetStatus: 'pending' | 'done') => {
    return await supabase.rpc('toggle_task_status', {
      task_id: id,
      target_status: targetStatus
    });
  },

  updateColumn: async (id: string, title: string) => {
    return await supabase.from('columns').update({ title }).eq('id', id);
  },

  deleteItem: async (id: string) => {
    return await supabase.from('items').delete().eq('id', id);
  },

  deleteColumn: async (id: string) => {
    return await supabase.from('columns').delete().eq('id', id);
  },

  getProfile: async (): Promise<DbProfile | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data as DbProfile | null;
  },

  updateProfile: async (updates: Partial<Omit<DbProfile, 'id'>>) => {
    const userId = await requireUserId();
    return await supabase.from('profiles').update(updates).eq('id', userId);
  },

  getRoutines: async (): Promise<DbItem[]> => {
    const userId = await requireUserId();
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('is_template', true);
    return (data || []) as DbItem[];
  },

  // EFICIENCIA JUSTA: solo cuentan las tareas EXIGIBLES.
  // Quedan fuera: objetivos, compras (shopping list) y tareas programadas
  // a futuro — hacer una tarea el día que la estipulaste no baja la eficacia.
  getEfficiencyStats: async (): Promise<EfficiencyStats> => {
    const userId = await requireUserId();
    const [itemsRes, colsRes] = await Promise.all([
      supabase.from('items').select('status, due_date, tag, type, column_id').eq('user_id', userId).eq('is_template', false),
      supabase.from('columns').select('id, title').eq('user_id', userId),
    ]);
    const items = (itemsRes.data || []) as Pick<DbItem, 'status' | 'due_date' | 'tag' | 'type' | 'column_id'>[];
    const shoppingColIds = new Set((colsRes.data || []).filter(c => isShoppingTitle(c.title)).map(c => c.id));
    const todayStr = localDayKey();

    const relevant = items.filter(i =>
      i.type === 'task' &&
      !shoppingColIds.has(i.column_id) &&
      (i.tag || '').toUpperCase() !== 'COMPRA'
    );
    const done = relevant.filter(i => i.status === 'done').length;
    const pending = relevant.filter(i => {
      if (i.status === 'done') return false;
      const key = dayKeyOf(i.due_date);
      return key === null || key <= todayStr; // sin fecha = exigible hoy; las futuras no cuentan
    }).length;
    const total = done + pending;
    const percent = total > 0 ? Math.round((done / total) * 100) : 100; // sin pendientes exigibles = al día
    return { total, done, pending, percent };
  },
};
