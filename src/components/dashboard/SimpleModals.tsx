import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Y2K_COLORS } from '../../theme/colors';
import { DbItem } from '../../services/api';
import { Recurrence, RECURRENCE_LABELS } from '../../domain/routines';
import { modalStyles } from './modalStyles';
import { cardStyles } from './TaskCard';
import { Task } from './types';

// Modales chicos del tablero. El formulario de tarea/objetivo sigue en
// DashboardScreen porque comparte mucho estado con la pantalla.

// Menú del botón "+": qué se quiere crear.
export const CreateSelectorModal = ({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (type: 'task' | 'goal', shopping?: boolean) => void;
}) => (
  <Modal transparent visible={visible} animationType="fade">
    <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.selectorBox}>
        <TouchableOpacity style={styles.selectorOption} onPress={() => onPick('task')}><MaterialCommunityIcons name="checkbox-blank-circle-outline" size={24} color={Y2K_COLORS.WHITE} /><Text style={styles.selectorText}>NUEVA TAREA</Text></TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.selectorOption} onPress={() => onPick('task', true)}><MaterialCommunityIcons name="cart-outline" size={24} color={Y2K_COLORS.WHITE} /><Text style={styles.selectorText}>NUEVA COMPRA</Text></TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.selectorOption} onPress={() => onPick('goal')}><MaterialCommunityIcons name="trophy-outline" size={24} color={Y2K_COLORS.ACID_GREEN} /><Text style={[styles.selectorText, {color: Y2K_COLORS.ACID_GREEN}]}>NUEVO OBJETIVO</Text></TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// Menú del ⋯ de una tarjeta. Por ahora: editar y eliminar; acá se irán
// sumando acciones (mover de lista, posponer…) cuando se definan.
export const TaskOptionsModal = ({ item, onEdit, onDelete, onClose }: {
  item: Task | null;
  onEdit: (item: Task) => void;
  onDelete: (item: Task) => void;
  onClose: () => void;
}) => (
  <Modal transparent visible={!!item} animationType="fade">
    <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={onClose}>
      {item && (
        <View style={styles.selectorBox}>
          <Text style={styles.optionsTitle} numberOfLines={2}>{item.title}</Text>
          <TouchableOpacity style={styles.selectorOption} onPress={() => onEdit(item)}><MaterialCommunityIcons name="pencil-outline" size={24} color={Y2K_COLORS.WHITE} /><Text style={styles.selectorText}>EDITAR</Text></TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.selectorOption} onPress={() => onDelete(item)}><MaterialCommunityIcons name="trash-can-outline" size={24} color={Y2K_COLORS.ERROR} /><Text style={[styles.selectorText, {color: Y2K_COLORS.ERROR}]}>ELIMINAR</Text></TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  </Modal>
);

// Crear o renombrar una columna.
export const ColumnFormModal = ({ visible, isEditing, title, onChangeTitle, onCancel, onConfirm }: {
  visible: boolean;
  isEditing: boolean;
  title: string;
  onChangeTitle: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={modalStyles.modalOverlay}>
      <View style={modalStyles.formCard}>
        <Text style={modalStyles.formTitle}>{isEditing ? 'RENOMBRAR' : 'NUEVA COLUMNA'}</Text>
        <TextInput style={modalStyles.input} value={title} onChangeText={onChangeTitle} placeholder="Ej. PROYECTOS" placeholderTextColor={Y2K_COLORS.DIM_GRAY} autoFocus />
        <View style={modalStyles.formActions}>
          <TouchableOpacity onPress={onCancel}><Text style={modalStyles.cancelText}>CANCELAR</Text></TouchableOpacity>
          <TouchableOpacity style={modalStyles.saveBtn} onPress={onConfirm}><Text style={modalStyles.saveText}>CONFIRMAR</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Lista de rutinas activas (plantillas) con opción de dejar de repetir.
export const RoutinesModal = ({ visible, routines, onDelete, onClose }: {
  visible: boolean;
  routines: DbItem[];
  onDelete: (id: string) => void;
  onClose: () => void;
}) => (
  <Modal transparent visible={visible} animationType="slide">
    <View style={modalStyles.modalOverlay}>
      <View style={[modalStyles.formCard, {height: '60%'}]}>
        <Text style={modalStyles.formTitle}>MIS RUTINAS ACTIVAS</Text>
        <Text style={{color:Y2K_COLORS.DIM_GRAY, marginBottom: 15, textAlign:'center'}}>Estas tareas se generan automáticamente.</Text>
        <ScrollView>
          {routines.length === 0 ? (
            <Text style={modalStyles.emptyText}>No tienes rutinas configuradas.</Text>
          ) : (
            routines.map(r => (
              <View key={r.id} style={[cardStyles.card, {flexDirection:'row', justifyContent:'space-between', alignItems:'center'}]}>
                <View style={{flex: 1}}>
                  <Text style={{color:'white', fontWeight:'bold'}}>{r.title}</Text>
                  <Text style={{color:Y2K_COLORS.ACID_GREEN, fontSize:10}}>REPETICIÓN: {RECURRENCE_LABELS[(r.recurrence || 'none') as Recurrence] ?? r.recurrence?.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => onDelete(r.id)} style={{padding:10}}>
                  <MaterialCommunityIcons name="trash-can" size={20} color={Y2K_COLORS.ERROR} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={[modalStyles.cancelBtn, {marginTop:20}]} onPress={onClose}><Text style={modalStyles.cancelBtnText}>CERRAR</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  selectorBox: { width: 280, backgroundColor: Y2K_COLORS.DARK_GRAY, borderWidth: 1, borderColor: Y2K_COLORS.ACID_GREEN, padding: 20 },
  selectorOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  selectorText: { color: Y2K_COLORS.WHITE, marginLeft: 15, fontWeight: 'bold' },
  optionsTitle: { color: Y2K_COLORS.DIM_GRAY, fontFamily: 'monospace', fontSize: 12, marginBottom: 5 },
  divider: { height: 1, backgroundColor: Y2K_COLORS.GRID_LINE, width: '100%' },
});
