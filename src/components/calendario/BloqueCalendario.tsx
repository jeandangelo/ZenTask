import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../../theme/tokens';
import { horaDe, moverMinutos } from '../../domain/calendar';

// Un bloque en la grilla por horas. Tocar = editar. Mantener apretado
// ~0,35 s y arrastrar = mover (vertical cambia la hora; en la vista semana,
// horizontal cambia el día). Se mantiene apretado primero para que deslizar
// el dedo sobre la grilla siga sirviendo para desplazarse (como en Google
// Calendar). Sin librerías: PanResponder de React Native.

export type EstiloBloque = 'tarea' | 'evento' | 'rutina' | 'turno' | 'proyectada';

export interface BloqueProps {
  titulo: string;
  estilo: EstiloBloque;
  color: string;               // color del área (o metal si no tiene)
  top: number; height: number; left: number; width: number;
  inicio: number;              // minutos
  duracion: number;            // minutos
  pxPorHora: number;
  anchoDia: number;            // para mover entre días en la vista semana
  puedeCambiarDia: boolean;
  arrastrable: boolean;
  onTap: () => void;
  onCheck?: () => void;        // solo tareas/rutinas marcables
  onMover?: (nuevoInicio: number, diasDesplazados: number) => void;
  onArrastre?: (activo: boolean) => void; // la grilla deja de desplazarse mientras se arrastra
}

// Solo web: que mantener apretado no seleccione texto ni abra el menú del navegador
const webSinSeleccion = Platform.select({
  web: { userSelect: 'none', WebkitTouchCallout: 'none', cursor: 'pointer' } as unknown as ViewStyle,
  default: {},
});

export default function BloqueCalendario(p: BloqueProps) {
  const pos = useRef(new Animated.ValueXY()).current;
  const arrastrando = useRef(false);
  const tomado = useRef(false);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const props = useRef(p);
  props.current = p;

  const soltar = () => {
    arrastrando.current = false;
    tomado.current = false;
    setVistaPrevia(null);
    pos.setValue({ x: 0, y: 0 });
    props.current.onArrastre?.(false);
  };

  const calcular = (dx: number, dy: number) => {
    const c = props.current;
    const inicio = moverMinutos(c.inicio, dy, c.pxPorHora, c.duracion);
    const dias = c.puedeCambiarDia ? Math.round(dx / Math.max(1, c.anchoDia)) : 0;
    return { inicio, dias };
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => arrastrando.current,
    onMoveShouldSetPanResponder: () => arrastrando.current,
    onMoveShouldSetPanResponderCapture: () => arrastrando.current,
    onPanResponderTerminationRequest: () => !arrastrando.current,
    onPanResponderGrant: () => { tomado.current = true; },
    onPanResponderMove: (_, g) => {
      const c = props.current;
      pos.setValue({ x: c.puedeCambiarDia ? g.dx : 0, y: g.dy });
      const { inicio, dias } = calcular(g.dx, g.dy);
      setVistaPrevia(`${horaDe(inicio)}${dias ? ` · ${dias > 0 ? '+' : ''}${dias} día${Math.abs(dias) === 1 ? '' : 's'}` : ''}`);
    },
    onPanResponderRelease: (_, g) => {
      const { inicio, dias } = calcular(g.dx, g.dy);
      const c = props.current;
      soltar();
      if (inicio !== c.inicio || dias !== 0) c.onMover?.(inicio, dias);
    },
    onPanResponderTerminate: soltar,
  })).current;

  const tono = estiloVisual(p.estilo, p.color);
  const corto = p.height < 34;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.wrap,
        { top: p.top, height: p.height, left: p.left, width: p.width, transform: pos.getTranslateTransform() },
        vistaPrevia != null && styles.levantado,
        webSinSeleccion,
      ]}
    >
      <Pressable
        style={[styles.bloque, tono.caja, { borderRadius: radius.sm }]}
        onPress={() => { if (!arrastrando.current) p.onTap(); }}
        onLongPress={p.arrastrable ? () => { arrastrando.current = true; p.onArrastre?.(true); setVistaPrevia(horaDe(p.inicio)); } : undefined}
        // Mantuvo apretado pero soltó sin moverse: vuelve a la normalidad
        onPressOut={() => { if (arrastrando.current && !tomado.current) soltar(); }}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${p.titulo}, ${horaDe(p.inicio)}`}
      >
        <View style={styles.fila}>
          {p.onCheck && !corto && (
            <TouchableOpacity onPress={p.onCheck} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={`Completar ${p.titulo}`}>
              <View style={[styles.check, { borderColor: tono.texto }, p.estilo === 'rutina' && { borderStyle: 'dashed' }]} />
            </TouchableOpacity>
          )}
          <Text style={[styles.titulo, { color: tono.texto }]} numberOfLines={corto ? 1 : 2}>{p.titulo}</Text>
        </View>
        {!corto && <Text style={[styles.hora, { color: tono.texto }]} numberOfLines={1}>{vistaPrevia ?? `${horaDe(p.inicio)}–${horaDe(Math.min(1440, p.inicio + p.duracion))}`}</Text>}
        {corto && vistaPrevia && <Text style={[styles.hora, { color: tono.texto }]}>{vistaPrevia}</Text>}
      </Pressable>
    </Animated.View>
  );
}

// Código visual (decisión 6b): color = área; estilo = tipo.
// Evento sólido · rutina punteada · turno relleno apagado · tarea con check.
export const estiloVisual = (estilo: EstiloBloque, color: string): { caja: ViewStyle; texto: string } => {
  switch (estilo) {
    case 'evento': return { caja: { backgroundColor: color, borderColor: color }, texto: '#0B0B0F' };
    case 'rutina': return { caja: { backgroundColor: `${color}26`, borderColor: color, borderStyle: 'dashed' }, texto: colors.text };
    case 'turno': return { caja: { backgroundColor: `${color}33`, borderColor: 'transparent' }, texto: colors.textMuted };
    case 'proyectada': return { caja: { backgroundColor: 'transparent', borderColor: `${color}99`, borderStyle: 'dashed' }, texto: colors.textMuted };
    default: return { caja: { backgroundColor: colors.elevated, borderColor: color, borderLeftWidth: 3 }, texto: colors.text };
  }
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', paddingHorizontal: 1, paddingVertical: 1 },
  levantado: { zIndex: 50, opacity: 0.92, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  bloque: { flex: 1, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 3, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  check: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, marginTop: 2 },
  titulo: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15 },
  hora: { fontFamily: fonts.regular, fontSize: 10.5, marginTop: 1 },
});
