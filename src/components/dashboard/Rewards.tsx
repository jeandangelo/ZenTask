import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Y2K_COLORS } from '../../theme/colors';

// Recompensas visuales al tachar tareas: +XP flotante y aviso de nivel.

export const XPFloatingAnim = ({ visible }: { visible: boolean }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(1);
      liftAnim.setValue(0);
      scaleAnim.setValue(0.5);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(liftAnim, { toValue: -100, duration: 1500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.5, friction: 5, useNativeDriver: true })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.xpContainer, { opacity: fadeAnim, transform: [{ translateY: liftAnim }, { scale: scaleAnim }] }]}>
      <Text style={styles.xpText}>+10 XP</Text>
    </Animated.View>
  );
};

export const LevelUpModal = ({ visible, level, onClose }: { visible: boolean, level: number, onClose: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.levelUpOverlay}>
        <Animated.View style={[styles.levelUpCard, { transform: [{ scale: scaleAnim }] }]}>
          <MaterialCommunityIcons name="arrow-up-bold-hexagon-outline" size={80} color={Y2K_COLORS.ACID_GREEN} />
          <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
          <Text style={styles.levelUpText}>HAS ALCANZADO EL NIVEL</Text>
          <Text style={styles.levelNumber}>{level}</Text>
          <TouchableOpacity style={styles.levelUpBtn} onPress={onClose}>
            <Text style={styles.levelUpBtnText}>CONTINUAR</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  xpContainer: { position: 'absolute', top: '40%', alignSelf: 'center', backgroundColor: Y2K_COLORS.ACID_GREEN, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: 'white', shadowColor: Y2K_COLORS.ACID_GREEN, shadowOpacity: 0.8, shadowRadius: 10, zIndex: 999 },
  xpText: { fontSize: 24, fontWeight: '900', color: 'black' },
  levelUpOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  levelUpCard: { width: 300, padding: 30, backgroundColor: Y2K_COLORS.DARK_GRAY, alignItems: 'center', borderWidth: 2, borderColor: Y2K_COLORS.ACID_GREEN },
  levelUpTitle: { color: Y2K_COLORS.ACID_GREEN, fontSize: 30, fontWeight: '900', marginVertical: 10 },
  levelUpText: { color: 'white', fontSize: 16, marginBottom: 5 },
  levelNumber: { color: 'white', fontSize: 80, fontWeight: 'bold', marginBottom: 20 },
  levelUpBtn: { backgroundColor: Y2K_COLORS.ACID_GREEN, paddingHorizontal: 30, paddingVertical: 10 },
  levelUpBtnText: { color: 'black', fontWeight: 'bold' },
});
