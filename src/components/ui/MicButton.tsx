import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

// Botón de micrófono (etapa 2): dictado con el reconocimiento de voz del
// navegador. Solo aparece donde existe (Chrome, Android); en el resto, el
// dictado del teclado del celular sigue sirviendo. La transcripción en el
// servidor llega con la IA (etapa 6).

const getRecognition = (): any => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const micSupported = () => !!getRecognition();

export default function MicButton({ onText }: { onText: (texto: string) => void }) {
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<any>(null);

  useEffect(() => () => rec.current?.abort?.(), []);
  if (!micSupported()) return null;

  const toggle = () => {
    if (escuchando) { rec.current?.stop(); return; }
    const Recognition = getRecognition();
    const r = new Recognition();
    r.lang = 'es-CL';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const texto = Array.from(e.results as ArrayLike<any>).map((x: any) => x[0]?.transcript ?? '').join(' ').trim();
      if (texto) onText(texto);
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    rec.current = r;
    setEscuchando(true);
    r.start();
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[styles.btn, escuchando && styles.activo]}
      accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Dictar'}
    >
      <MaterialCommunityIcons name={escuchando ? 'microphone' : 'microphone-outline'} size={22} color={escuchando ? '#FFFFFF' : colors.metalLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  activo: { backgroundColor: colors.danger, borderColor: colors.danger },
});
