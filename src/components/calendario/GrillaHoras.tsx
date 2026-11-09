import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Item, Rutina } from '../../domain/types';
import { addDaysKey, localDayKey, shortTime } from '../../domain/dates';
import { destinoSoltar, distribuir, horaDe, MIN_DIA, Proyeccion, proyectarRutinas, rangoDe } from '../../domain/calendar';
import BloqueCalendario, { EstiloBloque } from './BloqueCalendario';

// Grilla por horas de 1 día (vista día) o 7 (vista semana): arriba la
// franja "todo el día" (ítems con fecha y sin hora, rutinas sin hora y
// flexibles por planificar); abajo las 24 horas con los bloques.
//
// Lo de "todo el día" se puede mantener apretado y arrastrar a la grilla
// para darle una hora (pedido de Jean, 9 nov: planificar la rutina de la
// mañana después de "levantarme 6:00"). Al acercarse al borde, la grilla
// se desplaza sola para llegar a cualquier hora.

export const PX_POR_HORA = 52;
const GUTTER = 42;          // columna de las horas
const BORDE_AUTO = 48;      // px desde el borde donde empieza el desplazamiento automático
const ALTO_MOMENTO = 26;    // un ítem sin duración se dibuja compacto

type Ref = { tipo: 'item'; item: Item } | { tipo: 'proy'; p: Proyeccion };
type Arrastre = { item: Item; hora: string | null; dia: string };

const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Solo web: que mantener apretado no seleccione texto ni abra el menú del navegador
const webSinSeleccion = Platform.select({
  web: { userSelect: 'none', WebkitTouchCallout: 'none', cursor: 'grab' } as unknown as ViewStyle,
  default: {},
});

