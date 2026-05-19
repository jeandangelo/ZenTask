import { StyleSheet } from 'react-native';

export const Y2K_COLORS = {
  ACID_GREEN: '#CCFF00',    // Amarillo/Verde Ácido (Logo y FAB)
  DEEP_BLACK: '#0D0D0D',    // Fondo
  DARK_GRAY: '#1A1A1A',     // Fondo Tarjetas
  
  // NUEVO ROSADO: Más oscuro y opaco (Deep Raspberry)
  HOT_PINK: '#B3005E',      
  
  WHITE: '#FFFFFF',
  DIM_GRAY: '#888888',
  BORDER: '#333333',

  // Alias de compatibilidad
  NEON_YELLOW: '#CCFF00',
  METAL_GRAY: '#1A1A1A',
  LIGHT_GRAY: '#888888',
  GRID_LINE: '#333333',
  ERROR: '#B3005E',         // Usamos el nuevo rosa para errores/acciones destructivas
  SUCCESS: '#CCFF00',
  PRIMARY: '#CCFF00',
  SECONDARY: '#FFFFFF',
  BACKGROUND: '#0D0D0D',
};

export const GLOBAL_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Y2K_COLORS.DEEP_BLACK,
    padding: 20,
  },
  appName: {
    fontSize: 42,
    color: Y2K_COLORS.ACID_GREEN,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: Y2K_COLORS.DIM_GRAY,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'monospace',
  },
  headerTitle: {
    fontSize: 28,
    color: Y2K_COLORS.ACID_GREEN,
    fontWeight: '900',
    textAlign: 'center',
  }
});