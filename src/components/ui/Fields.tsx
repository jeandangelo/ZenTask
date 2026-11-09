import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TextInputProps, TextStyle, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { friendlyDay, localDayKey, shortTime } from '../../domain/dates';
import { textoDuracion } from '../../domain/calendar';

// Campos de formulario con el estilo de la app. Fecha y hora usan el
// selector del navegador en la web (PWA) y el nativo en el celular.

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.field}>
    <Text style={[type.label, styles.label]}>{label}</Text>
    {children}
  </View>
);

// Solo web: sin el contorno naranjo/azul del navegador; el foco se marca
// con el borde de acento ('none' no existe en los tipos de RN, de ahí el cast).
export const webSinContorno = Platform.select({ web: { outlineStyle: 'none' } as unknown as TextStyle, default: {} });

export const Input = React.forwardRef<TextInput, TextInputProps>((props, ref) => {
  const [foco, setFoco] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textFaint}
      {...props}
      onFocus={e => { setFoco(true); props.onFocus?.(e); }}
      onBlur={e => { setFoco(false); props.onBlur?.(e); }}
      style={[styles.input, webSinContorno, foco && { borderColor: colors.accent }, props.multiline && { minHeight: 72, textAlignVertical: 'top' }, props.style]}
    />
  );
});

// Estilo de los <input> del navegador (fecha y hora), para que no se vean blancos
const webInputStyle: React.CSSProperties = {
  backgroundColor: colors.surface, color: colors.text, border: `1px solid ${colors.border}`,
  borderRadius: radius.sm, padding: '10px 12px', fontSize: 15, fontFamily: 'Inter_400Regular', outline: 'none',
  colorScheme: 'dark', width: '100%', boxSizing: 'border-box',
};

export function DateField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)} style={webInputStyle} />;
  }
  return (
    <View>
      <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? colors.text : colors.textFaint, fontFamily: fonts.regular }}>
          {value ? friendlyDay(value) : 'Elegir fecha'}
        </Text>
        {value && <TouchableOpacity onPress={() => onChange(null)}><MaterialCommunityIcons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>}
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={value ? parseISO(value) : new Date()}
          mode="date"
          themeVariant="dark"
          onChange={(_, d) => { setOpen(false); if (d) onChange(localDayKey(d)); }}
        />
      )}
    </View>
  );
}

export function TimeField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return <input type="time" value={shortTime(value) ?? ''} onChange={e => onChange(e.target.value || null)} style={webInputStyle} />;
  }
  return (
    <View>
      <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? colors.text : colors.textFaint, fontFamily: fonts.regular }}>{shortTime(value) ?? 'Sin hora'}</Text>
        {value && <TouchableOpacity onPress={() => onChange(null)}><MaterialCommunityIcons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>}
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={value ? parseISO(`2000-01-01T${shortTime(value)}:00`) : new Date()}
          mode="time"
          themeVariant="dark"
          onChange={(_, d) => { setOpen(false); if (d) onChange(format(d, 'HH:mm')); }}
        />
      )}
    </View>
  );
}

// Duración con opciones rápidas. "Sin duración" = un momento (levantarse):
// en el calendario se dibuja compacto, sin hora de fin. Pedido de Jean
// (9 nov): no todo dura 1 hora.
const DURACIONES = [null, 5, 15, 30, 45, 60, 90, 120];

export function DuracionField({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [otra, setOtra] = useState(!DURACIONES.includes(value));
  const pastilla = (activa: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} style={[styles.segment, activa && styles.segmentActive]} accessibilityState={{ selected: activa }}>
      <Text style={[styles.segmentText, activa && { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View>
      <View style={styles.segmented}>
        {DURACIONES.map(d => pastilla(!otra && value === d, d === null ? 'Sin duración' : textoDuracion(d), () => { setOtra(false); onChange(d); }))}
        {pastilla(otra, 'Otra', () => setOtra(true))}
      </View>
      {otra && (
        <Input
          style={{ marginTop: space.sm }}
          value={value ? String(value) : ''}
          onChangeText={t => onChange(parseInt(t.replace(/\D/g, ''), 10) || null)}
          keyboardType="number-pad"
          placeholder="Minutos"
          accessibilityLabel="Duración en minutos"
        />
      )}
      {value === null && !otra && <Text style={[type.meta, { marginTop: 6 }]}>Un momento: en el calendario se ve solo la hora de inicio.</Text>}
    </View>
  );
}

// Selector de opciones en línea (botones tipo pastilla)
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(o => (
        <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.text }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.primary, disabled && { opacity: 0.4 }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.md },
  label: { marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 15, fontFamily: fonts.regular,
  },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segmented: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  segment: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  segmentActive: { borderColor: colors.accentLight, backgroundColor: 'rgba(139,92,246,0.16)' },
  segmentText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 15 },
});
