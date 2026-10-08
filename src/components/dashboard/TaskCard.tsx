import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, isPast, isToday, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Y2K_COLORS } from '../../theme/colors';
import { Task } from './types';

interface TaskCardProps {
  item: Task;
  parentGoal?: Task | null;
  isProcessing: boolean;
  onEdit: (item: Task) => void;
  onOptions: (item: Task) => void;
  onToggle: (item: Task) => void;
}

// Tarjeta de una tarea u objetivo: tocar = editar, círculo = tachar, ⋯ = menú de opciones.
export default function TaskCard({ item, parentGoal, isProcessing, onEdit, onOptions, onToggle }: TaskCardProps) {
  let isOverdue = false;
  let dateText = "";
  if (item.due_date && item.status !== 'done') {
      const date = parseISO(item.due_date);
      if (isValid(date)) {
          if (isPast(date) && !isToday(date)) isOverdue = true;
          dateText = format(date, "d MMM", { locale: es }).toUpperCase();
      }
  }

  return (
    <TouchableOpacity style={[styles.card, item.type === 'goal' && styles.goalCard, item.status === 'done' && styles.cardDone, isOverdue && styles.cardOverdue, isProcessing && { opacity: 0.5 }]} onPress={() => !isProcessing && onEdit(item)} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={{flexDirection:'row', alignItems:'center', flex: 1, flexWrap: 'wrap'}}>
           <Text style={[styles.cardTag, isOverdue && {color: Y2K_COLORS.ERROR}]}>
             {item.tag ? `#${item.tag}` : ''} {dateText ? ` // ${dateText}` : ''}
           </Text>
           {isOverdue && <MaterialCommunityIcons name="alert-circle" size={14} color={Y2K_COLORS.ERROR} style={{marginLeft:5}} />}
           {parentGoal && (<View style={styles.linkedBadgeLarge}><MaterialCommunityIcons name="trophy" size={12} color="black" /><Text style={styles.linkedTextLarge}>{parentGoal.title.substring(0, 10)}..</Text></View>)}
        </View>
        <TouchableOpacity onPress={() => onOptions(item)} style={{ padding: 5 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><MaterialCommunityIcons name="dots-horizontal" size={24} color={Y2K_COLORS.LIGHT_GRAY} /></TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <TouchableOpacity onPress={() => onToggle(item)} disabled={isProcessing} style={styles.checkboxContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {isProcessing ? <ActivityIndicator size="small" color={Y2K_COLORS.ACID_GREEN} /> :
             <View style={[styles.checkbox, item.status === 'done' && { backgroundColor: Y2K_COLORS.ACID_GREEN, borderColor: Y2K_COLORS.ACID_GREEN }, item.type === 'goal' && { borderRadius: 6 }, isOverdue && item.status !== 'done' && { borderColor: Y2K_COLORS.ERROR }]}>
                {item.status === 'done' && <MaterialCommunityIcons name="check" size={20} color="black" />}
             </View>
          }
        </TouchableOpacity>
        <View style={{flex: 1}}>
           <Text style={[styles.cardTitle, item.status === 'done' && { textDecorationLine: 'line-through', color: Y2K_COLORS.DIM_GRAY }, item.type === 'goal' && { fontSize: 20, color: Y2K_COLORS.ACID_GREEN }, isOverdue && item.status !== 'done' && { color: Y2K_COLORS.ERROR }]}>{item.title}</Text>
           {item.description ? <Text style={[styles.cardDescription, item.status === 'done' && { color: '#444' }]}>{item.description}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const cardStyles = StyleSheet.create({
  card: { backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, borderLeftWidth: 4, borderLeftColor: Y2K_COLORS.DIM_GRAY },
});

const styles = StyleSheet.create({
  card: cardStyles.card,
  cardOverdue: { borderColor: Y2K_COLORS.ERROR, borderLeftColor: Y2K_COLORS.ERROR, backgroundColor: 'rgba(255, 0, 60, 0.05)' },
  cardDone: { opacity: 0.6, borderLeftColor: Y2K_COLORS.ACID_GREEN, backgroundColor: '#111' },
  goalCard: { backgroundColor: '#0A0A0A', borderLeftColor: Y2K_COLORS.ACID_GREEN, borderWidth: 1, borderColor: Y2K_COLORS.ACID_GREEN },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTag: { color: Y2K_COLORS.DIM_GRAY, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
  linkedBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Y2K_COLORS.ACID_GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 10 },
  linkedTextLarge: { fontSize: 11, fontWeight: 'bold', color: 'black', marginLeft: 4 },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: Y2K_COLORS.WHITE, fontSize: 16, fontWeight: '600', flex: 1 },
  cardDescription: { color: Y2K_COLORS.DIM_GRAY, fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  checkboxContainer: { marginRight: 12 },
  checkbox: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: Y2K_COLORS.DIM_GRAY, justifyContent: 'center', alignItems: 'center' },
});
