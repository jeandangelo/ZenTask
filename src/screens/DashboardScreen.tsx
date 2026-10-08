import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Platform, useWindowDimensions,
  Modal, TextInput, ViewToken, ScrollView, ActivityIndicator,
  ImageBackground, Image, ViewStyle, TextStyle
} from 'react-native';
// SafeAreaView de safe-area-context, NO la de react-native: en la PWA con
// viewport-fit=cover es la única que respeta notch y home indicator del
// iPhone (con la de react-native la última tarea quedaba bajo el borde).
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Y2K_COLORS } from '../theme/colors';
import { api, DbItem, isAuthError } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../services/notifications';
import { confirmAction, notify } from '../services/dialogs';
import { localDayKey } from '../domain/dates';
import { isScheduledFuture, isShoppingTitle } from '../domain/lists';
import { Recurrence, RECURRENCE_LABELS, recurrenceDayFor, routineOccursOn } from '../domain/routines';
import DateTimePicker from '@react-native-community/datetimepicker';
import TaskCard from '../components/dashboard/TaskCard';
import { LevelUpModal, XPFloatingAnim } from '../components/dashboard/Rewards';
import { ColumnFormModal, CreateSelectorModal, RoutinesModal } from '../components/dashboard/SimpleModals';
import { modalStyles } from '../components/dashboard/modalStyles';
import { ColumnData, Task } from '../components/dashboard/types';

interface DashboardProps {
  navigation: any;
  onLogout: () => void;
}

