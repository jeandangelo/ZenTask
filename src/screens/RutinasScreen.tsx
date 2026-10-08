import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { useAreas, useZen } from '../state/ZenStore';
import { describeRecurrence } from '../domain/routines';
import ScreenHeader, { EmptyState } from '../components/ui/ScreenHeader';
import AreaChips from '../components/ui/AreaChips';

// Rutinas: en la etapa 1 solo se listan (las migradas y las creadas con
// "Convertir en rutina"). Crear, editar, pausar, horarios y checklist
// llegan en la etapa 3 (docs/rediseno.md, sección 8).
export default function RutinasScreen() {
  const { rutinas } = useZen();
  const { byId } = useAreas();
  const [area, setArea] = useState<string | null>(null);
  const lista = useMemo(() => rutinas.filter(r => !area || r.area_id === area), [rutinas, area]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Rutinas" />
      <View><AreaChips value={area} onChange={setArea} /></View>
      <FlatList
        data={lista}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListHeaderComponent={
          <View style={styles.aviso}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
            <Text style={[type.meta, { flex: 1 }]}>Tus rutinas siguen generando su tarea de cada día en Tareas → Hoy. Crearlas y editarlas aquí llega en la próxima etapa.</Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const a = r.area_id ? byId.get(r.area_id) : undefined;
          return (
            <View style={styles.card}>
              <View style={[styles.areaBar, { backgroundColor: a?.color ?? colors.border }]} />
              <MaterialCommunityIcons name="repeat" size={18} color={colors.metal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.titulo}</Text>
                <Text style={type.meta}>{[describeRecurrence(r), a?.nombre, r.pausada_at ? 'Pausada' : null].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState icon="repeat" text="No tienes rutinas. Puedes convertir una tarea en rutina desde su menú ⋯." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 120, flexGrow: 1 },
  aviso: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingBottom: space.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, paddingRight: space.md, overflow: 'hidden' },
  areaBar: { width: 3, alignSelf: 'stretch' },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
});
