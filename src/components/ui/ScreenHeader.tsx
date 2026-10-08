import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, space, type } from '../../theme/tokens';

// Encabezado de cada pestaña: título grande + acciones a la derecha
export default function ScreenHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; onPress: () => void; active?: boolean }[];
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={type.title}>{title}</Text>
        {subtitle && <Text style={[type.meta, { marginTop: 2 }]}>{subtitle}</Text>}
      </View>
      {actions?.map(a => (
        <TouchableOpacity key={a.label} onPress={a.onPress} style={styles.action} accessibilityLabel={a.label} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name={a.icon} size={22} color={a.active ? colors.accentLight : colors.metalLight} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Encabezado de sección dentro de una lista ("HOY · 3")
export function SectionLabel({ title, count, color }: { title: string; count?: number; color?: string }) {
  return (
    <View style={styles.section}>
      <Text style={[type.label, color ? { color } : null]}>{title}</Text>
      {count != null && <Text style={[type.label, { color: colors.textFaint }]}>{count}</Text>}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={36} color={colors.textFaint} />
      <Text style={[type.meta, { textAlign: 'center', maxWidth: 280 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  action: { padding: 4 },
  section: { flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: 64, paddingHorizontal: space.xl },
});
