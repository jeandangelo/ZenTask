import { StyleSheet } from 'react-native';
import { Y2K_COLORS } from '../../theme/colors';

// Estilos compartidos por los modales y formularios del tablero.
export const modalStyles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  formCard: { width: '85%', maxWidth: 400, backgroundColor: '#000', borderWidth: 1, borderColor: Y2K_COLORS.WHITE, padding: 25 },
  formTitle: { color: Y2K_COLORS.ACID_GREEN, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: Y2K_COLORS.DIM_GRAY, fontSize: 12, marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: Y2K_COLORS.DARK_GRAY, color: 'white', padding: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, fontSize: 16 },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE },
  dropdownList: { borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, borderTopWidth: 0, maxHeight: 150, backgroundColor: Y2K_COLORS.DARK_GRAY },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  cancelText: { color: Y2K_COLORS.ERROR, fontWeight: 'bold', padding: 10 },
  cancelBtn: { marginTop: 10, alignItems: 'center', padding: 15 },
  cancelBtnText: { color: Y2K_COLORS.DIM_GRAY, fontWeight: 'bold' },
  saveBtn: { backgroundColor: Y2K_COLORS.ACID_GREEN, paddingVertical: 10, paddingHorizontal: 25 },
  saveText: { color: 'black', fontWeight: 'bold' },
  emptyText: { color: Y2K_COLORS.DIM_GRAY, textAlign: 'center', marginTop: 30, fontFamily: 'monospace' },
});