export default function DashboardScreen({ navigation, onLogout }: DashboardProps) {
  const { width, height } = useWindowDimensions();
  // Insets reales del sistema (notch / home indicator del iPhone en la PWA).
  // En un navegador de escritorio son 0, así que ahí nada cambia.
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [columnFormVisible, setColumnFormVisible] = useState(false);
  const [routinesVisible, setRoutinesVisible] = useState(false);
  const [routinesList, setRoutinesList] = useState<DbItem[]>([]);
  
  const [showXpAnim, setShowXpAnim] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);

  const [searchText, setSearchText] = useState('');
  const [tempTitle, setTempTitle] = useState('');
  const [tempDesc, setTempDesc] = useState('');
  const [tempTag, setTempTag] = useState('');
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false); 
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); 
  // Formulario simple por defecto (solo título); fecha, rutina, etiqueta,
  // detalles y objetivo quedan detrás de "OPCIONES AVANZADAS".
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [editingItem, setEditingItem] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<ColumnData | null>(null);
  const [targetType, setTargetType] = useState<'task' | 'goal'>('task');
  // Modo compra: formulario simple (sin fecha/recurrencia) que va directo a SHOPPING LIST
  const [shoppingMode, setShoppingMode] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  // Tareas recién tachadas: siguen visibles unos segundos (animación + margen para des-tachar)
  const [recentlyDone, setRecentlyDone] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      // Tablero y perfil en paralelo: no dependen uno del otro
      const [data, profile] = await Promise.all([api.getDashboardData(), api.getProfile()]);
      let cols: ColumnData[] = data.columns.map(c => ({ id: c.id, title: c.title, isGoalColumn: c.is_goal_column }));
      // Lista por defecto SHOPPING LIST: se crea una sola vez si el usuario no la tiene
      if (!cols.some(c => isShoppingTitle(c.title))) {
        const { data: shopCol } = await api.createColumn('SHOPPING LIST 🛒', cols.length);
        if (shopCol) cols = [...cols, { id: shopCol.id, title: shopCol.title, isGoalColumn: false }];
      }
      setColumns(cols);
      setTasks(data.items.map(i => ({
        id: i.id, columnId: i.column_id, type: i.type, title: i.title,
        description: i.description, status: i.status, tag: i.tag || '',
        linkedGoalId: i.linked_goal_id ?? undefined, due_date: i.due_date
      })));

      if (profile) {
        const bg = profile.background_url && profile.background_url.trim().length > 5 ? profile.background_url : null;
        const av = profile.avatar_url && profile.avatar_url.trim().length > 5 ? profile.avatar_url : null;
        setBackgroundUrl(bg);
        setAvatarUrl(av);
        setCurrentLevel(profile.level || 1);
      }
    } catch (e) {
      // Antes se comparaba con "No usuario", un mensaje que api.ts nunca
      // lanzaba: con la sesión vencida el tablero quedaba vacío sin volver al login.
      if (isAuthError(e)) onLogout();
      else console.error('Error cargando el tablero:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const openRoutinesManager = async () => {
    setRoutinesVisible(true);
    const data = await api.getRoutines();
    setRoutinesList(data);
  };

  const deleteRoutine = async (id: string) => {
    if (!(await confirmAction("Borrar rutina", "¿Dejar de repetir esta rutina?"))) return;
    await api.deleteItem(id);
    const data = await api.getRoutines();
    setRoutinesList(data);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Listas por defecto: siempre visibles, no se pueden borrar ni renombrar
  const finalColumns = [...columns];
  finalColumns.push({ id: 'col_scheduled', title: 'PROGRAMADAS 📅', isScheduledColumn: true });
  finalColumns.push({ id: 'col_goals', title: 'MIS OBJETIVOS 🏆', isGoalColumn: true });
  const availableGoals = tasks.filter(t => t.type === 'goal');

  const filteredTasks = tasks.filter(t => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return t.title.toLowerCase().includes(search) || t.tag.toLowerCase().includes(search);
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const scrollToColumn = (index: number) => {
    flatListRef.current?.scrollToIndex({ animated: true, index });
  };

  const handleEditColumn = (col: ColumnData) => { setEditingColumn(col); setTempTitle(col.title); setColumnFormVisible(true); };
  const handleCreateColumn = () => { setEditingColumn(null); setTempTitle(''); setColumnFormVisible(true); };
  const saveColumn = async () => {
    if (!tempTitle.trim()) return;
    setColumnFormVisible(false); setIsLoading(true);
    try {
      if (editingColumn) { await api.updateColumn(editingColumn.id, tempTitle); } 
      else { await api.createColumn(tempTitle.toUpperCase(), columns.length); setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 500); }
      await loadData();
    } catch (e) { notify("Error", "No se pudo guardar la columna."); setIsLoading(false); }
  };
  const deleteColumn = async (id: string) => {
     if (columns.length <= 1) return;
     const col = columns.find(c => c.id === id);
     if (col && isShoppingTitle(col.title)) {
       notify("Lista protegida", "SHOPPING LIST es una lista por defecto y no se puede borrar.");
       return;
     }
     if (!(await confirmAction("Borrar columna", `¿Borrar la columna "${col?.title ?? ''}"?`))) return;
     setIsLoading(true);
     await api.deleteColumn(id);
     await loadData();
     if (activeIndex > 0) scrollToColumn(activeIndex - 1);
  };

  const startCreateItem = (type: 'task' | 'goal', shopping = false) => {
    setTargetType(type);
    setShoppingMode(shopping);
    setEditingItem(null);
    setTempTitle(''); 
    setTempDesc(''); 
    setTempTag(''); 
    setSelectedGoalId(''); 
    // Actualizado: Ahora usamos setTempDate(null)
    setTempDate(null); 
    setRecurrence('none'); 
    setIsDropdownOpen(false); 
    setShowAdvanced(false);
    setSelectorVisible(false); 
    setFormVisible(true);
  };

  const startEditItem = (item: Task) => {
    setTargetType(item.type);
    // Si el ítem vive en la SHOPPING LIST, se edita con el formulario simple de compra
    const itemCol = columns.find(c => c.id === item.columnId);
    setShoppingMode(!!itemCol && isShoppingTitle(itemCol.title));
    setEditingItem(item);
    setTempTitle(item.title); 
    setTempDesc(item.description || ''); 
    setTempTag(item.tag); 
    setSelectedGoalId(item.linkedGoalId || '');
    
    // Solo existe esta versión ahora:
    if (item.due_date) {
      setTempDate(new Date(item.due_date.split('T')[0] + 'T12:00:00'));
    } else {
      setTempDate(null);
    }
    
    setRecurrence('none'); 
    setIsDropdownOpen(false); 
    // Al editar, las avanzadas se abren solo si la tarea ya usa alguna
    setShowAdvanced(!!(item.description || item.due_date || item.linkedGoalId));
    setFormVisible(true);
  };

  const saveItem = async () => {
    if (!tempTitle.trim()) return;
    if (columns.length === 0) { notify("Sin columnas", "Crea una columna primero."); return; }
    
    setFormVisible(false); 
    setIsLoading(true);
    
    try {
      const goalIdToSend = selectedGoalId || null;
      
      // ACTUALIZADO: Usamos el estado tempDate (objeto Date)
      let dateToSend = null;
      if (tempDate) {
        // Al ser un objeto Date, toISOString() ya maneja la conversión. 
        // Como en startEditItem/DateTimePicker forzamos las 12:00 PM, 
        // esto evitará el error del "día anterior".
        dateToSend = tempDate.toISOString();
      }

      if (editingItem) {
        await api.updateItem(editingItem.id, {
          title: tempTitle, 
          description: tempDesc, 
          tag: tempTag || (targetType === 'goal' ? '' : 'GRAL'), 
          linked_goal_id: goalIdToSend, 
          due_date: dateToSend 
        });
      } else {
        if (recurrence !== 'none') {
          const today = new Date();
          // Día LOCAL: con toISOString() una rutina creada de noche quedaba
          // marcada como generada "mañana" y ese día no aparecía.
          const todayStr = localDayKey(today);
          const recDay = recurrenceDayFor(recurrence, today);

          const { data: template } = await api.createItem({
            title: tempTitle, description: tempDesc, type: targetType, column_id: columns[0].id,
            tag: tempTag || 'RUTINA', linked_goal_id: goalIdToSend,
            is_template: true, recurrence: recurrence, recurrence_day: recDay,
            last_generated: undefined
          });

          const shouldCreateNow = routineOccursOn({ recurrence, recurrence_day: recDay }, today);

          if (shouldCreateNow && template) {
             let targetColId = columns[0].id;
             if (targetType !== 'goal') {
                 const currentCol = finalColumns[activeIndex];
                 targetColId = (currentCol && !currentCol.isGoalColumn && !currentCol.isScheduledColumn) ? currentCol.id : columns[0].id;
             }
             await api.createItem({
                title: tempTitle, description: tempDesc, type: targetType, column_id: targetColId,
                tag: tempTag || 'RUTINA', linked_goal_id: goalIdToSend,
                status: 'pending', is_template: false, recurrence: 'none',
                due_date: new Date().toISOString()
             });
             await api.updateItem(template.id, { last_generated: todayStr });
             notify("Rutina creada", "También se generó la tarea de hoy.");
          } else {
             notify("Rutina guardada", "Se generará automáticamente los días que corresponda.");
          }
        } else {
            let targetColId = "";
            if (shoppingMode) {
                // Las compras van SIEMPRE a la SHOPPING LIST, sin importar en qué lista estés
                const shopCol = columns.find(c => isShoppingTitle(c.title));
                targetColId = shopCol ? shopCol.id : columns[0].id;
            }
            else if (targetType === 'goal') { targetColId = columns[0].id; }
            else { const currentCol = finalColumns[activeIndex]; targetColId = (currentCol && !currentCol.isGoalColumn && !currentCol.isScheduledColumn) ? currentCol.id : columns[0].id; }

            await api.createItem({
              title: tempTitle, description: tempDesc, type: targetType, column_id: targetColId,
              tag: tempTag || (shoppingMode ? 'COMPRA' : targetType === 'goal' ? '' : 'TAREA'),
              linked_goal_id: targetType === 'goal' ? null : goalIdToSend,
              due_date: dateToSend,
              is_template: false, recurrence: 'none' 
            });

            if (targetType === 'goal') setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 500);

            // ACTUALIZADO: Usamos tempDate
            if (dateToSend && tempTitle) {
                const targetDate = new Date(dateToSend);
                targetDate.setHours(9, 0, 0, 0);
                notificationService.scheduleNotification("Recordatorio ZenTask", `No olvides: ${tempTitle}`, targetDate);
            }
        }
      }
      await loadData();
    } catch (e) { 
      console.error(e); 
      notify("Error", "No se pudo guardar.");
      setIsLoading(false); 
    }
  };

  const deleteItem = async (id: string) => {
    const item = tasks.find(t => t.id === id);
    if (!(await confirmAction("Eliminar", `¿Eliminar "${item?.title ?? 'este ítem'}"?`))) return;
    setIsLoading(true); await api.deleteItem(id); await loadData();
  };

  const toggleStatus = async (item: Task) => {
    if (processingIds.has(item.id)) return;
    setProcessingIds(prev => new Set(prev).add(item.id));

    try {
      const newStatus = item.status === 'done' ? 'pending' : 'done';
      setTasks(prevTasks => prevTasks.map(t => t.id === item.id ? { ...t, status: newStatus } : t));
      
      // LLAMADA SEGURA AL SERVIDOR
      await api.toggleTaskStatus(item.id, newStatus);

      if (newStatus === 'done') {
          triggerXpAnimation();

          // La tarea queda visible 2 segundos y luego desaparece del tablero
          setRecentlyDone(prev => new Set(prev).add(item.id));
          setTimeout(() => {
            setRecentlyDone(prev => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
          }, 2000);

          // VERIFICAR NIVEL
          const newLevel = (await api.getProfile())?.level ?? 0;
          if (newLevel > currentLevel) {
              setCurrentLevel(newLevel);
              setShowLevelUp(true);
          }
      }
    } catch (error) {
      console.error(error);
      setTasks(prevTasks => prevTasks.map(t => t.id === item.id ? { ...t, status: item.status } : t));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const triggerXpAnimation = () => {
    setShowXpAnim(false);
    setTimeout(() => setShowXpAnim(true), 50);
    setTimeout(() => setShowXpAnim(false), 2000);
  };

  const renderItemCard = ({ item }: { item: Task }) => (
    <TaskCard
      item={item}
      parentGoal={item.linkedGoalId ? tasks.find(g => g.id === item.linkedGoalId) : null}
      isProcessing={processingIds.has(item.id)}
      onEdit={startEditItem}
      onDelete={deleteItem}
      onToggle={toggleStatus}
    />
  );

  if (isLoading && columns.length === 0) return (<View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}><ActivityIndicator size="large" color={Y2K_COLORS.ACID_GREEN} /></View>);

  const Wrapper = backgroundUrl ? ImageBackground : View;
  const wrapperProps = backgroundUrl ? { source: { uri: backgroundUrl }, style: [styles.bgImage, { backgroundColor: 'black' }], resizeMode: 'cover' } : { style: styles.container };

  return (
    // @ts-ignore
    <Wrapper {...wrapperProps}>
      {backgroundUrl && <View style={styles.overlay} />}
      <SafeAreaView style={{flex: 1, overflow: 'hidden'}}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.topBar}>
          {/* 1. PERFIL */}
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.headerBtn}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.headerAvatarLarge} /> : <MaterialCommunityIcons name="account-circle-outline" size={35} color={Y2K_COLORS.ACID_GREEN} />}
          </TouchableOpacity>
          
          {/* 2. LOGO */}
          <Text style={styles.logoLarge}>ZENTASK</Text>
          
          <View style={{flexDirection:'row'}}>
             {/* 3. CALENDARIO (NUEVO) */}
             <TouchableOpacity onPress={() => navigation.navigate('Calendar')} style={styles.headerBtn}>
               <MaterialCommunityIcons name="calendar-month-outline" size={28} color={Y2K_COLORS.ACID_GREEN} />
             </TouchableOpacity>

             {/* 4. RUTINAS */}
             <TouchableOpacity onPress={openRoutinesManager} style={styles.headerBtn}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={28} color={Y2K_COLORS.LIGHT_GRAY} />
             </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={Y2K_COLORS.DIM_GRAY} style={{marginRight: 10}} />
            <TextInput style={styles.searchInput} placeholder="BUSCAR PROTOCOLO..." placeholderTextColor={Y2K_COLORS.DIM_GRAY} value={searchText} onChangeText={setSearchText} />
        </View>

        <View style={styles.navBarContainer}>
          <View style={styles.navBarContent}>
            {finalColumns.map((col, i) => {
              const isActive = activeIndex === i;
              const isGoal = col.isGoalColumn;
              return (
                <TouchableOpacity key={col.id || i} onPress={() => scrollToColumn(i)} style={{ padding: 8 }}>
                  <View style={[styles.dot, isActive ? { backgroundColor: Y2K_COLORS.ACID_GREEN, borderColor: Y2K_COLORS.ACID_GREEN, transform: [{scale: 1.2}] } : isGoal ? { borderColor: Y2K_COLORS.ACID_GREEN, borderWidth: 1 } : { borderColor: Y2K_COLORS.DIM_GRAY, borderWidth: 1 }]} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={handleCreateColumn} style={styles.addColumnBtn}><MaterialCommunityIcons name="playlist-plus" size={20} color={Y2K_COLORS.DIM_GRAY} /></TouchableOpacity>
          </View>
        </View>

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ height: '100%' }}
          ref={flatListRef} data={finalColumns} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => {
            const columnItems = item.isGoalColumn
                ? filteredTasks.filter(t => t.type === 'goal')
                : item.isScheduledColumn
                ? filteredTasks
                    .filter(t => t.type === 'task' && isScheduledFuture(t))
                    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
                : filteredTasks.filter(t =>
                    t.columnId === item.id && t.type === 'task' &&
                    !isScheduledFuture(t) &&
                    (t.status !== 'done' || recentlyDone.has(t.id))
                  );
            // El alto de ventana incluye notch y home indicator, pero el
            // SafeAreaView ya los descuenta con padding: hay que restarlos
            // también del alto de la columna o queda más alta que el área
            // visible y la última tarea muere detrás del borde inferior.
            return (
              <View style={[styles.columnContainer, { width: width, height: Platform.OS === 'web' ? height - 180 - insets.top - insets.bottom : '100%' }]}>
                <View style={styles.columnHeader}>
                    <TouchableOpacity onPress={() => !item.isGoalColumn && !item.isScheduledColumn && handleEditColumn(item)} disabled={!!item.isGoalColumn || !!item.isScheduledColumn} style={{flexDirection:'row', alignItems:'center'}}>
                      <Text style={[styles.columnTitle, item.isGoalColumn && {color: Y2K_COLORS.ACID_GREEN}]}>{item.title}</Text>
                      {!item.isGoalColumn && !item.isScheduledColumn && <MaterialCommunityIcons name="pencil" size={14} color={Y2K_COLORS.DIM_GRAY} style={{marginLeft: 8}} />}
                    </TouchableOpacity>
                    {!item.isGoalColumn && !item.isScheduledColumn && (<TouchableOpacity onPress={() => deleteColumn(item.id)}><MaterialCommunityIcons name="trash-can-outline" size={18} color={Y2K_COLORS.DIM_GRAY} /></TouchableOpacity>)}
                </View>
                <View style={[styles.line, item.isGoalColumn && {backgroundColor: Y2K_COLORS.ACID_GREEN}]} />
                <FlatList
                  style={{ flex: 1 }}
                  data={columnItems}
                  keyExtractor={(t) => t.id}
                  renderItem={renderItemCard}
                  showsVerticalScrollIndicator={true}
                  // 100px de aire al final: la última tarea debe poder
                  // scrollear por encima del botón flotante +.
                  contentContainerStyle={{ paddingBottom: 100 }}
                  ListEmptyComponent={<Text style={styles.emptyText}>[ VACÍO ]</Text>}
                  />              
                </View>
            );
          }}
        />

        <TouchableOpacity style={styles.fab} onPress={() => setSelectorVisible(true)}><Text style={styles.fabText}>+</Text></TouchableOpacity>
        <XPFloatingAnim visible={showXpAnim} />
        <LevelUpModal visible={showLevelUp} level={currentLevel} onClose={() => setShowLevelUp(false)} />

        <CreateSelectorModal visible={selectorVisible} onClose={() => setSelectorVisible(false)} onPick={startCreateItem} />
        
        <Modal transparent visible={formVisible} animationType="slide">
          <View style={modalStyles.modalOverlay}>
            <View style={modalStyles.formCard}>
              <Text style={modalStyles.formTitle}>{editingItem ? 'EDITAR' : 'NUEVA'} {shoppingMode ? 'COMPRA 🛒' : targetType === 'goal' ? 'OBJETIVO 🏆' : 'TAREA'}</Text>
              <Text style={modalStyles.label}>TÍTULO:</Text>
              {/* Enter guarda: anotar algo simple no debería pedir más que escribir */}
              <TextInput style={modalStyles.input} value={tempTitle} onChangeText={setTempTitle} placeholder="Escribir..." placeholderTextColor={Y2K_COLORS.DIM_GRAY} autoFocus returnKeyType="done" onSubmitEditing={saveItem} />
              {targetType === 'task' && !shoppingMode && (
                <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} style={styles.advancedToggle}>
                  <MaterialCommunityIcons name={showAdvanced ? 'chevron-up' : 'tune-variant'} size={16} color={Y2K_COLORS.DIM_GRAY} />
                  <Text style={styles.advancedToggleText}>{showAdvanced ? 'OCULTAR OPCIONES' : 'OPCIONES AVANZADAS'}</Text>
                </TouchableOpacity>
              )}
              {(targetType !== 'task' || shoppingMode || showAdvanced) && (
                <>
                  <Text style={modalStyles.label}>COMENTARIOS / DETALLES:</Text>
                  <TextInput style={[modalStyles.input, {height: 60}]} value={tempDesc} onChangeText={setTempDesc} placeholder="Detalles extra..." placeholderTextColor={Y2K_COLORS.DIM_GRAY} multiline />
                </>
              )}
              {targetType === 'task' && !shoppingMode && showAdvanced && (
                <>
                  <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                    <View style={{flex:1, marginRight:10}}>
                      <Text style={modalStyles.label}>ETIQUETA (#):</Text>
                      <TextInput style={modalStyles.input} value={tempTag} onChangeText={setTempTag} placeholder="Ej. URGENTE" placeholderTextColor={Y2K_COLORS.DIM_GRAY} />
                    </View>
                    
                    <View style={{flex:1}}>
                      <Text style={modalStyles.label}>VENCE EL DÍA:</Text>
                      
                      {/* LÓGICA ÚNICA PARA WEB Y MÓVIL */}
                      {Platform.OS === 'web' ? (
                        <input 
                          type="date" 
                          style={{
                            marginTop: 5, padding: 8, backgroundColor: Y2K_COLORS.DARK_GRAY, 
                            color: 'white', border: `1px solid ${Y2K_COLORS.GRID_LINE}`, 
                            width: '100%', fontFamily: 'monospace', outline: 'none'
                          }} 
                          value={tempDate ? localDayKey(tempDate) : ''} 
                          onChange={(e) => {
                            if (e.target.value) setTempDate(new Date(e.target.value + 'T12:00:00'));
                            else setTempDate(null);
                          }} 
                        />
                      ) : (
                        <TouchableOpacity 
                          style={[modalStyles.input, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]} 
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Text style={{color: tempDate ? 'white' : Y2K_COLORS.DIM_GRAY}}>
                            {tempDate ? format(tempDate, 'yyyy-MM-dd') : 'Seleccionar...'}
                          </Text>
                          <MaterialCommunityIcons name="calendar" size={18} color={Y2K_COLORS.ACID_GREEN} />
                        </TouchableOpacity>
                      )}

                      {/* DATE PICKER NATIVO (Solo para móvil) */}
                      {Platform.OS !== 'web' && showDatePicker && (
                        <DateTimePicker
                          value={tempDate || new Date()}
                          mode="date"
                          display="default"
                          themeVariant="dark"
                          onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) {
                              const localDate = new Date(selectedDate);
                              localDate.setHours(12, 0, 0, 0);
                              setTempDate(localDate);
                            }
                          }}
                        />
                      )}
                    </View>
                  </View>

                  {!editingItem && (
                    <View style={{marginTop: 15}}>
                      <Text style={modalStyles.label}>REPETIR (GENERAR AUTOMÁTICO):</Text>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((opt) => (
                          <TouchableOpacity key={opt} onPress={() => setRecurrence(opt)} style={[modalStyles.dropdownButton, { flex: 1, marginHorizontal: 2, justifyContent: 'center', borderColor: recurrence === opt ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.GRID_LINE }]}>
                            <Text style={{color: recurrence === opt ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.DIM_GRAY, fontWeight: 'bold', fontSize: 10}}>{RECURRENCE_LABELS[opt]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {availableGoals.length > 0 && (
                    <View style={{marginTop: 15, zIndex: 10}}>
                      <Text style={modalStyles.label}>VINCULAR A OBJETIVO:</Text>
                      <TouchableOpacity style={modalStyles.dropdownButton} onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                        <Text style={{color: selectedGoalId ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.DIM_GRAY, fontWeight: 'bold'}}>{selectedGoalId ? availableGoals.find(g => g.id === selectedGoalId)?.title : "SELECCIONAR OBJETIVO..."}</Text>
                        <MaterialCommunityIcons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={Y2K_COLORS.DIM_GRAY} />
                      </TouchableOpacity>
                      {isDropdownOpen && (
                        <ScrollView style={modalStyles.dropdownList} nestedScrollEnabled>
                          <TouchableOpacity onPress={() => { setSelectedGoalId(''); setIsDropdownOpen(false); }} style={modalStyles.dropdownItem}><Text style={{color: Y2K_COLORS.DIM_GRAY}}>[NINGUNO]</Text></TouchableOpacity>
                          {availableGoals.map(g => (<TouchableOpacity key={g.id} onPress={() => { setSelectedGoalId(g.id); setIsDropdownOpen(false); }} style={modalStyles.dropdownItem}><Text style={{color: Y2K_COLORS.WHITE}}>{g.title}</Text></TouchableOpacity>))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </>
              )}
              <View style={modalStyles.formActions}>
                <TouchableOpacity onPress={() => setFormVisible(false)}><Text style={modalStyles.cancelText}>CANCELAR</Text></TouchableOpacity>
                <TouchableOpacity style={modalStyles.saveBtn} onPress={saveItem}><Text style={modalStyles.saveText}>GUARDAR</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ColumnFormModal
          visible={columnFormVisible}
          isEditing={!!editingColumn}
          title={tempTitle}
          onChangeTitle={setTempTitle}
          onCancel={() => setColumnFormVisible(false)}
          onConfirm={saveColumn}
        />

        <RoutinesModal visible={routinesVisible} routines={routinesList} onDelete={deleteRoutine} onClose={() => setRoutinesVisible(false)} />

      </SafeAreaView>
    </Wrapper>
  );
}

// Solo web: fija el alto al viewport y evita el scroll del body en la PWA.
// '100vh' es CSS válido pero no existe en los tipos de RN, de ahí el cast.
const webViewportFill = Platform.select({
  web: { height: '100vh', overflow: 'hidden' } as unknown as ViewStyle,
  default: {} as ViewStyle,
});

const styles = StyleSheet.create({
  headerBtn: { padding: 5 },
  container: { flex: 1, backgroundColor: '#000000', ...webViewportFill },
  bgImage: { flex: 1, width: '100%', height: '100%', ...webViewportFill },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Y2K_COLORS.GRID_LINE },
  logoLarge: { color: Y2K_COLORS.ACID_GREEN, fontSize: 32, fontWeight: '900', letterSpacing: -2 },
  headerAvatarLarge: { width: 35, height: 35, borderRadius: 18, borderWidth: 2, borderColor: Y2K_COLORS.ACID_GREEN },
  navBarContainer: { alignItems: 'center', marginTop: 10, marginBottom: 5 },
  navBarContent: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, marginHorizontal: 4, borderRadius: 2 },
  addColumnBtn: { marginLeft: 15, padding: 5, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, borderRadius: 4 },
  columnContainer: { paddingHorizontal: 20, flex: 1 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 },
  columnTitle: { color: Y2K_COLORS.WHITE, fontSize: 24, fontWeight: '800', fontStyle: 'italic' },
  line: { width: '100%', height: 2, backgroundColor: Y2K_COLORS.GRID_LINE, marginTop: 5, marginBottom: 15 },
  emptyText: { color: Y2K_COLORS.DIM_GRAY, textAlign: 'center', marginTop: 30, fontFamily: 'monospace' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 65, height: 65, borderRadius: 35, backgroundColor: Y2K_COLORS.ACID_GREEN, justifyContent: 'center', alignItems: 'center', ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.5)' }, default: { elevation: 5 } }) },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6 },
  advancedToggleText: { color: Y2K_COLORS.DIM_GRAY, fontSize: 11, fontWeight: 'bold', marginLeft: 6, letterSpacing: 1 },
  fabText: { fontSize: 35, fontWeight: '400', color: '#000', marginTop: -3 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, marginHorizontal: 20, marginTop: 10,
    paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE
  },
  searchInput: {
    flex: 1, color: 'white', fontSize: 14, fontFamily: 'monospace',
    // Solo web: quita el contorno de foco del navegador ('none' no existe en los tipos de RN).
    ...Platform.select({ web: { outlineStyle: 'none' } as unknown as TextStyle }),
  }
});