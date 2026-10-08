import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { useAreas } from '../../state/ZenStore';

// Chip de filtro (etiqueta corta en mayúsculas)
export function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Fila de chips de área para filtrar una vista. null = todas.
export default function AreaChips({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { activas } = useAreas();
  if (activas.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Todas" active={value === null} onPress={() => onChange(null)} />
      {activas.map(a => (
        <Chip key={a.id} label={a.nombre} color={a.color} active={value === a.id} onPress={() => onChange(value === a.id ? null : a.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accentLight, backgroundColor: 'rgba(139,92,246,0.16)' },
  chipText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  chipTextActive: { color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
