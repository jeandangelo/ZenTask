import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, space } from '../../theme/tokens';

// Fila deslizable (decisión 9): izquierda = eliminar, derecha = completar.
// Hecha con PanResponder de React Native (sin librerías nuevas); funciona
// con el dedo en el celular y arrastrando con el mouse en la web.
// Solo toma el gesto si es claramente horizontal, para no robarle el
// scroll vertical a la lista.

const THRESHOLD = 90; // px que hay que arrastrar para que cuente

// En la web, React Native dispara el "toque" (onPress) de los botones de
// adentro al soltar, aunque la fila se haya quedado con el gesto. Por eso
// la fila anota en lastSwipeAt cuándo hubo arrastre, y quien la usa ignora
// los toques que llegan justo después (ver wasSwiping).
export const wasSwiping = (lastSwipeAt: React.MutableRefObject<number>) => Date.now() - lastSwipeAt.current < 400;

export default function SwipeRow({ children, onSwipeLeft, onSwipeRight, rightLabel = 'Completar', lastSwipeAt }: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  rightLabel?: string;
  lastSwipeAt?: React.MutableRefObject<number>;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };
  const mark = () => { if (lastSwipeAt) lastSwipeAt.current = Date.now(); };

  const responder = useRef(PanResponder.create({
    // Fase de captura: la fila reclama el gesto horizontal antes que los
    // botones de adentro (check, ⋯), que si no se quedan con el arrastre.
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      mark();
      const { onSwipeLeft: l, onSwipeRight: r } = handlers.current;
      if ((g.dx < 0 && l) || (g.dx > 0 && r)) x.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      mark();
      const { onSwipeLeft: l, onSwipeRight: r } = handlers.current;
      const done = (g.dx <= -THRESHOLD && l) ? l : (g.dx >= THRESHOLD && r) ? r : null;
      if (done) {
        // La salida es solo visual: la acción va con su propio temporizador
        // para que se aplique aunque la animación se interrumpa (app
        // minimizada, pestaña oculta).
        Animated.timing(x, { toValue: g.dx < 0 ? -600 : 600, duration: 160, useNativeDriver: true }).start();
        setTimeout(() => { done(); x.setValue(0); }, 170);
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  const leftOpacity = x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const rightOpacity = x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View>
      {/* Fondo del gesto: decorativo, oculto para lectores de pantalla */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} aria-hidden>
        <Animated.View style={[styles.bg, styles.complete, { opacity: leftOpacity }]}>
          <MaterialCommunityIcons name="check" size={20} color={colors.text} />
          <Text style={styles.bgText}>{rightLabel}</Text>
        </Animated.View>
        <Animated.View style={[styles.bg, styles.delete, { opacity: rightOpacity }]}>
          <Text style={styles.bgText}>Eliminar</Text>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.text} />
        </Animated.View>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  complete: { backgroundColor: 'rgba(139,92,246,0.35)', justifyContent: 'flex-start' },
  delete: { backgroundColor: 'rgba(229,103,122,0.35)', justifyContent: 'flex-end' },
  bgText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
});
