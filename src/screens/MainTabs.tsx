import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { useZen } from '../state/ZenStore';
import TabBar, { TabKey } from '../components/ui/TabBar';
import HomeScreen from './HomeScreen';
import TareasScreen from './TareasScreen';
import RutinasScreen from './RutinasScreen';
import ComprasScreen from './ComprasScreen';
import PerfilScreen from './PerfilScreen';

// Contenedor de las 5 pestañas. Se abre en Inicio (captura primero).
// Las pestañas visitadas quedan montadas (ocultas) para conservar el
// scroll y los filtros al volver.
export default function MainTabs() {
  const { loading, entradas, items } = useZen();
  const [tab, setTab] = useState<TabKey>('home');
  const [visitadas, setVisitadas] = useState<Set<TabKey>>(new Set(['home']));

  const cambiar = (k: TabKey) => {
    setTab(k);
    setVisitadas(v => (v.has(k) ? v : new Set(v).add(k)));
  };

  const sinOrdenar = entradas.filter(e => e.estado === 'sin_ordenar').length;
  const compras = items.filter(i => i.tipo === 'compra').length;

  const pantallas: Record<TabKey, React.ReactNode> = {
    home: <HomeScreen />, tareas: <TareasScreen />, rutinas: <RutinasScreen />,
    compras: <ComprasScreen />, perfil: <PerfilScreen />,
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : (
          (Object.keys(pantallas) as TabKey[]).filter(k => visitadas.has(k)).map(k => (
            <View key={k} style={[styles.flex, k !== tab && styles.oculta]}>{pantallas[k]}</View>
          ))
        )}
      </SafeAreaView>
      <TabBar active={tab} onChange={cambiar} badges={{ tareas: sinOrdenar, compras }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  oculta: { display: 'none' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