export default function GrillaHoras({ dias, items, rutinas, colorDe, onEditItem, onEditRutina, onCheck, onMover, onEstirar }: {
  dias: string[];
  items: Item[];               // pendientes con fecha (ya filtrados por área)
  rutinas: Rutina[];
  colorDe: (areaId: string | null) => string;
  onEditItem: (item: Item) => void;
  onEditRutina: (r: Rutina) => void;
  onCheck: (item: Item) => void;
  onMover: (item: Item, fecha: string, hora: string) => void;   // mover un bloque o darle hora a uno de "todo el día"
  onEstirar: (item: Item, duracion: number) => void;
}) {
  const [ancho, setAncho] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const scroll = useRef<ScrollView>(null);
  const raiz = useRef<View>(null);
  const geo = useRef({ x: 0, y: 0, alto: 0 });  // posición de la grilla en la página
  const inicioGrilla = useRef(0);                // dónde empiezan las horas (bajo la franja)
  const scrollY = useRef(0);
  const ultimo = useRef({ x: 0, y: 0 });
  // El desplazamiento hacia arriba se activa solo después de haber entrado a
  // la grilla: si no, al bajar desde la franja la grilla subiría sola.
  const entroGrilla = useRef(false);
  const auto = useRef<{ dir: number; timer: ReturnType<typeof setInterval> | null }>({ dir: 0, timer: null });
  const fantasma = useRef(new Animated.ValueXY()).current;
  const hoy = localDayKey();
  const semana = dias.length > 1;
  const anchoDia = Math.max(0, (ancho - GUTTER) / dias.length);
  const rutinaDe = (id: string | null) => (id ? rutinas.find(r => r.id === id) : undefined);

  // Al abrir: la grilla parte una hora antes de ahora (o a las 7:00)
  useEffect(() => {
    const h = dias.includes(hoy) ? Math.max(0, new Date().getHours() - 1) : 7;
    const t = setTimeout(() => {
      scroll.current?.scrollTo({ y: h * PX_POR_HORA, animated: false });
      scrollY.current = h * PX_POR_HORA;
    }, 50);
    return () => clearTimeout(t);
  }, [dias.join(',')]);

  const porDia = useMemo(() => dias.map(dia => {
    const delDia = items.filter(i => i.fecha === dia);
    const generadas = new Set(delDia.filter(i => i.rutina_id).map(i => i.rutina_id!));
    const conHora = delDia.filter(i => i.hora_inicio);
    const sinHora = delDia.filter(i => !i.hora_inicio);
    const proy = proyectarRutinas(rutinas, dia, hoy, generadas);
    const bloques = distribuir<Ref>([
      ...conHora.map(item => ({ ref: { tipo: 'item' as const, item }, ...rangoDe(item)! })),
      ...proy.map(p => ({ ref: { tipo: 'proy' as const, p }, ...rangoDe(p.rutina)! })),
    ]);
    return { dia, sinHora, bloques };
  }), [dias.join(','), items, rutinas, hoy]);

  const maxTodoElDia = Math.max(0, ...porDia.map(d => d.sinHora.length));
  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const estiloDe = (item: Item): EstiloBloque => {
    const r = rutinaDe(item.rutina_id);
    if (r) return r.marcable ? 'rutina' : 'turno';
    return item.tipo === 'evento' ? 'evento' : 'tarea';
  };

  // ── Arrastre desde "todo el día" ───────────────────────────────────────────
  const destino = (px: number, py: number) => {
    const d = destinoSoltar({
      x: px - geo.current.x, y: py - geo.current.y, inicioGrilla: inicioGrilla.current, scroll: scrollY.current,
      pxPorHora: PX_POR_HORA, margenHoras: GUTTER, anchoDia, dias: dias.length,
    });
    return d ? { hora: aHora(d.minutos), dia: dias[d.diaIndice] } : null;
  };

  const actualizarDestino = () => {
    const d = destino(ultimo.current.x, ultimo.current.y);
    setArrastre(a => (a && (a.hora !== (d?.hora ?? null) || (d && a.dia !== d.dia)) ? { ...a, hora: d?.hora ?? null, dia: d?.dia ?? a.dia } : a));
  };

  const pararAuto = () => {
    if (auto.current.timer) clearInterval(auto.current.timer);
    auto.current = { dir: 0, timer: null };
  };

  const empezar = (item: Item, px: number, py: number) => {
    setArrastrando(true);
    entroGrilla.current = false;
    setArrastre({ item, hora: null, dia: item.fecha ?? dias[0] });
    raiz.current?.measure((_x, _y, _w, h, pageX, pageY) => { geo.current = { x: pageX, y: pageY, alto: h }; mover(px, py); });
  };

  const mover = (px: number, py: number) => {
    ultimo.current = { x: px, y: py };
    fantasma.setValue({ x: px - geo.current.x - 70, y: py - geo.current.y - 16 });
    actualizarDestino();
    // Cerca del borde de abajo (o del de arriba de las horas) la grilla se desplaza sola
    const ry = py - geo.current.y;
    if (ry > inicioGrilla.current + BORDE_AUTO) entroGrilla.current = true;
    const dir = ry > geo.current.alto - BORDE_AUTO ? 1
      : entroGrilla.current && ry > inicioGrilla.current && ry < inicioGrilla.current + BORDE_AUTO ? -1 : 0;
    if (dir === auto.current.dir) return;
    pararAuto();
    if (!dir) return;
    auto.current = {
      dir,
      timer: setInterval(() => {
        const max = Math.max(0, 24 * PX_POR_HORA + space.xl - (geo.current.alto - inicioGrilla.current));
        scrollY.current = Math.max(0, Math.min(max, scrollY.current + dir * 8));
        scroll.current?.scrollTo({ y: scrollY.current, animated: false });
        actualizarDestino();
      }, 30),
    };
  };

  const terminar = (soltarEn: { x: number; y: number } | null) => {
    pararAuto();
    const a = arrastreRef.current;
    const d = soltarEn ? destino(soltarEn.x, soltarEn.y) : null;
    setArrastre(null);
    setArrastrando(false);
    if (a && d) onMover(a.item, d.dia, d.hora);
  };
  const arrastreRef = useRef<Arrastre | null>(null);
  arrastreRef.current = arrastre;

  return (
    <View ref={raiz} style={{ flex: 1 }} onLayout={e => setAncho(e.nativeEvent.layout.width)}>
      {/* Franja "todo el día" */}
      {maxTodoElDia > 0 && (
        <View style={styles.todoElDia}>
          <Text style={[styles.gutterText, { width: GUTTER }]}>todo{'\n'}el día</Text>
          {porDia.map(({ dia, sinHora }) => (
            <View key={dia} style={{ width: anchoDia, gap: 3, paddingHorizontal: 1 }}>
              {(semana ? sinHora.slice(0, 2) : sinHora).map(it => {
                const r = rutinaDe(it.rutina_id);
                const porPlanificar = r?.modo_horario === 'flexible';
                const color = colorDe(it.area_id);
                return (
                  <ChipArrastrable
                    key={it.id}
                    label={`${it.titulo}${porPlanificar ? ', por planificar' : ''}. Mantén apretado y arrastra para darle hora`}
                    style={[styles.chip, { borderColor: color }, r && { borderStyle: 'dashed' }, it.tipo === 'evento' && { backgroundColor: color },
                      arrastre?.item.id === it.id && { opacity: 0.35 }]}
                    onTap={() => onEditItem(it)}
                    onInicio={(x, y) => empezar(it, x, y)}
                    onMover={mover}
                    onSoltar={(x, y) => terminar({ x, y })}
                    onCancelar={() => terminar(null)}
                  >
                    <Text numberOfLines={1} style={[styles.chipText, it.tipo === 'evento' && { color: '#0B0B0F' }]}>
                      {it.titulo}{!semana && porPlanificar ? `  ·  por planificar ${shortTime(r!.rango_inicio)}–${shortTime(r!.rango_fin)}` : ''}
                    </Text>
                  </ChipArrastrable>
                );
              })}
              {semana && sinHora.length > 2 && <Text style={styles.mas}>+{sinHora.length - 2}</Text>}
            </View>
          ))}
        </View>
      )}

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        scrollEnabled={!arrastrando}
        onLayout={e => { inicioGrilla.current = e.nativeEvent.layout.y; }}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: 24 * PX_POR_HORA + space.xl }}
      >
        {/* Líneas y etiquetas de las horas */}
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} style={[styles.horaFila, { top: h * PX_POR_HORA }]}>
            <Text style={[styles.gutterText, { width: GUTTER }]}>{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</Text>
            <View style={styles.linea} />
          </View>
        ))}
        {/* Separadores de días (semana) */}
        {semana && dias.map((d, i) => i > 0 && (
          <View key={d} style={[styles.sepDia, { left: GUTTER + i * anchoDia }]} />
        ))}
        {/* Línea de ahora */}
        {dias.includes(hoy) && (
          <View style={[styles.ahora, {
            top: (minAhora / 60) * PX_POR_HORA,
            left: GUTTER + dias.indexOf(hoy) * anchoDia,
            width: anchoDia,
          }]} />
        )}
        {/* Dónde va a caer lo que se arrastra desde "todo el día" */}
        {arrastre?.hora && (
          <View style={[styles.destino, {
            top: ((minutosDeHora(arrastre.hora)) / 60) * PX_POR_HORA,
            left: GUTTER + Math.max(0, dias.indexOf(arrastre.dia)) * anchoDia + 2,
            width: anchoDia - 4,
            height: arrastre.item.duracion_min ? Math.max(20, (arrastre.item.duracion_min / 60) * PX_POR_HORA) : ALTO_MOMENTO,
          }]}>
            <Text style={styles.destinoText}>{arrastre.hora}</Text>
          </View>
        )}
        {/* Bloques */}
        {anchoDia > 0 && porDia.map(({ dia, bloques }, iDia) => bloques.map(b => {
          const anchoCol = anchoDia / b.cols;
          const momento = b.ref.tipo === 'item' ? !b.ref.item.duracion_min : !b.ref.p.rutina.duracion_min;
          const comun = {
            top: (b.inicio / 60) * PX_POR_HORA,
            height: momento ? ALTO_MOMENTO : Math.max(20, ((b.fin - b.inicio) / 60) * PX_POR_HORA),
            left: GUTTER + iDia * anchoDia + b.col * anchoCol,
            width: anchoCol,
            inicio: b.inicio,
            duracion: b.fin - b.inicio,
            momento,
            pxPorHora: PX_POR_HORA,
            anchoDia,
            puedeCambiarDia: semana,
            onArrastre: setArrastrando,
          };
          if (b.ref.tipo === 'proy') {
            const r = b.ref.p.rutina;
            return (
              <BloqueCalendario key={`p-${r.id}-${dia}`} {...comun} titulo={r.titulo} estilo="proyectada"
                color={colorDe(r.area_id)} arrastrable={false} onTap={() => onEditRutina(r)} />
            );
          }
          const it = b.ref.item;
          const estilo = estiloDe(it);
          return (
            <BloqueCalendario
              key={it.id}
              {...comun}
              titulo={it.titulo}
              estilo={estilo}
              color={colorDe(it.area_id)}
              arrastrable
              onTap={() => onEditItem(it)}
              onCheck={estilo === 'tarea' || estilo === 'rutina' ? () => onCheck(it) : undefined}
              onMover={(inicio, desplazados) => {
                const fecha = desplazados ? addDaysKey(dia, desplazados) : dia;
                // En la semana no se puede soltar fuera de los 7 días visibles
                if (semana && !dias.includes(fecha)) return;
                onMover(it, fecha, aHora(inicio));
              }}
              onEstirar={dur => onEstirar(it, dur)}
            />
          );
        }))}
      </ScrollView>

      {/* El ítem "en la mano" mientras se arrastra desde la franja */}
      {arrastre && (
        <Animated.View style={[styles.fantasma, { transform: fantasma.getTranslateTransform() }]}>
          <Text style={styles.fantasmaTitulo} numberOfLines={1}>{arrastre.item.titulo}</Text>
          <Text style={styles.fantasmaHora}>{arrastre.hora ? `→ ${arrastre.hora}` : 'Suelta en la grilla'}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const minutosDeHora = (h: string) => { const [a, b] = h.split(':').map(Number); return Math.min(MIN_DIA, a * 60 + b); };

// Ítem de "todo el día": tocar = editar; mantener apretado ~0,3 s y
// arrastrar = llevarlo a una hora de la grilla. Mismo patrón que los
// bloques (PanResponder, sin librerías).
function ChipArrastrable({ children, style, label, onTap, onInicio, onMover, onSoltar, onCancelar }: {
  children: React.ReactNode;
  style: any;
  label: string;
  onTap: () => void;
  onInicio: (pageX: number, pageY: number) => void;
  onMover: (pageX: number, pageY: number) => void;
  onSoltar: (pageX: number, pageY: number) => void;
  onCancelar: () => void;
}) {
  const arrastrando = useRef(false);
  const tomado = useRef(false);
  const cb = useRef({ onInicio, onMover, onSoltar, onCancelar });
  cb.current = { onInicio, onMover, onSoltar, onCancelar };
  const fin = () => { arrastrando.current = false; tomado.current = false; };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => arrastrando.current,
    onMoveShouldSetPanResponder: () => arrastrando.current,
    onMoveShouldSetPanResponderCapture: () => arrastrando.current,
    onPanResponderTerminationRequest: () => !arrastrando.current,
    onPanResponderGrant: () => { tomado.current = true; },
    onPanResponderMove: (_, g) => cb.current.onMover(g.moveX, g.moveY),
    onPanResponderRelease: (_, g) => { fin(); cb.current.onSoltar(g.moveX, g.moveY); },
    onPanResponderTerminate: () => { fin(); cb.current.onCancelar(); },
  })).current;

  return (
    <View {...responder.panHandlers} style={webSinSeleccion}>
      <Pressable
        style={style}
        onPress={() => { if (!arrastrando.current) onTap(); }}
        onLongPress={e => { arrastrando.current = true; cb.current.onInicio(e.nativeEvent.pageX, e.nativeEvent.pageY); }}
        // Mantuvo apretado pero soltó sin moverse: no pasa nada. Se espera un
        // instante porque al empezar a mover el botón también avisa "soltado"
        // justo antes de que el arrastre tome el gesto.
        onPressOut={() => setTimeout(() => { if (arrastrando.current && !tomado.current) { fin(); cb.current.onCancelar(); } }, 50)}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  todoElDia: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  gutterText: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 10, textAlign: 'center' },
  chip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 11.5 },
  mas: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10.5, textAlign: 'center' },
  horaFila: { position: 'absolute', pointerEvents: 'none', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', marginTop: -6 },
  linea: { flex: 1, height: 1, backgroundColor: colors.border, marginTop: 6 },
  sepDia: { position: 'absolute', pointerEvents: 'none', top: 0, bottom: 0, width: 1, backgroundColor: colors.border },
  ahora: { position: 'absolute', pointerEvents: 'none', height: 2, backgroundColor: colors.danger, zIndex: 40 },
  destino: {
    position: 'absolute', pointerEvents: 'none', zIndex: 45, borderRadius: radius.sm,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentLight, backgroundColor: 'rgba(139,92,246,0.12)',
    paddingHorizontal: 5, justifyContent: 'center',
  },
  destinoText: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 11 },
  fantasma: {
    position: 'absolute', top: 0, left: 0, zIndex: 100, pointerEvents: 'none', width: 140,
    backgroundColor: colors.elevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accentLight,
    paddingHorizontal: 8, paddingVertical: 5, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, elevation: 10,
  },
  fantasmaTitulo: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12 },
  fantasmaHora: { color: colors.accentLight, fontFamily: fonts.medium, fontSize: 11 },
});
