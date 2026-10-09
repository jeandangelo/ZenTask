import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { useAreas, useZen } from '../state/ZenStore';
import { Entrada, Item } from '../domain/types';
import { dayKeyOf, friendlyDay, shortTime } from '../domain/dates';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/ScreenHeader';
import MicButton from '../components/ui/MicButton';
import { webSinContorno } from '../components/ui/Fields';
import EntradaSheet from '../components/items/EntradaSheet';
import ItemFormSheet from '../components/items/ItemFormSheet';

// Home (decisión 4): un solo campo para capturar + historial. Etapa 2: las
// reglas interpretan lo escrito ("comprar…", fechas, horas, áreas) y cada
// entrada muestra una tarjeta con lo que se creó, que se puede editar o
// deshacer. Lo que no se reconoce queda en Sin ordenar.

const ESTADOS: Record<Entrada['estado'], { label: string; color: string }> = {
  sin_ordenar: { label: 'Sin ordenar', color: colors.accentLight },
  procesada: { label: 'Ordenada', color: colors.textMuted },
  descartada: { label: 'Descartada', color: colors.textFaint },
};

const ICONO: Record<Item['tipo'], React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  tarea: 'checkbox-blank-circle-outline', evento: 'calendar-blank-outline', compra: 'cart-outline',
};

export default function HomeScreen() {
  const { entradas, items, capture, deshacerEntrada, editItem, perfil } = useZen();
  const { byId } = useAreas();
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [origen, setOrigen] = useState<'texto' | 'voz'>('texto');
  const [enviando, setEnviando] = useState(false);
  const [abierta, setAbierta] = useState<Entrada | null>(null);
  const [editando, setEditando] = useState<Item | null>(null);
  const [foco, setFoco] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto('');
    const r = await capture(t, origen);
    if (!r.ok) setTexto(t); // si falló, no se pierde lo escrito
    else toast({ message: r.resumen ?? 'Guardado en Sin ordenar' });
    setOrigen('texto');
    setEnviando(false);
    inputRef.current?.focus();
  };

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.brand}>ZENTASK</Text>
        <Text style={type.meta}>{hoy.charAt(0).toUpperCase() + hoy.slice(1)}{perfil ? ` · Nivel ${perfil.level}` : ''}</Text>
      </View>

      {/* Historial: lo más nuevo abajo, junto al campo (como un chat) */}
      <FlatList
        style={styles.flex}
        data={entradas}
        inverted={entradas.length > 0}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState icon="tray-arrow-down" text={'Escribe lo que tengas en la cabeza. Prueba con "comprar leche, pan" o "prueba de cálculo el jueves a las 10". Lo que no reconozca queda en Sin ordenar.'} />
        }
        renderItem={({ item: e }) => {
          const estado = ESTADOS[e.estado];
          const dia = dayKeyOf(e.created_at);
          const creados = items.filter(i => i.entrada_id === e.id);
          const automatica = e.estado === 'procesada' && !!e.regla;
          return (
            <TouchableOpacity
              style={styles.card}
              disabled={e.estado !== 'sin_ordenar'}
              onPress={() => setAbierta(e)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardText, e.estado === 'descartada' && styles.descartada]}>{e.texto}</Text>

              {/* Resultado: cada ítem creado se toca para editarlo */}
              {creados.map(it => {
                const area = it.area_id ? byId.get(it.area_id) : undefined;
                const detalle = [it.fecha ? friendlyDay(it.fecha) : null, shortTime(it.hora_inicio), area?.nombre].filter(Boolean).join(' · ');
                return (
                  <TouchableOpacity key={it.id} style={styles.resultado} onPress={() => setEditando(it)} accessibilityLabel={`Editar ${it.titulo}`}>
                    <MaterialCommunityIcons name={ICONO[it.tipo]} size={16} color={colors.accentLight} />
                    <Text style={styles.resultadoText} numberOfLines={1}>{it.titulo}</Text>
                    {detalle ? <Text style={type.meta} numberOfLines={1}>{detalle}</Text> : null}
                    <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}

              <View style={styles.cardMeta}>
                <View style={styles.estadoRow}>
                  {e.origen === 'voz' && <MaterialCommunityIcons name="microphone" size={12} color={colors.textMuted} />}
                  <Text style={[styles.estado, { color: estado.color }]}>{automatica ? 'Reconocida' : estado.label}</Text>
                </View>
                <View style={styles.estadoRow}>
                  {e.estado === 'procesada' && creados.length > 0 && (
                    <TouchableOpacity onPress={() => deshacerEntrada(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Deshacer ${e.texto}`}>
                      <Text style={styles.deshacer}>Deshacer</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={type.meta}>{dia ? friendlyDay(dia) : ''} · {format(parseISO(e.created_at), 'HH:mm')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={[styles.input, webSinContorno, foco && { borderColor: colors.accent }]}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          value={texto}
          onChangeText={t => { setTexto(t); if (!t) setOrigen('texto'); }}
          placeholder="¿Qué tienes en mente?"
          placeholderTextColor={colors.textFaint}
          returnKeyType="send"
          onSubmitEditing={enviar}
          blurOnSubmit={false}
          autoFocus={Platform.OS === 'web'}
          accessibilityLabel="Capturar"
        />
        {!texto.trim() && <MicButton onText={t => { setTexto(t); setOrigen('voz'); }} />}
        {!!texto.trim() && (
          <TouchableOpacity style={styles.send} onPress={enviar} accessibilityLabel="Guardar">
            <MaterialCommunityIcons name="arrow-up" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <EntradaSheet entrada={abierta} onClose={() => setAbierta(null)} />
      <ItemFormSheet
        visible={!!editando}
        item={editando}
        title="Editar"
        onClose={() => setEditando(null)}
        onSubmit={input => { if (editando) editItem(editando, input); setEditando(null); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: 2 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.metalLight, letterSpacing: 3 },
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 8, borderWidth: 1, borderColor: colors.border },
  cardText: { color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  descartada: { color: colors.textFaint, textDecorationLine: 'line-through' },
  resultado: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingHorizontal: space.md,
    borderRadius: radius.sm, backgroundColor: 'rgba(139,92,246,0.10)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
  },
  resultadoText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  estado: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  deshacer: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 13 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, paddingVertical: 12,
    fontFamily: fonts.regular, fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
