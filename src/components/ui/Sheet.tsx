import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

// Hoja que sube desde abajo (menús, formularios, selectores). Tocar fuera
// la cierra. En pantallas anchas (web de escritorio) queda centrada.
export function Sheet({ visible, onClose, title, children }: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
          <View style={styles.handle} />
          {title && <Text style={[type.sheetTitle, styles.title]}>{title}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Opción de un menú dentro de una hoja
export function SheetOption({ icon, label, onPress, danger, selected, color }: {
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  selected?: boolean;
  color?: string; // punto de color (áreas)
}) {
  const tint = danger ? colors.danger : selected ? colors.accentLight : colors.text;
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} accessibilityRole="button">
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> :
        icon ? <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.danger : colors.metal} /> : null}
      <Text style={[styles.optionText, { color: tint }]}>{label}</Text>
      {selected && <MaterialCommunityIcons name="check" size={18} color={colors.accentLight} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.elevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg, paddingTop: space.sm, width: '100%', maxWidth: 560, alignSelf: 'center',
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
  title: { marginBottom: space.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 15 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
