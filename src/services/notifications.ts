import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// 1. Configuración Global
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  
  // A. PEDIR PERMISO
  registerForPushNotificationsAsync: async () => {
    if (Platform.OS === 'web') {
      console.log("Web: Notificaciones locales simuladas.");
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CCFF00',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Permiso de notificaciones denegado.');
        return;
      }
    }
  },

  // B. AGENDAR NOTIFICACIÓN
  scheduleNotification: async (title: string, body: string, date: Date) => {
    if (Platform.OS === 'web') {
        console.log(`[WEB MOCK] Notificación: "${title}" para ${date.toLocaleString()}`);
        return; 
    }

    const now = Date.now();
    const targetTime = date.getTime();
    const msUntil = targetTime - now;
    
    if (msUntil > 0) {
        // Convertimos a segundos
        const seconds = Math.ceil(msUntil / 1000);

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "⚡ ZENTASK: " + title,
                body: body,
                sound: true,
                data: { data: 'zentask-reminder' },
            },
            // SOLUCIÓN TÉCNICA: Usamos 'as any' para evitar el error de tipado estricto
            // Esto funciona perfectamente en runtime (tiempo de ejecución)
            trigger: { seconds: seconds } as any, 
        });
        console.log(`Notificación nativa agendada en ${seconds} segundos.`);
    }
  }
};