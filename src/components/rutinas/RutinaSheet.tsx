import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { ModoHorario, Recurrencia, Rutina, RutinaInput } from '../../domain/types';
import { validarRutina } from '../../domain/routines';
import { PasoInput } from '../../services/api';
import { confirmAction, notify } from '../../services/dialogs';
import { useAreas, useZen } from '../../state/ZenStore';
import { Sheet, SheetOption } from '../ui/Sheet';
import { Chip } from '../ui/AreaChips';
import { Field, Input, PrimaryButton, Segmented, TimeField } from '../ui/Fields';

// Crear o editar una rutina (etapa 3). "rutina = null" con visible = crear.

// Lunes primero, como se lee la semana en Chile; el valor es getDay()
const DIAS = [
  { v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' }, { v: 4, l: 'J' },
  { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' },
];

const VACIA: RutinaInput = {
  titulo: '', notas: null, area_id: null, recurrencia: 'diaria', dias_semana: null, dia_mes: null,
  modo_horario: 'sin_hora', hora_inicio: null, duracion_min: null, rango_inicio: null, rango_fin: null,
  marcable: true, objetivo_id: null,
};

export default function RutinaSheet({ visible, rutina, onClose }: {
  visible: boolean;
  rutina: Rutina | null;
  onClose: () => void;
}) {
  const zen = useZen();
  const { activas } = useAreas();
  const [f, setF] = useState<RutinaInput>(VACIA);
  const [pasos, setPasos] = useState<PasoInput[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (rutina) {
      const { id: _i, pausada_at: _p, created_at: _c, ...input } = rutina;
      setF(input);
      setPasos(zen.pasos.filter(p => p.rutina_id === rutina.id).sort((a, b) => a.orden - b.orden).map(p => ({ id: p.id, texto: p.texto })));
    } else {
      setF(VACIA);
      setPasos([]);
    }
  }, [visible, rutina]);

  const set = (p: Partial<RutinaInput>) => setF(prev => ({ ...prev, ...p }));

  const cambiarRecurrencia = (r: Recurrencia) => set({
    recurrencia: r,
    dias_semana: r === 'semanal' ? (f.dias_semana?.length ? f.dias_semana : [new Date().getDay()]) : null,
    dia_mes: r === 'mensual' ? (f.dia_mes ?? new Date().getDate()) : null,
  });

  const toggleDia = (d: number) => {
    const actuales = new Set(f.dias_semana ?? []);
    if (actuales.has(d)) actuales.delete(d); else actuales.add(d);
    set({ dias_semana: [...actuales].sort() });
  };

  const guardar = async () => {
    // Solo se guardan los datos del modo de horario elegido
    const input: RutinaInput = {
      ...f,
      titulo: f.titulo.trim(),
      notas: f.notas?.trim() || null,
      hora_inicio: f.modo_horario === 'fija' ? f.hora_inicio : null,
      duracion_min: f.modo_horario === 'fija' ? f.duracion_min : null,
      rango_inicio: f.modo_horario === 'flexible' ? f.rango_inicio : null,
      rango_fin: f.modo_horario === 'flexible' ? f.rango_fin : null,
    };
    const error = validarRutina(input);
    if (error) { notify('Falta algo', error); return; }
    setGuardando(true);
    const ok = rutina ? await zen.updateRutina(rutina, input, pasos) : await zen.createRutina(input, pasos);
    setGuardando(false);
    if (ok) onClose();
  };

  const pausar = async () => {
    if (!rutina) return;
    if (await zen.setRutinaPausada(rutina, !rutina.pausada_at)) onClose();
  };

  const eliminar = async () => {
    if (!rutina) return;
    if (!(await confirmAction('Eliminar rutina', `"${rutina.titulo}" deja de repetirse. Lo que ya completaste queda en tu historial.`, 'Eliminar'))) return;
    if (await zen.deleteRutina(rutina)) onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={rutina ? 'Editar rutina' : 'Nueva rutina'}>
      <Input value={f.titulo} onChangeText={t => set({ titulo: t })} placeholder="Ej. Entrenar" autoFocus={!rutina} accessibilityLabel="Nombre de la rutina" />

      <View style={{ height: space.md }} />
      <Field label="Se repite">
        <Segmented<Recurrencia>
          options={[{ value: 'diaria', label: 'Todos los días' }, { value: 'semanal', label: 'Algunos días' }, { value: 'mensual', label: 'Cada mes' }]}
          value={f.recurrencia}
          onChange={cambiarRecurrencia}
        />
      </Field>
      {f.recurrencia === 'semanal' && (
        <View style={styles.dias}>
          {DIAS.map(d => {
            const on = f.dias_semana?.includes(d.v);
            return (
              <TouchableOpacity key={d.v} onPress={() => toggleDia(d.v)} style={[styles.dia, on && styles.diaOn]} accessibilityState={{ selected: !!on }}>
                <Text style={[styles.diaText, on && { color: colors.text }]}>{d.l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {f.recurrencia === 'mensual' && (
        <Field label="Día del mes">
          <Input
            value={f.dia_mes ? String(f.dia_mes) : ''}
            onChangeText={t => set({ dia_mes: parseInt(t.replace(/\D/g, ''), 10) || null })}
            keyboardType="number-pad"
            placeholder="1 a 31"
          />
        </Field>
      )}

      <Field label="Horario">
        <Segmented<ModoHorario>
          options={[{ value: 'sin_hora', label: 'Sin hora' }, { value: 'fija', label: 'Hora fija' }, { value: 'flexible', label: 'Flexible' }]}
          value={f.modo_horario}
          onChange={v => set({ modo_horario: v })}
        />
      </Field>
      {f.modo_horario === 'fija' && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Hora"><TimeField value={f.hora_inicio} onChange={v => set({ hora_inicio: v })} /></Field></View>
          <View style={{ flex: 1 }}>
            <Field label="Duración (min)">
              <Input
                value={f.duracion_min ? String(f.duracion_min) : ''}
                onChangeText={t => set({ duracion_min: parseInt(t.replace(/\D/g, ''), 10) || null })}
                keyboardType="number-pad"
                placeholder="Ej. 60"
              />
            </Field>
          </View>
        </View>
      )}
      {f.modo_horario === 'flexible' && (
        <>
          <Text style={styles.hint}>Aparece cada día "por planificar" hasta que le pongas una hora dentro de este rango.</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Desde"><TimeField value={f.rango_inicio} onChange={v => set({ rango_inicio: v })} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Hasta"><TimeField value={f.rango_fin} onChange={v => set({ rango_fin: v })} /></Field></View>
          </View>
        </>
      )}

      <Field label="¿Se marca como hecha?">
        <Segmented<'si' | 'no'>
          options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No, solo ocupa tiempo' }]}
          value={f.marcable ? 'si' : 'no'}
          onChange={v => set({ marcable: v === 'si' })}
        />
      </Field>
      {!f.marcable && <Text style={styles.hint}>Como un turno de trabajo: aparece en tu día, pero no tiene check, no da XP ni cuenta para el cumplimiento.</Text>}

      {f.marcable && (
        <Field label="Checklist (opcional)">
          {pasos.map((p, i) => (
            <View key={p.id ?? `nuevo-${i}`} style={styles.paso}>
              <Input
                style={{ flex: 1 }}
                value={p.texto}
                onChangeText={t => setPasos(ps => ps.map((x, j) => (j === i ? { ...x, texto: t } : x)))}
                placeholder={`Paso ${i + 1}`}
                accessibilityLabel={`Paso ${i + 1}`}
              />
              <TouchableOpacity onPress={() => setPasos(ps => ps.filter((_, j) => j !== i))} style={styles.quitar} accessibilityLabel={`Quitar paso ${i + 1}`}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setPasos(ps => [...ps, { texto: '' }])} style={styles.agregar}>
            <MaterialCommunityIcons name="plus" size={16} color={colors.accentLight} />
            <Text style={styles.agregarText}>Agregar paso</Text>
          </TouchableOpacity>
        </Field>
      )}

      {activas.length > 0 && (
        <Field label="Área">
          <View style={styles.wrap}>
            {activas.map(a => (
              <Chip key={a.id} label={a.nombre} color={a.color} active={f.area_id === a.id} onPress={() => set({ area_id: f.area_id === a.id ? null : a.id })} />
            ))}
          </View>
        </Field>
      )}
      {zen.objetivos.length > 0 && (
        <Field label="Objetivo">
          <View style={styles.wrap}>
            {zen.objetivos.map(o => (
              <Chip key={o.id} label={o.titulo} active={f.objetivo_id === o.id} onPress={() => set({ objetivo_id: f.objetivo_id === o.id ? null : o.id })} />
            ))}
          </View>
        </Field>
      )}
      <Field label="Notas">
        <Input value={f.notas ?? ''} onChangeText={t => set({ notas: t })} placeholder="Opcional" multiline />
      </Field>

      <PrimaryButton label={guardando ? 'Guardando…' : 'Guardar'} onPress={guardar} disabled={guardando || !f.titulo.trim()} />
      {rutina && (
        <View style={{ marginTop: space.sm }}>
          <SheetOption icon={rutina.pausada_at ? 'play-circle-outline' : 'pause-circle-outline'} label={rutina.pausada_at ? 'Reanudar rutina' : 'Pausar rutina'} onPress={pausar} />
          <SheetOption icon="trash-can-outline" label="Eliminar rutina" danger onPress={eliminar} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dias: { flexDirection: 'row', gap: 6, marginTop: -space.xs, marginBottom: space.md },
  dia: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  diaOn: { borderColor: colors.accentLight, backgroundColor: 'rgba(139,92,246,0.22)' },
  diaText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 13 },
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: -space.xs, marginBottom: space.md },
  paso: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  quitar: { padding: 6, borderRadius: radius.sm },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  agregarText: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 13 },
});
