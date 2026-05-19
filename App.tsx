import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import CalendarScreen from './src/screens/CalendarScreen'; // <--- IMPORTAR
import { supabase } from './src/services/supabase';
// 👇 IMPORTAMOS EL SERVICIO
import { notificationService } from './src/services/notifications';

import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { Y2K_COLORS } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. INICIALIZAR NOTIFICACIONES AL ARRANCAR
    notificationService.registerForPushNotificationsAsync();

    // 2. VERIFICAR SESIÓN
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) setSession(data.session);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Y2K_COLORS.ACID_GREEN} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          <>
            <Stack.Screen name="Dashboard">
              {(props) => <DashboardScreen {...props} onLogout={() => supabase.auth.signOut()} />}
            </Stack.Screen>
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthScreen onLoginSuccess={() => {}} />} 
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Y2K_COLORS.DEEP_BLACK,
    justifyContent: 'center',
    alignItems: 'center',
  },
});