import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { chart, colors, fonts, radius, space, type } from '../../theme/tokens';
import { ResumenSemana } from '../../domain/progress';

// Completadas vs. vencidas por semana (etapa 5). Barras agrupadas: una
// serie por medida en la misma escala (un solo eje). Leyenda siempre
// visible; tocar una semana muestra sus números exactos y "Ver tabla"
// ofrece los datos en texto (no dependen solo del color).

const ALTO = 120;
const corta = (lunes: string) => format(parseISO(lunes), 'd MMM', { locale: es }).replace('.', '');

export default function GraficoSemanal({ semanas }: { semanas: ResumenSemana[] }) {
  const [sel, setSel] = useState(semanas.length - 1);
  const [tabla, setTabla] = useState(false);
  useEffect(() => { setSel(semanas.length - 1); }, [semanas.length]);

  const max = Math.max(1, ...semanas.map(s => Math.max(s.completadas, s.vencidas)));
  const actual = semanas[sel];
  const alto = (v: number) => (v === 0 ? 0 : Math.max(4, (v / max) * ALTO));

  return (
    <View>
      <View style={styles.leyenda}>
        <View style={styles.leyendaItem}><View style={[styles.muestra, { backgroundColor: chart.completadas }]} /><Text style={type.meta}>Completadas</Text></View>
        <View style={styles.leyendaItem}><View style={[styles.muestra, { backgroundColor: chart.vencidas }]} /><Text style={type.meta}>Vencidas</Text></View>
        <TouchableOpacity onPress={() => setTabla(t => !t)} style={{ marginLeft: 'auto' }} accessibilityLabel={tabla ? 'Ver gráfico' : 'Ver tabla'}>
          <Text style={styles.link}>{tabla ? 'Ver gráfico' : 'Ver tabla'}</Text>
        </TouchableOpacity>
      </View>

      {tabla ? (
        <View style={styles.tabla}>
          <View style={styles.tablaFila}>
            <Text style={[styles.celda, styles.cabecera, { flex: 1.4, textAlign: 'left' }]}>Semana del</Text>
            <Text style={[styles.celda, styles.cabecera]}>Completadas</Text>
            <Text style={[styles.celda, styles.cabecera]}>Vencidas</Text>
          </View>
          {[...semanas].reverse().map(s => (
            <View key={s.semana} style={styles.tablaFila}>
              <Text style={[styles.celda, { flex: 1.4, textAlign: 'left' }]}>{corta(s.semana)}</Text>
              <Text style={styles.celda}>{s.completadas}</Text>
              <Text style={styles.celda}>{s.vencidas}</Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* Escala: una sola referencia arriba, recesiva */}
          <Text style={[styles.escala]}>{max}</Text>
          <View style={styles.plot}>
            <View style={[styles.guia, { top: 0 }]} />
            {semanas.map((s, i) => (
              <TouchableOpacity
                key={s.semana}
                style={[styles.grupo, i === sel && styles.grupoSel]}
                onPress={() => setSel(i)}
                accessibilityLabel={`Semana del ${corta(s.semana)}: ${s.completadas} ${s.completadas === 1 ? 'completada' : 'completadas'}, ${s.vencidas} ${s.vencidas === 1 ? 'vencida' : 'vencidas'}`}
                accessibilityState={{ selected: i === sel }}
              >
                <View style={styles.barras}>
                  <View style={[styles.barra, { height: alto(s.completadas), backgroundColor: chart.completadas }]} />
                  <View style={[styles.barra, { height: alto(s.vencidas), backgroundColor: chart.vencidas }]} />
                </View>
                <Text style={[styles.eje, i === sel && { color: colors.text }]} numberOfLines={1}>{corta(s.semana)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {actual && (
            <Text style={styles.lectura}>
              Semana del {corta(actual.semana)}: <Text style={styles.num}>{actual.completadas}</Text> {actual.completadas === 1 ? 'completada' : 'completadas'} · <Text style={styles.num}>{actual.vencidas}</Text> {actual.vencidas === 1 ? 'vencida' : 'vencidas'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.sm },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muestra: { width: 10, height: 10, borderRadius: 2 },
  link: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 12 },
  escala: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 10 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: ALTO + 22, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 },
  guia: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.5 },
  grupo: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', borderRadius: radius.sm, paddingTop: 4 },
  grupoSel: { backgroundColor: 'rgba(255,255,255,0.04)' },
  // Barras delgadas, extremo redondeado arriba y 2 px de separación entre ellas
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: ALTO },
  barra: { width: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  eje: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 9.5, marginTop: 4, marginBottom: 2 },
  lectura: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: space.sm },
  num: { color: colors.text, fontFamily: fonts.semibold },
  tabla: { borderTopWidth: 1, borderTopColor: colors.border },
  tablaFila: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  celda: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 13, textAlign: 'right' },
  cabecera: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
});
