import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { useAreas, useZen } from '../state/ZenStore';
import { useRutinaUi } from '../state/RutinaUi';
import { Rutina } from '../domain/types';
import { cumplimientoSemana, describeHorario, describeRecurrence } from '../domain/routines';
import ScreenHeader, { EmptyState, SectionLabel } from '../components/ui/ScreenHeader';
import AreaChips from '../components/ui/AreaChips';

// Rutinas (etapa 3): crear, editar, pausar. Cada rutina muestra cuándo se
// repite, su horario y cuántas veces se cumplió esta semana (de lunes a
// hoy). Sin rachas: una semana mala no borra nada, la próxima parte de cero.
export default function RutinasScreen() {
  const { rutinas, hechasSemana, pasos } = useZen();
  const { byId } = useAreas();
  const { editarRutina } = useRutinaUi();
  const [area, setArea] = useState<string | null>(null);

  const secciones = useMemo(() => {
    const filtradas = rutinas.filter(r => !area || r.area_id === area);
    return [
      { key: 'activas', title: 'Activas', data: filtradas.filter(r => !r.pausada_at) },
      { key: 'pausadas', title: 'Pausadas', data: filtradas.filter(r => r.pausada_at) },
    ].filter(s => s.data.length > 0);
  }, [rutinas, area]);

  const cumplimiento = (r: Rutina) =>
    cumplimientoSemana(r, new Set(hechasSemana.filter(h => h.rutina_id === r.id).map(h => h.ocurrencia_fecha)));

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Rutinas" />
      <View><AreaChips value={area} onChange={setArea} /></View>
      <SectionList
        sections={secciones}
        keyExtractor={r => r.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => <SectionLabel title={section.title} count={section.data.length} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item: r }) => {
          const a = r.area_id ? byId.get(r.area_id) : undefined;
          const c = r.marcable && !r.pausada_at ? cumplimiento(r) : null;
          const nPasos = pasos.filter(p => p.rutina_id === r.id).length;
          const detalle = [describeRecurrence(r), describeHorario(r), nPasos ? `${nPasos} ${nPasos === 1 ? 'paso' : 'pasos'}` : null, a?.nombre].filter(Boolean).join(' · ');
          return (
            <View style={styles.cardWrap}>
              <TouchableOpacity style={[styles.card, r.pausada_at && { opacity: 0.55 }]} onPress={() => editarRutina(r)} accessibilityLabel={`Editar rutina ${r.titulo}`}>
                <View style={[styles.areaBar, { backgroundColor: a?.color ?? colors.border }]} />
                <MaterialCommunityIcons
                  name={!r.marcable ? 'clock-outline' : r.modo_horario === 'flexible' ? 'timer-sand' : 'repeat'}
                  size={18}
                  color={colors.metal}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{r.titulo}</Text>
                  <Text style={type.meta} numberOfLines={2}>{detalle}</Text>
                </View>
                {c && c.programadas > 0 && (
                  <View style={styles.cumple} accessibilityLabel={`${c.hechas} de ${c.programadas} esta semana`}>
                    <Text style={styles.cumpleNum}>{c.hechas}/{c.programadas}</Text>
                    <Text style={styles.cumpleLabel}>semana</Text>
                  </View>
                )}
                {!r.marcable && <Text style={styles.soloTiempo}>Solo tiempo</Text>}
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="repeat" text={area ? 'No hay rutinas en esta área.' : 'Crea tu primera rutina con +. También puedes convertir una tarea en rutina desde su menú ⋯.'} />
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => editarRutina(null)} accessibilityLabel="Nueva rutina">
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120, flexGrow: 1 },
  cardWrap: { paddingHorizontal: space.lg },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingVertical: space.md, paddingRight: space.md, overflow: 'hidden',
  },
  areaBar: { width: 3, alignSelf: 'stretch' },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  cumple: { alignItems: 'center', minWidth: 44 },
  cumpleNum: { color: colors.accentLight, fontFamily: fonts.bold, fontSize: 16 },
  cumpleLabel: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 10 },
  soloTiempo: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 11 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
