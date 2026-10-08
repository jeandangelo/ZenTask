import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { api } from './src/services/api';
import { colors } from './src/theme/tokens';
import { ToastProvider } from './src/components/ui/Toast';
import { TAB_BAR_HEIGHT } from './src/components/ui/TabBar';
import { ZenStoreProvider } from './src/state/ZenStore';
import AuthScreen from './src/screens/AuthScreen';
import MainTabs from './src/screens/MainTabs';

// Raíz: carga las fuentes, revisa la sesión y muestra login o la app.
export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.auth.getSession()
      .then(setSession)
      .catch(e => console.error('Error leyendo la sesión:', e))
      .finally(() => setChecking(false));
    const sub = api.auth.onAuthStateChange(s => { setSession(s); setChecking(false); });
    return () => sub.unsubscribe();
  }, []);

  const signOut = useCallback(() => { api.auth.signOut(); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.root}>
        {!fontsLoaded || checking ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : session?.user ? (
          <AppConSesion key={session.user.id} onAuthLost={signOut} />
        ) : (
          <AuthScreen />
        )}
      </View>
    </SafeAreaProvider>
  );
}

// El aviso (toast) se dibuja justo encima de la barra inferior
function AppConSesion({ onAuthLost }: { onAuthLost: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ToastProvider bottomOffset={TAB_BAR_HEIGHT + insets.bottom}>
      <ZenStoreProvider onAuthLost={onAuthLost}>
        <MainTabs />
      </ZenStoreProvider>
    </ToastProvider>
  );
}

// Solo web: fija el alto al viewport y evita el scroll del body en la PWA.
// '100vh' es CSS válido pero no existe en los tipos de RN, de ahí el cast.
const webViewportFill = Platform.select({
  web: { height: '100vh', overflow: 'hidden' } as unknown as ViewStyle,
  default: {} as ViewStyle,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, ...webViewportFill },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
