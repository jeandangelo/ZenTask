import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { useZen } from '../state/ZenStore';
import { Entrada } from '../domain/types';
import { dayKeyOf, friendlyDay } from '../domain/dates';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/ScreenHeader';
import EntradaSheet from '../components/items/EntradaSheet';

// Home (decisión 4): un solo campo para capturar (texto; el dictado del
// teclado también sirve) + historial de lo capturado. Capturar no es
// organizar: todo queda en "Sin ordenar" hasta que se ordena (etapa 1).
// Las reglas que interpretan el texto llegan en la etapa 2.

const ESTADOS: Record<Entrada['estado'], { label: string; color: string }> = {
  sin_ordenar: { label: 'Sin ordenar', color: colors.accentLight },
  procesada: { label: 'Ordenada', color: colors.textMuted },
  descartada: { label: 'Descartada', color: colors.textFaint },
};

export default function HomeScreen() {
  const { entradas, capture, perfil } = useZen();
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [abierta, setAbierta] = useState<Entrada | null>(null);
  const inputRef = useRef<TextInput>(null);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto('');
    if (await capture(t)) toast({ message: 'Guardado en Sin ordenar' });
    else setTexto(t); // si falló, no se pierde lo escrito
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
          <EmptyState icon="tray-arrow-down" text="Escribe lo que tengas en la cabeza: una tarea, una compra, una idea. Se guarda en Sin ordenar y lo ordenas cuando quieras." />
        }
        renderItem={({ item: e }) => {
          const estado = ESTADOS[e.estado];
          const dia = dayKeyOf(e.created_at);
          return (
            <TouchableOpacity
              style={styles.card}
              disabled={e.estado !== 'sin_ordenar'}
              onPress={() => setAbierta(e)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardText, e.estado === 'descartada' && styles.descartada]}>{e.texto}</Text>
              <View style={styles.cardMeta}>
                <Text style={[styles.estado, { color: estado.color }]}>{estado.label}</Text>
                <Text style={type.meta}>{dia ? friendlyDay(dia) : ''} · {format(parseISO(e.created_at), 'HH:mm')}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="¿Qué tienes en mente?"
          placeholderTextColor={colors.textFaint}
          returnKeyType="send"
          onSubmitEditing={enviar}
          blurOnSubmit={false}
          autoFocus={Platform.OS === 'web'}
          accessibilityLabel="Capturar"
        />
        <TouchableOpacity
          style={[styles.send, !texto.trim() && { opacity: 0.4 }]}
          onPress={enviar}
          disabled={!texto.trim()}
          accessibilityLabel="Guardar"
        >
          <MaterialCommunityIcons name="arrow-up" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <EntradaSheet entrada={abierta} onClose={() => setAbierta(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: 2 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.metalLight, letterSpacing: 3 },
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 6, borderWidth: 1, borderColor: colors.border },
  cardText: { color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  descartada: { color: colors.textFaint, textDecorationLine: 'line-through' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  estado: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
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
