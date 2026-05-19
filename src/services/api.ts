import { supabase } from './supabase';

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

export const api = {
  
  getDashboardData: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("No usuario");

    // GENERADOR AUTOMÁTICO
    const { data: templates } = await supabase
      .from('items').select('*').eq('user_id', user.id).eq('is_template', true);

    if (templates && templates.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; 
      const currentDayOfWeek = today.getDay(); 
      const currentDayOfMonth = today.getDate(); 

      const { data: firstColumn } = await supabase
        .from('columns').select('id').eq('user_id', user.id).order('position', { ascending: true }).limit(1).maybeSingle();

      if (firstColumn) {
        for (const template of templates) {
          let shouldGenerate = false;
          if (template.last_generated === todayStr) {
            shouldGenerate = false;
          } else {
            if (template.recurrence === 'daily') shouldGenerate = true;
            else if (template.recurrence === 'weekly' && template.recurrence_day === currentDayOfWeek) shouldGenerate = true;
            else if (template.recurrence === 'monthly' && template.recurrence_day === currentDayOfMonth) shouldGenerate = true;
          }

          if (shouldGenerate) {
            console.log(`Generando rutina: ${template.title}`);
            await supabase.from('items').insert({
              user_id: user.id,
              column_id: firstColumn.id,
              type: template.type,
              title: template.title,
              description: template.description,
              tag: template.tag,
              linked_goal_id: template.linked_goal_id,
              status: 'pending',
              is_template: false,
              recurrence: 'none',
              due_date: new Date().toISOString()
            });
            await supabase.from('items').update({ last_generated: todayStr }).eq('id', template.id);
          }
        }
      }
    }

    // CARGA NORMAL
    let { data: columns, error: colError } = await supabase.from('columns').select('*').order('position', { ascending: true });
    if (colError) throw colError;

    if (!columns || columns.length === 0) {
      const defaultCols = [{ user_id: user.id, title: 'HOY [FOCUS]', position: 0 }, { user_id: user.id, title: 'ESTA SEMANA', position: 1 }];
      const { data: newCols } = await supabase.from('columns').insert(defaultCols).select();
      columns = newCols;
    }

    const { data: items, error: itemError } = await supabase
      .from('items').select('*').eq('is_template', false).order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
    if (itemError) throw itemError;

    return { columns, items };
  },

  // --- CRUD BÁSICO ---
  createColumn: async (title: string, position: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user");
    return await supabase.from('columns').insert({ user_id: user.id, title, position }).select().single();
  },

  createItem: async (item: Partial<DbItem>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user");
    return await supabase.from('items').insert({
      user_id: user.id,
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

  // 🔥 NUEVA FUNCIÓN ROBUSTA PARA CHECK/UNCHECK 🔥
  toggleTaskStatus: async (id: string, targetStatus: 'pending' | 'done') => {
    // Llamamos a la función RPC segura del servidor
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

  getProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); 
    return data;
  },

  updateProfile: async (updates: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No usuario");
    return await supabase.from('profiles').update(updates).eq('id', user.id);
  },
  
  getRoutines: async () => {
    const { data } = await supabase.from('items').select('*').eq('is_template', true);
    return data || [];
  }
};