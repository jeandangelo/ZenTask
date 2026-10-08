// Tokens de diseño del rediseño (docs/rediseno.md, sección 7): Y2K
// modernizado en negros, grises metálicos y morados. Toda la interfaz
// nueva toma colores, tipografía y medidas de aquí, para poder ajustar la
// paleta o la fuente en un solo lugar.

export const colors = {
  bg: '#0B0B0F',          // fondo de la app
  surface: '#16161C',     // tarjetas, barra inferior
  elevated: '#22222A',    // menús, hojas, modales
  border: '#2A2A33',      // separadores sutiles
  metal: '#8A8D96',       // bordes, íconos activos (inicio del degradado)
  metalLight: '#C9CCD3',  // detalles cromados (fin del degradado)
  text: '#ECECF1',        // títulos y texto
  textMuted: '#9A9AA6',   // metadatos, fechas
  textFaint: '#5E5E6A',   // texto deshabilitado / placeholders
  accent: '#8B5CF6',      // botón enviar, selección, elementos activos
  accentLight: '#A78BFA', // hover, chips seleccionados
  danger: '#E5677A',      // eliminar, vencidas
  overlay: 'rgba(0,0,0,0.6)',
};

// Paleta para áreas: 8 colores apagados que se leen sobre negro. El morado
// de acento queda reservado para la interfaz, por eso no está aquí.
export const AREA_COLORS = [
  { nombre: 'Azul acero', hex: '#6E8BB0' },
  { nombre: 'Ámbar', hex: '#C9A15A' },
  { nombre: 'Coral', hex: '#C97A6B' },
  { nombre: 'Cian frío', hex: '#5FA8B8' },
  { nombre: 'Magenta', hex: '#B8679A' },
  { nombre: 'Menta', hex: '#6FB59A' },
  { nombre: 'Violeta', hex: '#9B8AC4' },
  { nombre: 'Plata', hex: '#A9ADB6' },
] as const;

// Nombres de fuente registrados en App.tsx con useFonts.
// `display` es la fuente de títulos grandes y números destacados (XP,
// nivel): por ahora Inter Bold; cuando Jean elija la fuente Y2K se cambia
// solo esta línea (y su carga en App.tsx).
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Inter_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const type = {
  // Mayúsculas solo en etiquetas cortas (nombres de sección, chips)
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: colors.textMuted },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
};
