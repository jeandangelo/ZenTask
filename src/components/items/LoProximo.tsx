import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { Item } from '../../domain/types';
import { shortTime } from '../../domain/dates';
import { proximosDeHoy } from '../../domain/sections';
import { useAreas, useZen } from '../../state/ZenStore';
import { useRutinaUi } from '../../state/RutinaUi';

// Franja "Lo próximo" del Home (decisión 4): 2–3 pendientes de hoy que se
// marcan desde aquí. Si no hay nada para hoy, no se muestra.
export default function LoProximo({ onEdit }: { onEdit: (item: Item) => void }) {
  const { items, rutinas, pasos, itemPasos, complete } = useZen();
  const { abrirChecklist } = useRutinaUi();
  const { byId } = useAreas();
  const noMarcables = new Set(rutinas.filter(r => !r.marcable).map(r => r.id));
  const lista = proximosDeHoy(items, noMarcables);
  if (lista.length === 0) return null;

  return (
    <View style={styles.box}>
      <Text style={[type.label, { marginBottom: space.xs }]}>Lo próximo</Text>
      {lista.map(it => {
        const rutina = it.rutina_id ? rutinas.find(r => r.id === it.rutina_id) : undefined;
        const marcable = rutina ? rutina.marcable : true;
        const total = rutina ? pasos.filter(p => p.rutina_id === rutina.id).length : 0;
        const hechos = total ? itemPasos.filter(p => p.item_id === it.id).length : 0;
        const hora = rutina?.modo_horario === 'flexible' && !it.hora_inicio ? 'por planificar' : shortTime(it.hora_inicio);
        const area = it.area_id ? byId.get(it.area_id) : undefined;
        return (
          <TouchableOpacity key={it.id} style={styles.fila} onPress={() => onEdit(it)} accessibilityLabel={`Editar ${it.titulo}`}>
            {marcable ? (
              <TouchableOpacity
                onPress={() => (total ? abrirChecklist(it) : complete(it))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="checkbox"
                accessibilityLabel={`Completar ${it.titulo}`}
              >
                <View style={[styles.check, { borderColor: area?.color ?? colors.metal }, rutina && { borderStyle: 'dashed' }]} />
              </TouchableOpacity>
            ) : (
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textFaint} />
            )}
            <Text style={styles.titulo} numberOfLines={1}>{it.titulo}</Text>
            {total ? <Text style={type.meta}>{hechos}/{total}</Text> : null}
            {hora ? <Text style={type.meta}>{hora}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: space.lg, marginBottom: space.sm, padding: space.md, gap: 2,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  titulo: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
});
