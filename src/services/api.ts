import { supabase } from './supabase';
import { format } from 'date-fns';

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
    // 1. Obtención de sesión segura
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Usuario no autenticado");

    // 2. Control del Timezone local con date-fns
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = new Date();
    const currentDayOfWeek = today.getDay(); 
    const currentDayOfMonth = today.getDate(); 

    // GENERADOR AUTOMÁTICO (Optimizado con Batching)
    const { data: templates } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_template', true);

    if (templates && templates.length > 0) {
      const { data: firstColumn } = await supabase
        .from('columns')
        .select('id')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstColumn) {
        const itemsToInsert: any[] = [];
        const templatesToUpdate: string[] = [];

        // Evaluación en memoria (Sin llamadas de red)
        for (const template of templates) {
          if (template.last_generated === todayStr) continue;

          let shouldGenerate = false;
          if (template.recurrence === 'daily') shouldGenerate = true;
          else if (template.recurrence === 'weekly' && template.recurrence_day === currentDayOfWeek) shouldGenerate = true;
          else if (template.recurrence === 'monthly' && template.recurrence_day === currentDayOfMonth) shouldGenerate = true;

          if (shouldGenerate) {
            console.log(`Cola de generación lista para: ${template.title}`);
            itemsToInsert.push({
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
            templatesToUpdate.push(template.id);
          }
        }

        // Ejecución Batch: 1 petición de inserción y 1 de actualización masiva
        if (itemsToInsert.length > 0) {
          await supabase.from('items').insert(itemsToInsert);
          await supabase.from('items').update({ last_generated: todayStr }).in('id', templatesToUpdate);
        }
      }
    }

    // CARGA NORMAL (Defensiva)
    let { data: columns, error: colError } = await supabase
      .from('columns')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });
      
    if (colError) throw colError;

    // Creación de columnas por defecto si es usuario nuevo
    if (!columns || columns.length === 0) {
      const defaultCols = [
        { user_id: user.id, title: 'HOY [FOCUS]', position: 0 }, 
        { user_id: user.id, title: 'ESTA SEMANA', position: 1 }
      ];
      const { data: newCols } = await supabase.from('columns').insert(defaultCols).select();
      columns = newCols;
    }

    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_template', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
      
    if (itemError) throw itemError;

    return { columns, items };
  },

  // --- CRUD BÁSICO ---
  createColumn: async (title: string, position: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    return await supabase.from('columns').insert({ user_id: user.id, title, position }).select().single();
  },

  createItem: async (item: Partial<DbItem>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
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

  // 🔥 FUNCIÓN ROBUSTA PARA CHECK/UNCHECK (RPC) 🔥
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

  getProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); 
    return data;
  },

  updateProfile: async (updates: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    return await supabase.from('profiles').update(updates).eq('id', user.id);
  },
  
  getRoutines: async () => {
    // 🔒 Añadido chequeo de usuario para programación defensiva
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_template', true);
      
    return data || [];
  }
};