import React, { createContext, useContext, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme/tokens';
import { Item, ItemInput, Rutina } from '../domain/types';
import { useZen } from './ZenStore';
import { Sheet, SheetOption } from '../components/ui/Sheet';
import RutinaSheet from '../components/rutinas/RutinaSheet';

// Hojas de rutinas que se abren desde cualquier pestaña (Tareas, Inicio,
// Rutinas y, en la etapa 4, el calendario). Se dibujan una sola vez aquí.
//
// - abrirChecklist: los pasos de la ocurrencia de hoy.
// - editarRutina: formulario de la rutina (o una nueva, con null).
// - guardarOcurrencia: guarda la edición de una ocurrencia. En rutinas de
//   hora fija pregunta "¿Solo hoy o toda la rutina?" (decisión 7); en las
//   demás aplica solo a ese día sin preguntar.

interface RutinaUi {
  abrirChecklist: (item: Item) => void;
  editarRutina: (rutina: Rutina | null) => void;
  guardarOcurrencia: (item: Item, changes: ItemInput) => void;
}

const Ctx = createContext<RutinaUi | null>(null);
export const useRutinaUi = (): RutinaUi => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRutinaUi fuera de RutinaUiProvider');
  return c;
};

export function RutinaUiProvider({ children }: { children: React.ReactNode }) {
  const zen = useZen();
  const [checklist, setChecklist] = useState<Item | null>(null);
  const [rutinaForm, setRutinaForm] = useState<{ rutina: Rutina | null } | null>(null);
  const [alcance, setAlcance] = useState<{ item: Item; changes: ItemInput } | null>(null);

  const guardarOcurrencia = (item: Item, changes: ItemInput) => {
    const r = item.rutina_id ? zen.rutinas.find(x => x.id === item.rutina_id) : undefined;
    if (r?.modo_horario === 'fija') setAlcance({ item, changes });
    else zen.editItem(item, changes);
  };

  // La ocurrencia de la checklist se lee del store (si se completó, ya no está)
  const itemChecklist = checklist ? zen.items.find(i => i.id === checklist.id) ?? null : null;
  const pasos = itemChecklist ? zen.pasos.filter(p => p.rutina_id === itemChecklist.rutina_id).sort((a, b) => a.orden - b.orden) : [];
  const marcados = new Set(zen.itemPasos.filter(p => p.item_id === itemChecklist?.id).map(p => p.paso_id));

  return (
    <Ctx.Provider value={{ abrirChecklist: setChecklist, editarRutina: r => setRutinaForm({ rutina: r }), guardarOcurrencia }}>
      {children}

      <Sheet visible={!!itemChecklist} onClose={() => setChecklist(null)} title={itemChecklist?.titulo}>
        <Text style={styles.avance}>{marcados.size} de {pasos.length} pasos</Text>
        {pasos.map(p => {
          const hecho = marcados.has(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.paso}
              onPress={() => { if (itemChecklist && zen.togglePaso(itemChecklist, p.id)) setChecklist(null); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hecho }}
              accessibilityLabel={p.texto}
            >
              <View style={[styles.box, hecho && styles.boxOn]}>
                {hecho && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.pasoText, hecho && styles.pasoHecho]}>{p.texto}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.hint}>Al marcar el último paso, la rutina queda completada.</Text>
      </Sheet>

      <Sheet visible={!!alcance} onClose={() => setAlcance(null)} title="¿Solo hoy o toda la rutina?">
        <SheetOption icon="calendar-today" label="Solo hoy" onPress={() => {
          if (alcance) zen.editItem(alcance.item, alcance.changes);
          setAlcance(null);
        }} />
        <SheetOption icon="repeat" label="Toda la rutina (desde hoy)" onPress={() => {
          if (alcance) zen.editarRutinaDesdeOcurrencia(alcance.item, alcance.changes);
          setAlcance(null);
        }} />
      </Sheet>

      <RutinaSheet visible={!!rutinaForm} rutina={rutinaForm?.rutina ?? null} onClose={() => setRutinaForm(null)} />
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  avance: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, marginBottom: space.sm },
  paso: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  box: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.metal, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  pasoText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  pasoHecho: { color: colors.textMuted, textDecorationLine: 'line-through' },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, marginTop: space.sm },
});
