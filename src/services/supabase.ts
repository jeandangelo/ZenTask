import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://smbdvvbijpsmwyaqfjio.supabase.co';

// ⚠️ CAMBIO CRÍTICO: Usamos la misma llave que en AuthScreen (la Legacy)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYmR2dmJpanBzbXd5YXFmamlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDY1NzAsImV4cCI6MjA3ODgyMjU3MH0.9TeTd6hE6YvdpU0NW1codYWNNfF32vPefmlwZnNXmYc';

export const api = {
  // ... (tu código de api existente sigue aquí, no lo borres) ...
};

// Exportamos la instancia con la llave compatible
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ... Asegúrate de volver a pegar el objeto 'api' que te di en el paso anterior ...
// (Si borraste el contenido, dímelo y te paso el archivo completo de nuevo)