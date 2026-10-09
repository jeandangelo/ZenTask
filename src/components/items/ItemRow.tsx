import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Item } from '../../domain/types';
import { friendlyDay, localDayKey, shortTime } from '../../domain/dates';
import { useAreas, useZen } from '../../state/ZenStore';
import SwipeRow, { wasSwiping } from '../ui/SwipeRow';

// Fila de un ítem: check a la izquierda, tocar = editar, ⋯ = menú.
// El color del área va como barra fina a la izquierda (color = área).
export default function ItemRow({ item, onEdit, onOptions, onReprogramar, showDate = true }: {
  item: Item;
  onEdit: (item: Item) => void;
  onOptions: (item: Item) => void;
  onReprogramar?: (item: Item) => void; // botón rápido (vencidas)
  showDate?: boolean;
}) {
  const { complete, remove, rutinas, objetivos } = useZen();
  const { byId } = useAreas();
  const area = item.area_id ? byId.get(item.area_id) : undefined;
  const rutina = item.rutina_id ? rutinas.find(r => r.id === item.rutina_id) : undefined;
  const marcable = rutina ? rutina.marcable : true;
  const objetivo = item.objetivo_id ? objetivos.find(o => o.id === item.objetivo_id) : undefined;
  const today = localDayKey();
  const vencida = !!item.fecha && item.fecha < today;
  // Toques que llegan justo después de deslizar no cuentan (ver SwipeRow)
  const lastSwipeAt = useRef(0);
  const tap = (fn: () => void) => () => { if (!wasSwiping(lastSwipeAt)) fn(); };

  const meta = [
    showDate && item.fecha ? friendlyDay(item.fecha, today) : null,
    shortTime(item.hora_inicio),
    area?.nombre,
    objetivo ? `→ ${objetivo.titulo}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <SwipeRow
      onSwipeLeft={() => remove(item)}
      onSwipeRight={marcable ? () => complete(item) : undefined}
      rightLabel={item.tipo === 'compra' ? 'Comprado' : 'Completar'}
      lastSwipeAt={lastSwipeAt}
    >
      <TouchableOpacity style={styles.row} onPress={tap(() => onEdit(item))} activeOpacity={0.7}>
        <View style={[styles.areaBar, { backgroundColor: area?.color ?? 'transparent' }]} />
        {marcable ? (
          <TouchableOpacity
            onPress={tap(() => complete(item))}
            style={styles.checkHit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="checkbox"
            accessibilityLabel={`Completar ${item.titulo}`}
          >
            {/* Rutina = círculo punteado; tarea/compra = círculo sólido (estilo = tipo) */}
            <View style={[styles.check, rutina && styles.checkRutina]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.checkHit}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textFaint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{item.titulo}</Text>
          {(meta || rutina || item.tipo !== 'tarea') ? (
            <View style={styles.metaRow}>
              {rutina && <MaterialCommunityIcons name="repeat" size={12} color={colors.textMuted} />}
              {item.tipo === 'compra' && <MaterialCommunityIcons name="cart-outline" size={12} color={colors.textMuted} />}
              {item.tipo === 'evento' && <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={colors.textMuted} />}
              {meta ? <Text style={[styles.meta, vencida && { color: colors.danger }]} numberOfLines={1}>{meta}</Text> : null}
            </View>
          ) : null}
        </View>
        {onReprogramar && (
          <TouchableOpacity
            onPress={tap(() => onReprogramar(item))}
            style={styles.more}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityLabel={`Reprogramar ${item.titulo}`}
          >
            <MaterialCommunityIcons name="calendar-arrow-right" size={20} color={colors.accentLight} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={tap(() => onOptions(item))}
          style={styles.more}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Opciones de ${item.titulo}`}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, paddingVertical: space.md, paddingRight: space.md,
    borderRadius: radius.md, overflow: 'hidden',
  },
  areaBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  checkHit: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.metal },
  checkRutina: { borderStyle: 'dashed' },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, flexShrink: 1 },
  more: { padding: 4 },
});
