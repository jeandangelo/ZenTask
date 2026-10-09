import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isAuthError, Snapshot } from '../services/api';
import { notify } from '../services/dialogs';
import { useToast } from '../components/ui/Toast';
import { localDayKey } from '../domain/dates';
import { interpretar } from '../domain/rules';
import { Area, Entrada, Item, ItemInput, Objetivo, Perfil, Recurrencia } from '../domain/types';

// Estado compartido de la app: los datos de la cuenta y todas las acciones.
// Patrón "optimista": la pantalla cambia al instante y luego se guarda en
// la base; si la base falla, se avisa y se recarga desde el servidor.

const EMPTY: Snapshot = { areas: [], items: [], entradas: [], objetivos: [], rutinas: [], perfil: null };
const XP_POR_ITEM = 10;

const useZenState = (onAuthLost: () => void) => {
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const reload = useCallback(async () => {
    try {
      setData(await api.loadAll());
    } catch (e) {
      if (isAuthError(e)) onAuthLost();
      else notify('No se pudo cargar', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onAuthLost]);

  useEffect(() => { reload(); }, [reload]);

  // Ejecuta la escritura en la base; si falla, avisa y vuelve al estado real
  const persist = useCallback(async (op: () => Promise<unknown>) => {
    try {
      await op();
    } catch (e) {
      notify('No se pudo guardar', e instanceof Error ? e.message : String(e));
      reload();
    }
  }, [reload]);

  const patch = (fn: (d: Snapshot) => Partial<Snapshot>) => setData(d => ({ ...d, ...fn(d) }));
  const upsertItem = (it: Item) => patch(d => ({ items: [...d.items.filter(i => i.id !== it.id), it] }));
  const dropItem = (id: string) => patch(d => ({ items: d.items.filter(i => i.id !== id) }));
  const changeXp = (delta: number) => patch(d => {
    if (!d.perfil) return {};
    const xp = d.perfil.xp_points + delta;
    return { perfil: { ...d.perfil, xp_points: xp, level: Math.max(d.perfil.level, Math.floor(xp / 100) + 1) } };
  });

  // ── Ítems ──────────────────────────────────────────────────────────────────
  const addItem = async (input: ItemInput & { entrada_id?: string }) => {
    try {
      const it = await api.createItem(input);
      upsertItem(it);
      return it;
    } catch (e) {
      notify('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const editItem = (item: Item, changes: ItemInput) => {
    upsertItem({ ...item, ...changes } as Item);
    persist(() => api.updateItem(item.id, changes));
  };

  // Completar: se oculta con Deshacer (decisión 9). +10 XP; el nivel no baja.
  const complete = (item: Item) => {
    const nivelAntes = data.perfil?.level ?? 1;
    const xpDespues = (data.perfil?.xp_points ?? 0) + XP_POR_ITEM;
    const subeNivel = Math.floor(xpDespues / 100) + 1 > nivelAntes;
    dropItem(item.id);
    changeXp(XP_POR_ITEM);
    persist(() => api.setCompleted(item.id, true));
    toast({
      message: subeNivel
        ? `¡Subiste a nivel ${Math.floor(xpDespues / 100) + 1}! · +${XP_POR_ITEM} XP`
        : `${item.tipo === 'compra' ? 'Comprado' : 'Completada'} · +${XP_POR_ITEM} XP`,
      actionLabel: 'Deshacer',
      onAction: () => {
        upsertItem(item);
        changeXp(-XP_POR_ITEM);
        persist(() => api.setCompleted(item.id, false));
      },
    });
  };

  // Eliminar: borrado lógico, sin confirmación, con Deshacer
  const remove = (item: Item) => {
    dropItem(item.id);
    persist(() => api.deleteItem(item.id));
    toast({
      message: 'Eliminada',
      actionLabel: 'Deshacer',
      onAction: () => { upsertItem(item); persist(() => api.restoreItem(item.id)); },
    });
  };

  const reprogramar = (item: Item, fecha: string | null) => {
    const estabaVencida = !!item.fecha && item.fecha < localDayKey() && !item.rutina_id;
    upsertItem({ ...item, fecha, hora_inicio: fecha ? item.hora_inicio : null });
    persist(() => api.reprogramar(item, fecha, estabaVencida));
    toast({ message: fecha ? 'Reprogramada' : 'Sin fecha' });
  };

  const duplicate = async (item: Item) => {
    const copia = await addItem({
      tipo: item.tipo, titulo: item.titulo, notas: item.notas, area_id: item.area_id,
      fecha: item.fecha, hora_inicio: item.hora_inicio, duracion_min: item.duracion_min, objetivo_id: item.objetivo_id,
    });
    if (copia) toast({ message: 'Duplicada' });
  };

  const convertToRutina = async (item: Item, recurrencia: Recurrencia) => {
    try {
      const rutina = await api.convertToRutina(item, recurrencia);
      const dia = item.fecha ?? localDayKey();
      patch(d => ({ rutinas: [...d.rutinas, rutina] }));
      upsertItem({ ...item, rutina_id: rutina.id, ocurrencia_fecha: dia, fecha: dia });
      toast({ message: 'Ahora es una rutina' });
    } catch (e) {
      notify('No se pudo convertir', e instanceof Error ? e.message : String(e));
    }
  };

  // ── Entradas (Home / Buzón) ────────────────────────────────────────────────
  // Capturar (etapa 2): la entrada se guarda SIEMPRE primero (que nada se
  // pierda); después las reglas intentan interpretarla. Si reconocen algo,
  // crean los ítems y la entrada queda como procesada; si no, queda en
  // Sin ordenar. Devuelve el resumen de lo creado, o null.
  const capture = async (texto: string, origen: 'texto' | 'voz' = 'texto'): Promise<{ ok: boolean; resumen: string | null }> => {
    let entrada: Entrada;
    try {
      entrada = await api.createEntrada(texto, origen);
      patch(d => ({ entradas: [entrada, ...d.entradas] }));
    } catch (e) {
      notify('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return { ok: false, resumen: null };
    }
    const activas = data.areas.filter(a => !a.archivada_at);
    const interp = interpretar(texto, { areas: activas });
    if (!interp) return { ok: true, resumen: null };
    try {
      const creados: Item[] = [];
      for (const input of interp.items) creados.push(await api.createItem({ ...input, entrada_id: entrada.id }));
      patch(d => ({ items: [...d.items, ...creados] }));
      setEntradaEstado(entrada, 'procesada', interp.reglas.join(','));
      return { ok: true, resumen: interp.resumen };
    } catch (e) {
      // La entrada ya está guardada: queda en Sin ordenar para ordenarla a mano
      notify('Guardado en Sin ordenar', 'No se pudo crear automáticamente: ' + (e instanceof Error ? e.message : String(e)));
      return { ok: true, resumen: null };
    }
  };

  const setEntradaEstado = (entrada: Entrada, estado: Entrada['estado'], regla: string | null = null) => {
    const actualizada = { ...entrada, estado, regla, procesada_at: estado === 'sin_ordenar' ? null : new Date().toISOString() };
    patch(d => ({ entradas: d.entradas.map(e => (e.id === entrada.id ? actualizada : e)) }));
    persist(() => api.setEntradaEstado(entrada.id, estado, regla));
  };

  // Deshacer el resultado de una entrada: sus ítems se eliminan (borrado
  // lógico) y el texto vuelve a Sin ordenar, para no perderlo.
  const deshacerEntrada = (entrada: Entrada) => {
    const suyos = data.items.filter(i => i.entrada_id === entrada.id);
    patch(d => ({ items: d.items.filter(i => i.entrada_id !== entrada.id) }));
    persist(async () => { for (const it of suyos) await api.deleteItem(it.id); });
    setEntradaEstado(entrada, 'sin_ordenar');
    toast({ message: 'Deshecho: quedó en Sin ordenar' });
  };

  const descartar = (entrada: Entrada) => {
    setEntradaEstado(entrada, 'descartada');
    toast({ message: 'Descartada', actionLabel: 'Deshacer', onAction: () => setEntradaEstado(entrada, 'sin_ordenar') });
  };

  // Ordenar: la entrada se convierte en un ítem y queda como procesada
  const ordenar = async (entrada: Entrada, input: ItemInput) => {
    const it = await addItem({ ...input, entrada_id: entrada.id });
    if (it) setEntradaEstado(entrada, 'procesada');
    return it;
  };

  // ── Áreas ──────────────────────────────────────────────────────────────────
  const createArea = async (nombre: string, color: string) => {
    try {
      const orden = Math.max(-1, ...data.areas.map(a => a.orden)) + 1;
      const a = await api.createArea({ nombre: nombre.trim(), color, orden });
      patch(d => ({ areas: [...d.areas, a] }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify('No se pudo crear el área', msg.includes('areas_nombre_activo_unico') ? 'Ya existe un área con ese nombre.' : msg);
    }
  };

  const updateArea = (area: Area, changes: Partial<Omit<Area, 'id'>>) => {
    patch(d => ({ areas: d.areas.map(a => (a.id === area.id ? { ...a, ...changes } : a)) }));
    persist(() => api.updateArea(area.id, changes));
  };

  // Mover un área una posición arriba o abajo (intercambia el orden)
  const moveArea = (area: Area, dir: -1 | 1) => {
    const activas = data.areas.filter(a => !a.archivada_at).sort((a, b) => a.orden - b.orden);
    const i = activas.findIndex(a => a.id === area.id);
    const otra = activas[i + dir];
    if (!otra) return;
    updateArea(area, { orden: otra.orden });
    updateArea(otra, { orden: area.orden });
  };

  // ── Objetivos ──────────────────────────────────────────────────────────────
  const createObjetivo = async (titulo: string) => {
    try {
      const o = await api.createObjetivo(titulo.trim());
      patch(d => ({ objetivos: [...d.objetivos, o] }));
      return o;
    } catch (e) {
      notify('No se pudo crear el objetivo', e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const updateObjetivo = (o: Objetivo, changes: Partial<Pick<Objetivo, 'titulo' | 'notas' | 'area_id'>>) => {
    patch(d => ({ objetivos: d.objetivos.map(x => (x.id === o.id ? { ...x, ...changes } : x)) }));
    persist(() => api.updateObjetivo(o.id, changes));
  };

  const deleteObjetivo = (o: Objetivo) => {
    patch(d => ({
      objetivos: d.objetivos.filter(x => x.id !== o.id),
      items: d.items.map(i => (i.objetivo_id === o.id ? { ...i, objetivo_id: null } : i)),
    }));
    persist(() => api.deleteObjetivo(o.id));
  };

  // ── Perfil ─────────────────────────────────────────────────────────────────
  const updatePerfil = (changes: Partial<Pick<Perfil, 'username' | 'avatar_url'>>) => {
    patch(d => ({ perfil: d.perfil ? { ...d.perfil, ...changes } : d.perfil }));
    persist(() => api.updatePerfil(changes));
  };

  return {
    ...data, loading, reload,
    addItem, editItem, complete, remove, reprogramar, duplicate, convertToRutina,
    capture, descartar, ordenar, deshacerEntrada,
    createArea, updateArea, moveArea,
    createObjetivo, updateObjetivo, deleteObjetivo,
    updatePerfil,
  };
};

type ZenStore = ReturnType<typeof useZenState>;
const StoreContext = createContext<ZenStore | null>(null);

export function ZenStoreProvider({ children, onAuthLost }: { children: React.ReactNode; onAuthLost: () => void }) {
  const store = useZenState(onAuthLost);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export const useZen = (): ZenStore => {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useZen fuera de ZenStoreProvider');
  return s;
};

// Áreas activas en su orden, y un mapa id → área para pintar chips y bordes
export const useAreas = () => {
  const { areas } = useZen();
  return useMemo(() => {
    const activas = areas.filter(a => !a.archivada_at).sort((a, b) => a.orden - b.orden);
    const byId = new Map(areas.map(a => [a.id, a]));
    return { activas, byId };
  }, [areas]);
};
