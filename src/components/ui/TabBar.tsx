import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, space } from '../../theme/tokens';

// Barra inferior fija (decisión 2): Tareas · Rutinas · Inicio (centro) ·
// Compras · Perfil. Hecha a mano en vez de con @react-navigation/bottom-tabs
// porque el botón central destacado es más simple así y no suma dependencias.

export type TabKey = 'tareas' | 'rutinas' | 'home' | 'compras' | 'perfil';

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'tareas', label: 'Tareas', icon: 'checkbox-marked-circle-outline' },
  { key: 'rutinas', label: 'Rutinas', icon: 'repeat' },
  { key: 'home', label: 'Inicio', icon: 'pencil-plus-outline' },
  { key: 'compras', label: 'Compras', icon: 'cart-outline' },
  { key: 'perfil', label: 'Perfil', icon: 'account-circle-outline' },
];

export const TAB_BAR_HEIGHT = 64;

export default function TabBar({ active, onChange, badges }: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  badges?: Partial<Record<TabKey, number>>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]} accessibilityRole="tablist">
      {TABS.map(t => {
        const isActive = active === t.key;
        const isHome = t.key === 'home';
        const badge = badges?.[t.key];
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.tab}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t.label}
          >
            {isHome ? (
              <View style={[styles.homeBtn, isActive && styles.homeBtnActive]}>
                <MaterialCommunityIcons name={t.icon} size={24} color={isActive ? '#FFFFFF' : colors.metalLight} />
              </View>
            ) : (
              <View>
                <MaterialCommunityIcons name={t.icon} size={23} color={isActive ? colors.accentLight : colors.metal} />
                {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
              </View>
            )}
            {!isHome && <Text style={[styles.label, isActive && { color: colors.text }]}>{t.label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { color: colors.metal, fontFamily: fonts.medium, fontSize: 10.5 },
  homeBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.metal,
  },
  homeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accentLight },
  badge: {
    position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 9.5 },
});
