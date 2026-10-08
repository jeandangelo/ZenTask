import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, space } from '../../theme/tokens';
import { Entrada, TipoItem } from '../../domain/types';
import { useZen } from '../../state/ZenStore';
import { useToast } from '../ui/Toast';
import { Sheet, SheetOption } from '../ui/Sheet';
import ItemFormSheet from './ItemFormSheet';

// Ordenar una entrada del Buzón (sección "Sin ordenar"): elegir qué es y
// completar sus datos, o descartarla. La entrada queda en el historial del
// Home como "Ordenada" o "Descartada".
export default function EntradaSheet({ entrada, onClose }: { entrada: Entrada | null; onClose: () => void }) {
  const { ordenar, descartar } = useZen();
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoItem | null>(null);

  useEffect(() => { setTipo(null); }, [entrada]);
  const initial = useMemo(() => ({ titulo: entrada?.texto ?? '', tipo: tipo ?? 'tarea' }), [entrada, tipo]);
  if (!entrada) return null;

  const nombres: Record<TipoItem, string> = { tarea: 'Tarea', evento: 'Evento', compra: 'Compra' };

  return (
    <>
      <Sheet visible={!tipo} onClose={onClose} title="Ordenar">
        <Text style={styles.texto}>“{entrada.texto}”</Text>
        <SheetOption icon="checkbox-blank-circle-outline" label="Es una tarea" onPress={() => setTipo('tarea')} />
        <SheetOption icon="calendar-blank-outline" label="Es un evento" onPress={() => setTipo('evento')} />
        <SheetOption icon="cart-outline" label="Es una compra" onPress={() => setTipo('compra')} />
        <SheetOption icon="close-circle-outline" label="Descartar" danger onPress={() => { descartar(entrada); onClose(); }} />
      </Sheet>
      <ItemFormSheet
        visible={!!tipo}
        onClose={() => setTipo(null)}
        title={`Nueva ${nombres[tipo ?? 'tarea'].toLowerCase()}`}
        initial={initial}
        onSubmit={async input => {
          const it = await ordenar(entrada, { ...input, tipo: tipo ?? 'tarea' });
          if (it) toast({ message: `Ordenada como ${nombres[tipo ?? 'tarea'].toLowerCase()}` });
          onClose();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  texto: { color: colors.text, fontFamily: fonts.regular, fontSize: 15, marginBottom: space.sm, fontStyle: 'italic' },
});
