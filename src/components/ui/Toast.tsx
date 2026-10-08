import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';

// Aviso breve abajo de la pantalla, con acción opcional ("Deshacer").
// Un solo aviso a la vez: uno nuevo reemplaza al anterior.

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

const ToastContext = createContext<(o: ToastOptions) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children, bottomOffset = 0 }: { children: React.ReactNode; bottomOffset?: number }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cada aviso tiene un número: el cierre de uno viejo que termina tarde no
  // debe borrar al aviso nuevo que ya lo reemplazó.
  const current = useRef(0);

  const hide = useCallback((id: number) => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (current.current === id) setToast(null);
    });
  }, [opacity]);

  const show = useCallback((o: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++current.current;
    setToast(o);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => hide(id), o.durationMs ?? 4000);
  }, [hide, opacity]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View style={[styles.wrap, { bottom: bottomOffset + space.md, opacity, pointerEvents: 'box-none' }]}>
          <View style={styles.toast}>
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
            {toast.actionLabel && (
              <TouchableOpacity
                onPress={() => { toast.onAction?.(); hide(current.current); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.action}>{toast.actionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg, maxWidth: 480, width: '100%',
    backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: space.md, paddingHorizontal: space.lg,
  },
  text: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14 },
  action: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 14 },
});
