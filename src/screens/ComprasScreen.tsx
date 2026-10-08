import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, space } from '../theme/tokens';
import { useZen } from '../state/ZenStore';
import { Item } from '../domain/types';
import { matchesFilter } from '../domain/sections';
import ScreenHeader, { EmptyState } from '../components/ui/ScreenHeader';
import AreaChips from '../components/ui/AreaChips';
import { Input } from '../components/ui/Fields';
import ItemRow from '../components/items/ItemRow';
import ItemFormSheet from '../components/items/ItemFormSheet';
import ItemOptionsSheet from '../components/items/ItemOptionsSheet';

// Compras (decisión 2b): ítems tipo compra. Agregar = escribir y Enter.
// Marcar comprado los oculta con Deshacer (igual que completar una tarea).
export default function ComprasScreen() {
  const { items, addItem, editItem } = useZen();
  const [area, setArea] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState<Item | null>(null);
  const [opciones, setOpciones] = useState<Item | null>(null);

  const compras = useMemo(
    () => items.filter(i => i.tipo === 'compra' && matchesFilter(i, area, ''))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [items, area],
  );

  const agregar = async () => {
    const titulo = nuevo.trim();
    if (!titulo) return;
    setNuevo('');
    // Con un chip activo, la compra nueva queda en esa área
    await addItem({ tipo: 'compra', titulo, area_id: area });
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Compras" subtitle={compras.length ? `${compras.length} pendiente${compras.length === 1 ? '' : 's'}` : undefined} />
      <View style={styles.addRow}>
        <Input
          style={{ flex: 1 }}
          value={nuevo}
          onChangeText={setNuevo}
          placeholder="Agregar compra"
          returnKeyType="done"
          onSubmitEditing={agregar}
          blurOnSubmit={false}
          accessibilityLabel="Agregar compra"
        />
        <TouchableOpacity style={[styles.addBtn, !nuevo.trim() && { opacity: 0.4 }]} onPress={agregar} disabled={!nuevo.trim()} accessibilityLabel="Agregar">
          <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View><AreaChips value={area} onChange={setArea} /></View>

      <FlatList
        data={compras}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => <ItemRow item={item} showDate={false} onEdit={setEditando} onOptions={setOpciones} />}
        ListEmptyComponent={<EmptyState icon="cart-outline" text={area ? 'No hay compras pendientes en esta área.' : 'No hay nada pendiente por comprar.'} />}
      />

      <ItemFormSheet
        visible={!!editando}
        item={editando}
        title="Editar compra"
        onClose={() => setEditando(null)}
        onSubmit={input => { if (editando) editItem(editando, input); setEditando(null); }}
      />
      <ItemOptionsSheet item={opciones} onClose={() => setOpciones(null)} onEdit={setEditando} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  addBtn: { width: 44, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 120, flexGrow: 1 },
});
