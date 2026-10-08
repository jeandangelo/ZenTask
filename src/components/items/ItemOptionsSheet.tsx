import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../../theme/tokens';
import { Item, Recurrencia } from '../../domain/types';
import { addDaysKey, localDayKey, nextWeekendKey } from '../../domain/dates';
import { useAreas, useZen } from '../../state/ZenStore';
import { Sheet, SheetOption } from '../ui/Sheet';
import { DateField, PrimaryButton } from '../ui/Fields';

// Menú ⋯ de un ítem (decisión 9): Editar · Reprogramar · Cambiar área ·
// Vincular a objetivo · Convertir en rutina · Duplicar · Eliminar.
// Cada submenú se abre dentro de la misma hoja.

type Vista = 'menu' | 'reprogramar' | 'fecha' | 'area' | 'objetivo' | 'rutina';

export default function ItemOptionsSheet({ item, onClose, onEdit, initialView = 'menu' }: {
  item: Item | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
  initialView?: 'menu' | 'reprogramar'; // "reprogramar" = botón rápido de las vencidas
}) {
  const zen = useZen();
  const { activas } = useAreas();
  const [vista, setVista] = useState<Vista>('menu');
  const [fecha, setFecha] = useState<string | null>(null);

  useEffect(() => { if (item) { setVista(initialView); setFecha(item.fecha); } }, [item, initialView]);
  if (!item) return null;

  const esCompra = item.tipo === 'compra';
  const done = (fn: () => void) => { fn(); onClose(); };
  const today = localDayKey();
  const reprogramar = (nueva: string | null) => done(() => zen.reprogramar(item, nueva));

  const titulos: Record<Vista, string> = {
    menu: item.titulo, reprogramar: 'Reprogramar', fecha: 'Elegir fecha', area: 'Cambiar área',
    objetivo: 'Vincular a objetivo', rutina: 'Convertir en rutina',
  };

  return (
    <Sheet visible={!!item} onClose={onClose} title={titulos[vista]}>
      {vista === 'menu' && (
        <View>
          <SheetOption icon="pencil-outline" label="Editar" onPress={() => done(() => onEdit(item))} />
          {!esCompra && <SheetOption icon="calendar-arrow-right" label="Reprogramar" onPress={() => setVista('reprogramar')} />}
          <SheetOption icon="shape-outline" label="Cambiar área" onPress={() => setVista('area')} />
          {!esCompra && <SheetOption icon="flag-outline" label="Vincular a objetivo" onPress={() => setVista('objetivo')} />}
          {!esCompra && !item.rutina_id && <SheetOption icon="repeat" label="Convertir en rutina" onPress={() => setVista('rutina')} />}
          <SheetOption icon="content-copy" label="Duplicar" onPress={() => done(() => zen.duplicate(item))} />
          <SheetOption icon="trash-can-outline" label="Eliminar" danger onPress={() => done(() => zen.remove(item))} />
        </View>
      )}

      {vista === 'reprogramar' && (
        <View>
          <SheetOption icon="weather-sunset-up" label="Mañana" onPress={() => reprogramar(addDaysKey(today, 1))} />
          <SheetOption icon="sofa-outline" label="Fin de semana" onPress={() => reprogramar(nextWeekendKey())} />
          <SheetOption icon="calendar-search" label="Elegir fecha" onPress={() => setVista('fecha')} />
          {item.fecha && <SheetOption icon="calendar-remove-outline" label="Quitar fecha" onPress={() => reprogramar(null)} />}
        </View>
      )}

      {vista === 'fecha' && (
        <View style={{ gap: space.md }}>
          <DateField value={fecha} onChange={setFecha} />
          <PrimaryButton label="Reprogramar" disabled={!fecha || fecha === item.fecha} onPress={() => reprogramar(fecha)} />
        </View>
      )}

      {vista === 'area' && (
        <View>
          <SheetOption label="Sin área" selected={!item.area_id} onPress={() => done(() => zen.editItem(item, { area_id: null }))} />
          {activas.map(a => (
            <SheetOption key={a.id} label={a.nombre} color={a.color} selected={item.area_id === a.id}
              onPress={() => done(() => zen.editItem(item, { area_id: a.id }))} />
          ))}
        </View>
      )}

      {vista === 'objetivo' && (
        <View>
          {zen.objetivos.length === 0 && <Text style={styles.hint}>Todavía no tienes objetivos. Créalos desde Perfil.</Text>}
          {zen.objetivos.length > 0 && (
            <SheetOption label="Ninguno" selected={!item.objetivo_id} onPress={() => done(() => zen.editItem(item, { objetivo_id: null }))} />
          )}
          {zen.objetivos.map(o => (
            <SheetOption key={o.id} icon="flag-outline" label={o.titulo} selected={item.objetivo_id === o.id}
              onPress={() => done(() => zen.editItem(item, { objetivo_id: o.id }))} />
          ))}
        </View>
      )}

      {vista === 'rutina' && (
        <View>
          <Text style={styles.hint}>Se repetirá desde {item.fecha ? 'su fecha' : 'hoy'}. Podrás ajustarla en la pestaña Rutinas.</Text>
          {(['diaria', 'semanal', 'mensual'] as Recurrencia[]).map(r => (
            <SheetOption key={r} icon="repeat" label={r === 'diaria' ? 'Todos los días' : r === 'semanal' ? 'Cada semana, ese día' : 'Cada mes, ese día'}
              onPress={() => done(() => zen.convertToRutina(item, r))} />
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginBottom: space.sm },
});
