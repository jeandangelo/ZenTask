import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Y2K_COLORS } from '../theme/colors';
import { api, DbItem } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { dayKeyOf } from '../domain/dates';

// Configuración de idioma
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

// El cronograma muestra SOLO tareas programadas (con fecha). Las rutinas
// no aparecen: ni proyectadas a futuro ni las copias que ya generaron
// (mucho ruido visual cuando hay pendientes reales).
// Las copias generadas no guardan de qué rutina vienen, así que se
// reconocen por tener el mismo título que una rutina activa.
const withoutRoutineInstances = (items: DbItem[], routines: DbItem[]) => {
  const routineTitles = new Set(routines.map(r => r.title));
  return items.filter(t => !routineTitles.has(t.title));
};

export default function CalendarScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<DbItem[]>([]);
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
      const [data, routines] = await Promise.all([api.getDashboardData(), api.getRoutines()]);
      const scheduled = withoutRoutineInstances(data.items, routines).filter(t => !!t.due_date);
      setTasks(scheduled);
      processMarkers(scheduled);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE MARCADORES MEJORADA ---
  const processMarkers = (items: DbItem[]) => {
    const marks: any = {};

    // Punto verde en los días con tareas pendientes (día local, no UTC)
    items.forEach(task => {
      const dateKey = task.status !== 'done' ? dayKeyOf(task.due_date) : null;
      if (dateKey) marks[dateKey] = { marked: true, dotColor: Y2K_COLORS.ACID_GREEN, activeOpacity: 0 };
    });

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

  // Tareas del día seleccionado (su estado, tachada o no, se respeta)
  const tasksForDay = tasks.filter(t => dayKeyOf(t.due_date) === selectedDate);

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