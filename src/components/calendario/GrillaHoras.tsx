import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Item, Rutina } from '../../domain/types';
import { addDaysKey, localDayKey, shortTime } from '../../domain/dates';
import { distribuir, Proyeccion, proyectarRutinas, rangoDe } from '../../domain/calendar';
import BloqueCalendario, { EstiloBloque } from './BloqueCalendario';

// Grilla por horas de 1 día (vista día) o 7 (vista semana): arriba la
// franja "todo el día" (ítems con fecha y sin hora, y rutinas flexibles
// por planificar); abajo las 24 horas con los bloques posicionados.

export const PX_POR_HORA = 52;
const GUTTER = 42; // columna de las horas

type Ref = { tipo: 'item'; item: Item } | { tipo: 'proy'; p: Proyeccion };

export default function GrillaHoras({ dias, items, rutinas, colorDe, onEditItem, onEditRutina, onCheck, onMover }: {
  dias: string[];
  items: Item[];               // pendientes con fecha (ya filtrados por área)
  rutinas: Rutina[];
  colorDe: (areaId: string | null) => string;
  onEditItem: (item: Item) => void;
  onEditRutina: (r: Rutina) => void;
  onCheck: (item: Item) => void;
  onMover: (item: Item, fecha: string, hora: string) => void;
}) {
  const [ancho, setAncho] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const hoy = localDayKey();
  const semana = dias.length > 1;
  const anchoDia = Math.max(0, (ancho - GUTTER) / dias.length);
  const rutinaDe = (id: string | null) => (id ? rutinas.find(r => r.id === id) : undefined);

  // Al abrir: la grilla parte una hora antes de ahora (o a las 7:00)
  useEffect(() => {
    const h = dias.includes(hoy) ? Math.max(0, new Date().getHours() - 1) : 7;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: h * PX_POR_HORA, animated: false }), 50);
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

  return (
    <View style={{ flex: 1 }} onLayout={e => setAncho(e.nativeEvent.layout.width)}>
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
                  <TouchableOpacity
                    key={it.id}
                    onPress={() => onEditItem(it)}
                    style={[styles.chip, { borderColor: color }, r && { borderStyle: 'dashed' }, it.tipo === 'evento' && { backgroundColor: color }]}
                    accessibilityLabel={`${it.titulo}${porPlanificar ? ', por planificar' : ''}`}
                  >
                    <Text numberOfLines={1} style={[styles.chipText, it.tipo === 'evento' && { color: '#0B0B0F' }]}>
                      {it.titulo}{!semana && porPlanificar ? `  ·  por planificar ${shortTime(r!.rango_inicio)}–${shortTime(r!.rango_fin)}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {semana && sinHora.length > 2 && <Text style={styles.mas}>+{sinHora.length - 2}</Text>}
            </View>
          ))}
        </View>
      )}

      <ScrollView ref={scroll} style={{ flex: 1 }} scrollEnabled={!arrastrando} contentContainerStyle={{ height: 24 * PX_POR_HORA + space.xl }}>
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
        {/* Bloques */}
        {anchoDia > 0 && porDia.map(({ dia, bloques }, iDia) => bloques.map(b => {
          const ancho = anchoDia / b.cols;
          const comun = {
            top: (b.inicio / 60) * PX_POR_HORA,
            height: Math.max(20, ((b.fin - b.inicio) / 60) * PX_POR_HORA),
            left: GUTTER + iDia * anchoDia + b.col * ancho,
            width: ancho,
            inicio: b.inicio,
            duracion: b.fin - b.inicio,
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
                onMover(it, fecha, `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}`);
              }}
            />
          );
        }))}
      </ScrollView>
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
});

