import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space, type } from '../theme/tokens';
import { api } from '../services/api';
import { notify } from '../services/dialogs';
import { Field, Input, PrimaryButton } from '../components/ui/Fields';

// Inicio de sesión y registro. Al entrar, App.tsx se entera solo por
// onAuthStateChange (el SDK guarda y refresca la sesión).
export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registro, setRegistro] = useState(false);

  const enviar = async () => {
    if (!email.trim() || !password) {
      notify('Faltan datos', 'Escribe tu correo y contraseña.');
      return;
    }
    setLoading(true);
    const { error } = registro
      ? await api.auth.signUp(email.trim(), password)
      : await api.auth.signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      notify('No se pudo entrar', error.message);
    } else if (registro) {
      notify('Revisa tu correo', 'Te enviamos un enlace para confirmar la cuenta.');
      setRegistro(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.box}>
          <Text style={styles.brand}>ZENTASK</Text>
          <Text style={[type.meta, styles.subtitle]}>{registro ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}</Text>
          <Field label="Correo">
            <Input value={email} onChangeText={setEmail} placeholder="tu@correo.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </Field>
          <Field label="Contraseña">
            <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoCapitalize="none" onSubmitEditing={enviar} />
          </Field>
          <PrimaryButton label={loading ? 'Un momento…' : registro ? 'Crear cuenta' : 'Entrar'} onPress={enviar} disabled={loading} />
          <TouchableOpacity onPress={() => setRegistro(r => !r)} style={styles.switch}>
            <Text style={styles.link}>{registro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Créala'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', padding: space.xl },
  box: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 34, color: colors.metalLight, letterSpacing: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: space.sm, marginBottom: space.xxl },
  switch: { alignItems: 'center', marginTop: space.xl },
  link: { color: colors.accentLight, fontFamily: fonts.medium, fontSize: 14 },
});
