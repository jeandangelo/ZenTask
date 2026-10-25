import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Item, Rutina } from '../../domain/types';
import { addDaysKey, localDayKey } from '../../domain/dates';
import { grillaMes, puntosDelMes, semanaDe } from '../../domain/calendar';
import { Segmented } from '../ui/Fields';
import GrillaHoras from './GrillaHoras';

// Calendario de la pestaña Tareas (etapa 4): vistas día, semana y mes.
// La vista mes muestra puntos por área (sin rutinas); tocar un día abre
// ese día.

export type VistaCal = 'dia' | 'semana' | 'mes';

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function CalendarioView({ dia, setDia, items, rutinas, colorDe, onEditItem, onEditRutina, onCheck, onMover }: {
  dia: string;
  setDia: (d: string) => void;
  items: Item[];
  rutinas: Rutina[];
  colorDe: (areaId: string | null) => string;
  onEditItem: (item: Item) => void;
  onEditRutina: (r: Rutina) => void;
  onCheck: (item: Item) => void;
  onMover: (item: Item, fecha: string, hora: string) => void;
}) {
  const [vista, setVista] = useState<VistaCal>('dia');
  const hoy = localDayKey();
  const semana = semanaDe(dia);

  const mover = (dir: -1 | 1) => {
    if (vista === 'dia') setDia(addDaysKey(dia, dir));
    else if (vista === 'semana') setDia(addDaysKey(dia, 7 * dir));
    else setDia(localDayKey(addMonths(parseISO(dia), dir)));
  };

  const titulo = vista === 'dia'
    ? cap(format(parseISO(dia), "EEEE d 'de' MMMM", { locale: es }))
    : vista === 'semana'
      ? `${format(parseISO(semana[0]), 'd MMM', { locale: es })} – ${format(parseISO(semana[6]), 'd MMM', { locale: es })}`
      : cap(format(parseISO(dia), 'MMMM yyyy', { locale: es }));

  const puntos = useMemo(() => puntosDelMes(items), [items]);
  const celdas = useMemo(() => grillaMes(dia), [dia]);

  const comunes = { items, rutinas, colorDe, onEditItem, onEditRutina, onCheck, onMover };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.barra}>
        <Segmented<VistaCal>
          options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]}
          value={vista}
          onChange={setVista}
        />
      </View>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => mover(-1)} style={styles.flecha} accessibilityLabel="Anterior">
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.metalLight} />
        </TouchableOpacity>
        <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
        <TouchableOpacity onPress={() => mover(1)} style={styles.flecha} accessibilityLabel="Siguiente">
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.metalLight} />
        </TouchableOpacity>
        {dia !== hoy && (
          <TouchableOpacity onPress={() => setDia(hoy)} style={styles.hoyBtn} accessibilityLabel="Ir a hoy">
            <Text style={styles.hoyText}>Hoy</Text>
          </TouchableOpacity>
        )}
      </View>

      {vista === 'semana' && (
        <View style={styles.cabeceraSemana}>
          <View style={{ width: 42 }} />
          {semana.map((d, i) => (
            <TouchableOpacity key={d} style={{ flex: 1, alignItems: 'center' }} onPress={() => { setDia(d); setVista('dia'); }} accessibilityLabel={`Abrir ${d}`}>
              <Text style={styles.diaSemana}>{DIAS_CORTOS[i]}</Text>
              <View style={[styles.num, d === hoy && styles.numHoy]}>
                <Text style={[styles.numText, d === hoy && { color: '#FFFFFF' }]}>{parseISO(d).getDate()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {vista === 'dia' && <GrillaHoras dias={[dia]} {...comunes} />}
      {vista === 'semana' && <GrillaHoras dias={semana} {...comunes} />}
      {vista === 'mes' && (
        <View style={styles.mes}>
          <View style={styles.mesFila}>
            {DIAS_CORTOS.map(d => <Text key={d} style={[styles.diaSemana, { flex: 1, textAlign: 'center' }]}>{d}</Text>)}
          </View>
          {Array.from({ length: celdas.length / 7 }, (_, s) => (
            <View key={s} style={styles.mesFila}>
              {celdas.slice(s * 7, s * 7 + 7).map(c => {
                const areas = puntos.get(c.dia) ?? [];
                return (
                  <TouchableOpacity
                    key={c.dia}
                    style={[styles.celda, c.dia === dia && styles.celdaSel]}
                    onPress={() => { setDia(c.dia); setVista('dia'); }}
                    accessibilityLabel={`${c.dia}${areas.length ? `, ${areas.length} pendientes` : ''}`}
                  >
                    <View style={[styles.num, c.dia === hoy && styles.numHoy]}>
                      <Text style={[styles.numText, !c.delMes && { color: colors.textFaint }, c.dia === hoy && { color: '#FFFFFF' }]}>
                        {parseISO(c.dia).getDate()}
                      </Text>
                    </View>
                    <View style={styles.puntos}>
                      {areas.slice(0, 3).map((a, i) => <View key={i} style={[styles.punto, { backgroundColor: colorDe(a || null) }]} />)}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <Text style={styles.nota}>Los puntos son tareas, eventos y compras con fecha. Las rutinas se ven en las vistas día y semana.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: { paddingHorizontal: space.lg, paddingTop: space.xs },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  flecha: { padding: 4 },
  titulo: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  hoyBtn: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  hoyText: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 13 },
  cabeceraSemana: { flexDirection: 'row', paddingBottom: space.xs },
  diaSemana: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numHoy: { backgroundColor: colors.accent },
  numText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  mes: { paddingHorizontal: space.sm, gap: 2 },
  mesFila: { flexDirection: 'row' },
  celda: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm, minHeight: 54 },
  celdaSel: { backgroundColor: colors.surface },
  puntos: { flexDirection: 'row', gap: 3, marginTop: 4 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  nota: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: space.lg, paddingHorizontal: space.lg },
});
