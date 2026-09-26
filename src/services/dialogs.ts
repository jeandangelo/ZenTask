import { Alert, Platform } from 'react-native';

// Diálogos que funcionan igual en la PWA y en el celular.
// En web, Alert.alert de react-native-web no muestra nada, así que ahí se
// usan window.alert / window.confirm del navegador.

// Aviso informativo con un solo botón.
export const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

// Pregunta sí/no. Resuelve true solo si el usuario confirma.
export const confirmAction = (
  title: string,
  message: string,
  confirmText = 'Sí',
  destructive = true,
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      // Android: tocar fuera del diálogo equivale a cancelar
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};
