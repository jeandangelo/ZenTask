import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, TextStyle, ViewStyle, View, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Y2K_COLORS, GLOBAL_STYLES } from '../theme/colors';
// 👇 IMPORTANTE: Importamos el cliente de Supabase para inyectarle la sesión
import { supabase } from '../services/supabase'; 

const API_URL = 'https://smbdvvbijpsmwyaqfjio.supabase.co/auth/v1';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYmR2dmJpanBzbXd5YXFmamlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDY1NzAsImV4cCI6MjA3ODgyMjU3MH0.9TeTd6hE6YvdpU0NW1codYWNNfF32vPefmlwZnNXmYc';

interface AuthProps {
  onLoginSuccess: (user: any) => void;
}

const AuthScreen = ({ onLoginSuccess }: AuthProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      showAlert("Faltan datos", "Ingresa email y contraseña");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegisterMode ? '/signup' : '/token?grant_type=password';
      const url = `${API_URL}${endpoint}`;

      // 1. Login Manual (HTTP Puro)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.msg || data.error_description || "Error desconocido");

      if (isRegisterMode) {
        showAlert("VERIFICACIÓN", "Revisa tu correo y confirma la cuenta.");
        setIsRegisterMode(false);
      } else {
        // 2. SINCRONIZACIÓN CRÍTICA (FIXED)
        if (data.access_token && data.refresh_token) {
            // Await explícito: No pasamos de aquí hasta que Supabase diga OK
            const { error } = await supabase.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
            });
            
            if (error) throw error;

            // Doble chequeo: Preguntar a Supabase si ya tiene el usuario
            // Esto garantiza que getDashboardData no fallará después
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                console.log("Sesión confirmada y lista.");
                // 3. AHORA SÍ avisamos a la App
                onLoginSuccess(user); 
            } else {
                throw new Error("Error de sincronización de sesión.");
            }
        }
      }

    } catch (err: any) {
      console.error("Error API:", err);
      showAlert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ESTILOS (Sin cambios) ---
  const ACID_INPUT: TextStyle = {
    color: Y2K_COLORS.WHITE,
    backgroundColor: Y2K_COLORS.DARK_GRAY,
    borderWidth: 2,
    borderColor: Y2K_COLORS.BORDER, // Borde oscuro por defecto
    padding: 18,
    marginBottom: 15,
    fontSize: 16,
    fontWeight: 'bold',
    borderRadius: 0, // Bordes cuadrados agresivos
  };

  const ACID_BUTTON: ViewStyle = {
    backgroundColor: Y2K_COLORS.ACID_GREEN,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: Y2K_COLORS.WHITE,
    shadowColor: '#FFF',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    // @ts-ignore
    cursor: 'pointer',
  };

  const LINK_TEXT: TextStyle = {
    color: Y2K_COLORS.LIGHT_GRAY, 
    textDecorationLine: 'underline', 
    fontSize: 14,
    marginTop: 20,
    // @ts-ignore
    cursor: 'pointer',
  };

  return (
    <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ width: '100%', maxWidth: 400 }}>
        
        <Text style={GLOBAL_STYLES.appName}>ZenTask</Text>
        <Text style={GLOBAL_STYLES.subtitle}>
          {isRegisterMode ? '>> INICIAR PROTOCOLO DE ALTA' : '>> CREDENCIALES DE ACCESO'}
        </Text>

        <TextInput
          style={ACID_INPUT}
          onChangeText={setEmail}
          value={email}
          placeholder="CORREO ELECTRÓNICO"
          placeholderTextColor={Y2K_COLORS.LIGHT_GRAY}
          autoCapitalize="none"
        />
        
        <TextInput
          style={ACID_INPUT}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={true}
          placeholder="CONTRASEÑA"
          placeholderTextColor={Y2K_COLORS.LIGHT_GRAY}
          autoCapitalize="none"
        />

        <TouchableOpacity style={ACID_BUTTON} onPress={handleAuth} disabled={loading}>
          <Text style={{ color: Y2K_COLORS.DEEP_BLACK, fontWeight: '900', fontSize: 18, letterSpacing: 1 }}>
            {loading ? 'PROCESANDO...' : (isRegisterMode ? 'REGISTRAR AGENTE' : 'ACCEDER AL SISTEMA')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setIsRegisterMode(!isRegisterMode)}>
          <Text style={LINK_TEXT}>
            {isRegisterMode ? '¿Ya tienes ID? Ingresar' : '¿Sin ID? Solicitar Acceso'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

export default AuthScreen;