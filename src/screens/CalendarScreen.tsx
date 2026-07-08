import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isSameDay, addDays } from 'date-fns'; // Usamos date-fns para comparar fechas reales
import { es } from 'date-fns/locale';
import { Y2K_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { api } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

// Configuración de idioma
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

// ¿La rutina (plantilla) corresponde a esta fecha?
const routineOccursOn = (routine: any, date: Date) => {
  if (routine.recurrence === 'daily') return true;
  if (routine.recurrence === 'weekly') return date.getDay() === routine.recurrence_day;
  if (routine.recurrence === 'monthly') return date.getDate() === routine.recurrence_day;
  return false;
};

// Días hacia adelante que proyectamos las rutinas en el calendario
const PROJECTION_DAYS = 90;

export default function CalendarScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  // Inicializamos con la fecha local de hoy (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  // Usamos useFocusEffect para recargar datos al volver al calendario
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const data = await api.getDashboardData();
      const allTasks = data.items || [];
      const allRoutines = await api.getRoutines();
      setTasks(allTasks);
      setRoutines(allRoutines);
      processMarkers(allTasks, allRoutines);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE MARCADORES MEJORADA ---
  const processMarkers = (items: any[], routineList: any[]) => {
    const marks: any = {};

    items.forEach(task => {
      if (task.due_date && task.status !== 'done') {
        // CORRECCIÓN: Usamos la zona horaria local para decidir dónde va el punto
        const localDate = parseISO(task.due_date);
        const dateKey = format(localDate, 'yyyy-MM-dd');

        marks[dateKey] = {
          marked: true,
          dotColor: Y2K_COLORS.ACID_GREEN,
          activeOpacity: 0
        };
      }
    });

    // PROYECCIÓN DE RUTINAS: punto verde en los próximos días donde toca cada rutina
    const today = new Date();
    for (let i = 0; i <= PROJECTION_DAYS; i++) {
      const day = addDays(today, i);
      if (routineList.some(r => routineOccursOn(r, day))) {
        const dateKey = format(day, 'yyyy-MM-dd');
        marks[dateKey] = { ...(marks[dateKey] || {}), marked: true, dotColor: Y2K_COLORS.ACID_GREEN, activeOpacity: 0 };
      }
    }

    // Aseguramos que el día seleccionado se mantenga marcado visualmente
    // Usamos el estado actual de selectedDate
    const currentSelected = selectedDate; // Usamos la variable de estado o una referencia
    
    // Nota: Al cargar por primera vez, selectedDate es Hoy.
    // Aplicamos el estilo de selección al día actual en el mapa
    if (marks[currentSelected]) {
        marks[currentSelected] = { ...marks[currentSelected], selected: true, selectedColor: Y2K_COLORS.ACID_GREEN };
    } else {
        marks[currentSelected] = { selected: true, selectedColor: Y2K_COLORS.ACID_GREEN, disableTouchEvent: true };
    }
    
    setMarkedDates(marks);
  };

  // --- FILTRADO INTELIGENTE ---
  // Tareas reales del día: su estado (tachada o no) pertenece SOLO a este día
  const realTasksForDay = tasks.filter(t => {
    if (!t.due_date) return false;
    // Comparamos la fecha de la tarea con la fecha seleccionada usando date-fns
    // Esto maneja mejor las zonas horarias que una comparación de strings simple
    return isSameDay(parseISO(t.due_date), parseISO(selectedDate));
  });

  // Rutinas proyectadas: solo de hoy en adelante, siempre PENDIENTES (jamás tachadas),
  // y sin duplicar una tarea real ya generada ese día con el mismo título
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const projectedForDay = selectedDate >= todayStr
    ? routines
        .filter(r => routineOccursOn(r, parseISO(selectedDate)))
        .filter(r => !realTasksForDay.some(t => t.title === r.title))
        .map(r => ({
          id: `routine-${r.id}-${selectedDate}`,
          title: r.title,
          tag: r.tag || 'RUTINA',
          status: 'pending',
          projected: true
        }))
    : [];

  const tasksForDay = [...realTasksForDay, ...projectedForDay];

  const onDayPress = (day: any) => {
    const newDate = day.dateString;
    setSelectedDate(newDate);

    // Actualizamos visualmente la selección sin recargar todo
    const newMarks = { ...markedDates };
    
    // Limpiar selección anterior
    Object.keys(newMarks).forEach(key => {
      if (newMarks[key].selected) {
        const wasMarked = newMarks[key].marked; // Preservar si tenía punto
        newMarks[key] = wasMarked ? { marked: true, dotColor: Y2K_COLORS.ACID_GREEN } : {};
        // Limpiamos claves vacías para no ensuciar el calendario
        if (!wasMarked) delete newMarks[key];
      }
    });

    // Marcar nuevo
    newMarks[newDate] = {
      ...newMarks[newDate],
      selected: true,
      selectedColor: Y2K_COLORS.ACID_GREEN
    };
    
    setMarkedDates(newMarks);
  };

  const renderTask = ({ item }: any) => (
    <View style={styles.taskCard}>
      <View style={[styles.statusDot, { backgroundColor: item.status === 'done' ? Y2K_COLORS.DIM_GRAY : Y2K_COLORS.ACID_GREEN }]} />
      <View style={{flex: 1}}>
        <Text style={[styles.taskTitle, item.status === 'done' && { textDecorationLine: 'line-through', color: '#555' }]}>
            {item.title}
        </Text>
        {/* Mostramos el Tag y también la hora si existe */}
        <Text style={styles.taskTag}>#{item.tag}</Text>
      </View>
      {item.projected && <MaterialCommunityIcons name="repeat" size={16} color={Y2K_COLORS.DIM_GRAY} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={Y2K_COLORS.ACID_GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRONOGRAMA</Text>
        <View style={{width:28}} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Y2K_COLORS.ACID_GREEN} style={{marginTop:50}} />
      ) : (
        <>
          <Calendar
            theme={{
              backgroundColor: Y2K_COLORS.DEEP_BLACK,
              calendarBackground: Y2K_COLORS.DEEP_BLACK,
              textSectionTitleColor: Y2K_COLORS.DIM_GRAY,
              selectedDayBackgroundColor: Y2K_COLORS.ACID_GREEN,
              selectedDayTextColor: '#000000',
              todayTextColor: Y2K_COLORS.ACID_GREEN,
              dayTextColor: '#FFFFFF',
              textDisabledColor: '#333333',
              dotColor: Y2K_COLORS.ACID_GREEN,
              selectedDotColor: '#000000',
              arrowColor: Y2K_COLORS.ACID_GREEN,
              monthTextColor: Y2K_COLORS.WHITE,
              indicatorColor: Y2K_COLORS.ACID_GREEN,
              textDayFontFamily: 'monospace',
              textMonthFontFamily: 'monospace',
              textDayHeaderFontFamily: 'monospace',
              textDayFontWeight: 'bold',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '300',
              textDayFontSize: 14,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 12
            }}
            onDayPress={onDayPress}
            markedDates={markedDates}
            // Forzamos la fecha seleccionada actual para que el calendario sepa dónde abrir
            current={selectedDate} 
          />

          <View style={styles.listContainer}>
            <Text style={styles.dateLabel}>
               TAREAS DEL {format(parseISO(selectedDate), "dd 'de' MMMM", { locale: es }).toUpperCase()}
            </Text>
            <View style={styles.line} />
            
            <FlatList
              data={tasksForDay}
              keyExtractor={item => item.id}
              renderItem={renderTask}
              ListEmptyComponent={<Text style={styles.emptyText}>[ SIN ACTIVIDAD PROGRAMADA ]</Text>}
              contentContainerStyle={{paddingBottom: 20}}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Y2K_COLORS.DEEP_BLACK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: Y2K_COLORS.GRID_LINE },
  headerTitle: { color: Y2K_COLORS.WHITE, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  backBtn: { padding: 5 },
  
  listContainer: { flex: 1, padding: 20 },
  dateLabel: { color: Y2K_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginBottom: 5 },
  line: { height: 1, backgroundColor: Y2K_COLORS.ACID_GREEN, marginBottom: 15, width: '30%' },
  
  taskCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, 
    padding: 15, marginBottom: 10, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE 
  },
  statusDot: { width: 8, height: 8, marginRight: 15, borderRadius: 4 },
  taskTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  taskTag: { color: Y2K_COLORS.DIM_GRAY, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 30, fontStyle: 'italic' }
});