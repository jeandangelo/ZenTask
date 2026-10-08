import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme/tokens';
import { useZen } from '../state/ZenStore';
import { Entrada, Item } from '../domain/types';
import { groupBySection, matchesFilter, ORDERED_SECTIONS, SECTION_TITLES, SectionKey } from '../domain/sections';
import { localDayKey } from '../domain/dates';
import ScreenHeader, { EmptyState, SectionLabel } from '../components/ui/ScreenHeader';
import AreaChips from '../components/ui/AreaChips';
import { Input } from '../components/ui/Fields';
import ItemRow from '../components/items/ItemRow';
import ItemFormSheet from '../components/items/ItemFormSheet';
import ItemOptionsSheet from '../components/items/ItemOptionsSheet';
import EntradaSheet from '../components/items/EntradaSheet';

// Tareas en modo lista (decisión 5): Sin ordenar (Buzón) · Vencidas · Hoy ·
// Pronto (7 días) · Más adelante · Sin fecha. Las compras van en su pestaña.
// El modo calendario llega en la etapa 4.

type Fila = { kind: 'item'; item: Item } | { kind: 'entrada'; entrada: Entrada };
type Seccion = { key: SectionKey | 'sin_ordenar'; title: string; data: Fila[] };

export default function TareasScreen() {
  const { items, entradas, addItem, editItem } = useZen();
  const [area, setArea] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [query, setQuery] = useState('');
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [opciones, setOpciones] = useState<{ item: Item; view: 'menu' | 'reprogramar' } | null>(null);
  const [ordenando, setOrdenando] = useState<Entrada | null>(null);

  const today = localDayKey();
  const secciones = useMemo<Seccion[]>(() => {
    const tareas = items.filter(i => i.tipo !== 'compra' && matchesFilter(i, area, query));
    const grupos = groupBySection(tareas, today);
    // Las entradas no tienen área: con un chip activo no se muestran
    const sinOrdenar = area ? [] : entradas
      .filter(e => e.estado === 'sin_ordenar' && e.texto.toLowerCase().includes(query.trim().toLowerCase()))
      .map(e => ({ kind: 'entrada' as const, entrada: e }));
    return [
      { key: 'sin_ordenar' as const, title: 'Sin ordenar', data: sinOrdenar },
      ...ORDERED_SECTIONS.map(k => ({ key: k, title: SECTION_TITLES[k], data: grupos[k].map(item => ({ kind: 'item' as const, item })) })),
    ].filter(s => s.data.length > 0);
  }, [items, entradas, area, query, today]);

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Tareas"
        actions={[{ icon: 'magnify', label: 'Buscar', active: buscando, onPress: () => { setBuscando(b => !b); setQuery(''); } }]}
      />
      {buscando && (
        <View style={styles.search}>
          <Input value={query} onChangeText={setQuery} placeholder="Buscar en tareas" autoFocus accessibilityLabel="Buscar" />
        </View>
      )}
      <View><AreaChips value={area} onChange={setArea} /></View>

      <SectionList
        sections={secciones}
        keyExtractor={f => (f.kind === 'item' ? f.item.id : f.entrada.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <SectionLabel
            title={section.title}
            count={section.data.length}
            color={section.key === 'vencidas' ? colors.danger : section.key === 'sin_ordenar' ? colors.accentLight : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item: fila, section }) => (
          <View style={styles.rowWrap}>
            {fila.kind === 'entrada' ? (
              <TouchableOpacity style={styles.entrada} onPress={() => setOrdenando(fila.entrada)}>
                <MaterialCommunityIcons name="tray-arrow-down" size={18} color={colors.accentLight} />
                <Text style={styles.entradaText} numberOfLines={2}>{fila.entrada.texto}</Text>
                <Text style={styles.ordenar}>Ordenar</Text>
              </TouchableOpacity>
            ) : (
              <ItemRow
                item={fila.item}
                showDate={section.key !== 'hoy'}
                onEdit={setEditando}
                onOptions={it => setOpciones({ item: it, view: 'menu' })}
                onReprogramar={section.key === 'vencidas' ? it => setOpciones({ item: it, view: 'reprogramar' }) : undefined}
              />
            )}
          </View>
        )}
        ListEmptyComponent={
          query || area
            ? <EmptyState icon="magnify" text="Nada coincide con el filtro." />
            : <EmptyState icon="checkbox-marked-circle-outline" text="Todo al día. Crea una tarea con + o captura algo desde Inicio." />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreando(true)} accessibilityLabel="Nueva tarea">
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <ItemFormSheet
        visible={creando}
        title="Nueva tarea"
        initial={area ? { area_id: area } : undefined}
        onClose={() => setCreando(false)}
        onSubmit={async input => { setCreando(false); await addItem({ tipo: 'tarea', ...input }); }}
      />
      <ItemFormSheet
        visible={!!editando}
        item={editando}
        title="Editar"
        onClose={() => setEditando(null)}
        onSubmit={input => { if (editando) editItem(editando, input); setEditando(null); }}
      />
      <ItemOptionsSheet
        item={opciones?.item ?? null}
        initialView={opciones?.view}
        onClose={() => setOpciones(null)}
        onEdit={setEditando}
      />
      <EntradaSheet entrada={ordenando} onClose={() => setOrdenando(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  list: { paddingBottom: 120, flexGrow: 1 },
  rowWrap: { paddingHorizontal: space.lg },
  entrada: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  entradaText: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  ordenar: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 13 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
