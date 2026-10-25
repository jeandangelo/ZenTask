import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { chart, colors, fonts, radius, space, type } from '../../theme/tokens';
import { Item, Rutina } from '../../domain/types';
import { localDayKey } from '../../domain/dates';
import { INICIO_PROGRESO, resumenSemanal, semanasRecientes, vencidasRegistradas } from '../../domain/progress';
import { cumplimientoEntre } from '../../domain/routines';
import { ProgresoData } from '../../services/api';
import { SectionLabel } from '../ui/ScreenHeader';
import GraficoSemanal from './GraficoSemanal';

// Sección Progreso de Perfil (etapa 5): completadas vs. vencidas por semana
// y cumplimiento de cada rutina marcable (esta semana + las 3 anteriores).

const SEMANAS = 8;

export default function SeccionProgreso({ datos, pendientes, rutinas }: {
  datos: ProgresoData | null;
  pendientes: Item[];   // del store: las vencidas sin completar salen de aquí
  rutinas: Rutina[];
}) {
  if (!datos) {
    return (
      <>
        <SectionLabel title="Progreso" />
        <View style={[styles.card, { alignItems: 'center' }]}><ActivityIndicator color={colors.accent} /></View>
      </>
    );
  }

  const hoy = localDayKey();
  const semanas = semanasRecientes(hoy, SEMANAS);
  const resumen = resumenSemanal(
    datos.completadas.filter(c => !c.rutina_id),
    vencidasRegistradas(datos.reprogramaciones, pendientes, hoy),
    semanas,
  );
  const hayDatos = resumen.some(s => s.completadas || s.vencidas);

  const marcables = rutinas.filter(r => r.marcable && !r.pausada_at);
  const hechasDe = (r: Rutina) => new Set(datos.completadas.filter(c => c.rutina_id === r.id && c.ocurrencia_fecha).map(c => c.ocurrencia_fecha!));
  // Esta semana (lunes a hoy) y las 3 anteriores completas, desde el inicio del progreso
  const lunes = semanas[semanas.length - 1];
  const ventanas = [3, 2, 1].map(k => {
    const desde = localDayKey(addDays(parseISO(lunes), -7 * k));
    return { desde, hasta: localDayKey(addDays(parseISO(desde), 6)) };
  }).filter(v => v.hasta >= INICIO_PROGRESO);

  return (
    <>
      <SectionLabel title="Progreso" />
      <View style={styles.card}>
        <Text style={styles.titulo}>Tareas por semana</Text>
        {hayDatos ? <GraficoSemanal semanas={resumen} /> : (
          <Text style={type.meta}>Todavía no hay datos. El progreso cuenta desde el {format(parseISO(INICIO_PROGRESO), "d 'de' MMMM", { locale: es })}.</Text>
        )}
        <Text style={styles.nota}>Una tarea que venció cuenta como vencida aunque después la reprogrames.</Text>
      </View>

      {marcables.length > 0 && (
        <View style={[styles.card, { marginTop: space.md }]}>
          <Text style={styles.titulo}>Rutinas</Text>
          {marcables.map(r => {
            const hechas = hechasDe(r);
            const actual = cumplimientoEntre(r, hechas, lunes > INICIO_PROGRESO ? lunes : INICIO_PROGRESO, hoy);
            const previas = ventanas.map(v => cumplimientoEntre(r, hechas, v.desde > INICIO_PROGRESO ? v.desde : INICIO_PROGRESO, v.hasta));
            const pct = actual.programadas ? actual.hechas / actual.programadas : 0;
            return (
              <View key={r.id} style={styles.rutina} accessibilityLabel={`${r.titulo}: ${actual.hechas} de ${actual.programadas} esta semana`}>
                <View style={styles.rutinaFila}>
                  <Text style={styles.rutinaNombre} numberOfLines={1}>{r.titulo}</Text>
                  <Text style={styles.rutinaNum}>{actual.hechas}/{actual.programadas}</Text>
                </View>
                <View style={styles.pista}><View style={[styles.relleno, { width: `${Math.round(pct * 100)}%` }]} /></View>
                {previas.some(p => p.programadas) && (
                  <Text style={type.meta}>Semanas anteriores: {previas.filter(p => p.programadas).map(p => `${p.hechas}/${p.programadas}`).join(' · ')}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  titulo: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  nota: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11.5 },
  rutina: { gap: 4, paddingVertical: 6 },
  rutinaFila: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  rutinaNombre: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  rutinaNum: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  pista: { height: 6, borderRadius: 3, backgroundColor: chart.pista, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 3, backgroundColor: chart.completadas },
});
