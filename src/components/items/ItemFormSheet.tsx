import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, space } from '../../theme/tokens';
import { Item, ItemInput, TipoItem } from '../../domain/types';
import { useAreas, useZen } from '../../state/ZenStore';
import { Sheet } from '../ui/Sheet';
import { Chip } from '../ui/AreaChips';
import { DateField, Field, Input, PrimaryButton, Segmented, TimeField } from '../ui/Fields';

// Formulario de ítem (R3): por defecto SOLO el título — escribir y Enter.
// "Opciones avanzadas" despliega tipo, notas, fecha, hora, duración, área
// y objetivo. Sirve para crear, editar y ordenar entradas del Buzón.
export default function ItemFormSheet({ visible, onClose, onSubmit, item, initial, title }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: ItemInput) => void;
  item?: Item | null;               // editar
  initial?: Partial<ItemInput>;     // crear con valores iniciales
  title: string;
}) {
  const { activas } = useAreas();
  const { objetivos } = useZen();
  const [f, setF] = useState<ItemInput>({});
  const [advanced, setAdvanced] = useState(false);

  // Al abrir: carga el ítem (editar) o los valores iniciales (crear)
  useEffect(() => {
    if (!visible) return;
    const base: ItemInput = item
      ? { tipo: item.tipo, titulo: item.titulo, notas: item.notas, area_id: item.area_id, fecha: item.fecha,
          hora_inicio: item.hora_inicio, duracion_min: item.duracion_min, objetivo_id: item.objetivo_id }
      : { tipo: 'tarea', titulo: '', ...initial };
    setF(base);
    // Al editar, las avanzadas se abren solas si el ítem ya usa alguna
    setAdvanced(!!item && !!(item.notas || item.fecha || item.objetivo_id || item.duracion_min));
  }, [visible, item, initial]);

  const set = (patch: ItemInput) => setF(prev => ({ ...prev, ...patch }));
  const esCompra = f.tipo === 'compra';
  const valido = !!f.titulo?.trim();

  const submit = () => {
    if (!valido) return;
    onSubmit({
      ...f,
      titulo: f.titulo!.trim(),
      notas: f.notas?.trim() || null,
      // Sin fecha no puede haber hora (regla de la base)
      hora_inicio: f.fecha ? f.hora_inicio ?? null : null,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Input
        value={f.titulo ?? ''}
        onChangeText={t => set({ titulo: t })}
        placeholder={esCompra ? '¿Qué hay que comprar?' : '¿Qué hay que hacer?'}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel="Título"
      />

      <TouchableOpacity onPress={() => setAdvanced(a => !a)} style={styles.toggle}>
        <MaterialCommunityIcons name={advanced ? 'chevron-up' : 'tune-variant'} size={16} color={colors.textMuted} />
        <Text style={styles.toggleText}>{advanced ? 'Ocultar opciones' : 'Opciones avanzadas'}</Text>
      </TouchableOpacity>

      {advanced && (
        <View>
          {!esCompra && (
            <Field label="Tipo">
              <Segmented<TipoItem>
                options={[{ value: 'tarea', label: 'Tarea' }, { value: 'evento', label: 'Evento' }]}
                value={f.tipo === 'evento' ? 'evento' : 'tarea'}
                onChange={v => set({ tipo: v })}
              />
            </Field>
          )}
          {esCompra ? (
            // Compra con fecha = también aparece en Tareas (decisión de Jean, 9 oct)
            <Field label="Comprar antes del">
              <DateField value={f.fecha ?? null} onChange={v => set({ fecha: v })} />
            </Field>
          ) : (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Fecha"><DateField value={f.fecha ?? null} onChange={v => set({ fecha: v })} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Hora"><TimeField value={f.hora_inicio ?? null} onChange={v => set({ hora_inicio: v })} /></Field>
              </View>
            </View>
          )}
          {!esCompra && f.hora_inicio && f.fecha ? (
            <Field label="Duración (min)">
              <Input
                value={f.duracion_min ? String(f.duracion_min) : ''}
                onChangeText={t => set({ duracion_min: parseInt(t.replace(/\D/g, ''), 10) || null })}
                keyboardType="number-pad"
                placeholder="Ej. 60"
              />
            </Field>
          ) : null}
          {activas.length > 0 && (
            <Field label="Área">
              <View style={styles.wrap}>
                {activas.map(a => (
                  <Chip key={a.id} label={a.nombre} color={a.color} active={f.area_id === a.id}
                    onPress={() => set({ area_id: f.area_id === a.id ? null : a.id })} />
                ))}
              </View>
            </Field>
          )}
          {!esCompra && objetivos.length > 0 && (
            <Field label="Objetivo">
              <View style={styles.wrap}>
                {objetivos.map(o => (
                  <Chip key={o.id} label={o.titulo} active={f.objetivo_id === o.id}
                    onPress={() => set({ objetivo_id: f.objetivo_id === o.id ? null : o.id })} />
                ))}
              </View>
            </Field>
          )}
          <Field label="Notas">
            <Input value={f.notas ?? ''} onChangeText={t => set({ notas: t })} placeholder="Detalles…" multiline />
          </Field>
        </View>
      )}

      <View style={{ marginTop: space.md }}>
        <PrimaryButton label="Guardar" onPress={submit} disabled={!valido} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: space.md },
  toggleText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  row: { flexDirection: 'row', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
