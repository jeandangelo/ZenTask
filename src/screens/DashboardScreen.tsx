import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  StatusBar, SafeAreaView, Platform, useWindowDimensions, 
  Modal, TextInput, Alert, ViewToken, ScrollView, ActivityIndicator,
  ImageBackground, Image, Animated, Easing
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, isPast, isToday, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Y2K_COLORS } from '../theme/colors';
import { api } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../services/notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Task {
  id: string;
  columnId: string;
  type: 'task' | 'goal';
  title: string;
  description?: string;
  status: 'pending' | 'done';
  tag: string;
  linkedGoalId?: string;
  due_date?: string | null;
  recurrence?: string;
}

interface ColumnData {
  id: string;
  title: string;
  isGoalColumn?: boolean;
  isScheduledColumn?: boolean;
}

// Lista SHOPPING: columna real por defecto, detectada por título (protegida contra borrado)
const isShoppingTitle = (title: string) => /SHOP|COMPRA/i.test(title || '');

// Tarea programada: pendiente y con fecha posterior a hoy (comparación por día local)
const isScheduledFuture = (t: Task) => {
  if (!t.due_date || t.status === 'done') return false;
  const d = parseISO(t.due_date);
  if (!isValid(d)) return false;
  return format(d, 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd');
};

interface DashboardProps {
  navigation: any;
  onLogout: () => void;
}

const XPFloatingAnim = ({ visible }: { visible: boolean }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(1);
      liftAnim.setValue(0);
      scaleAnim.setValue(0.5);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(liftAnim, { toValue: -100, duration: 1500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.5, friction: 5, useNativeDriver: true })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.xpContainer, { opacity: fadeAnim, transform: [{ translateY: liftAnim }, { scale: scaleAnim }] }]}>
      <Text style={styles.xpText}>+10 XP</Text>
    </Animated.View>
  );
};

// COMPONENTE LEVEL UP
const LevelUpModal = ({ visible, level, onClose }: { visible: boolean, level: number, onClose: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.levelUpOverlay}>
        <Animated.View style={[styles.levelUpCard, { transform: [{ scale: scaleAnim }] }]}>
          <MaterialCommunityIcons name="arrow-up-bold-hexagon-outline" size={80} color={Y2K_COLORS.ACID_GREEN} />
          <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
          <Text style={styles.levelUpText}>HAS ALCANZADO EL NIVEL</Text>
          <Text style={styles.levelNumber}>{level}</Text>
          <TouchableOpacity style={styles.levelUpBtn} onPress={onClose}>
            <Text style={styles.levelUpBtnText}>CONTINUAR</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function DashboardScreen({ navigation, onLogout }: DashboardProps) {
  const { width, height } = useWindowDimensions();
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
  const [routinesList, setRoutinesList] = useState<any[]>([]);
  
  const [showXpAnim, setShowXpAnim] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);

  const [searchText, setSearchText] = useState('');
  const [tempTitle, setTempTitle] = useState('');
  const [tempDesc, setTempDesc] = useState('');
  const [tempTag, setTempTag] = useState('');
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false); 
  const [recurrence, setRecurrence] = useState<'none'|'daily'|'weekly'|'monthly'>('none');

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); 
  
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
      const data = await api.getDashboardData();
      let cols: ColumnData[] = (data.columns || []).map((c: any) => ({ id: c.id, title: c.title, isGoalColumn: c.is_goal_column }));
      // Lista por defecto SHOPPING LIST: se crea una sola vez si el usuario no la tiene
      if (!cols.some(c => isShoppingTitle(c.title))) {
        const { data: shopCol } = await api.createColumn('SHOPPING LIST 🛒', cols.length);
        if (shopCol) cols = [...cols, { id: shopCol.id, title: shopCol.title, isGoalColumn: false }];
      }
      setColumns(cols);
      setTasks((data.items || []).map((i: any) => ({ 
        id: i.id, columnId: i.column_id, type: i.type, title: i.title, 
        description: i.description, status: i.status, tag: i.tag || '', 
        linkedGoalId: i.linked_goal_id, due_date: i.due_date 
      })));

      const profile = await api.getProfile();
      if (profile) {
        const bg = profile.background_url && profile.background_url.trim().length > 5 ? profile.background_url : null;
        const av = profile.avatar_url && profile.avatar_url.trim().length > 5 ? profile.avatar_url : null;
        setBackgroundUrl(bg);
        setAvatarUrl(av);
        setCurrentLevel(profile.level || 1);
      }
    } catch (e: any) {
      if (e.message === "No usuario" || e.message?.includes("Auth session missing")) onLogout();
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
    const confirmDel = async () => {
        await api.deleteItem(id);
        const data = await api.getRoutines();
        setRoutinesList(data);
    };
    if (Platform.OS === 'web') {
        if (confirm("¿Borrar rutina?")) confirmDel();
    } else {
        Alert.alert("Borrar Rutina", "¿Dejar de repetir?", [{ text: "Cancelar" }, { text: "Sí", onPress: confirmDel, style: 'destructive' }]);
    }
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
    } catch (e) { alert("Error"); setIsLoading(false); }
  };
  const deleteColumn = async (id: string) => {
     if (columns.length <= 1) return;
     const col = columns.find(c => c.id === id);
     if (col && isShoppingTitle(col.title)) {
       const msg = "SHOPPING LIST es una lista por defecto y no se puede borrar.";
       if (Platform.OS === 'web') alert(msg); else Alert.alert("Lista protegida", msg);
       return;
     }
     const doDelete = async () => { setIsLoading(true); await api.deleteColumn(id); await loadData(); if (activeIndex > 0) scrollToColumn(activeIndex - 1); };
     if (Platform.OS === 'web') { if (confirm("¿Borrar?")) doDelete(); } else { Alert.alert("Confirmar", "¿Borrar columna?", [{ text: "Cancelar" }, { text: "Sí", onPress: doDelete, style: "destructive" }]); }
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
    setFormVisible(true);
  };

  const saveItem = async () => {
    if (!tempTitle.trim()) return;
    if (columns.length === 0) { alert("Crea una columna."); return; }
    
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
          const todayStr = today.toISOString().split('T')[0];
          let recDay = 0;
          if (recurrence === 'weekly') recDay = today.getDay(); 
          if (recurrence === 'monthly') recDay = today.getDate();

          const { data: template } = await api.createItem({
            title: tempTitle, description: tempDesc, type: targetType, column_id: columns[0].id,
            tag: tempTag || 'RUTINA', linked_goal_id: goalIdToSend,
            is_template: true, recurrence: recurrence, recurrence_day: recDay,
            last_generated: undefined 
          });

          let shouldCreateNow = false;
          if (recurrence === 'daily') shouldCreateNow = true;
          if (recurrence === 'weekly' && recDay === today.getDay()) shouldCreateNow = true;
          if (recurrence === 'monthly' && recDay === today.getDate()) shouldCreateNow = true;

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
             if (Platform.OS === 'web') alert("Rutina creada y tarea de hoy generada.");
          } else {
             if (Platform.OS === 'web') alert("Rutina guardada.");
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
      alert("Error guardando."); 
      setIsLoading(false); 
    }
  };

  const deleteItem = async (id: string) => {
    if (Platform.OS === 'web' && !confirm("¿Eliminar?")) return;
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
          const updatedProfile = await api.getProfile();
          if (updatedProfile && updatedProfile.level > currentLevel) {
              setCurrentLevel(updatedProfile.level);
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

  const renderItemCard = ({ item }: { item: Task }) => {
    const parentGoal = item.linkedGoalId ? tasks.find(g => g.id === item.linkedGoalId) : null;
    const isProcessing = processingIds.has(item.id);
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
      <TouchableOpacity style={[styles.card, item.type === 'goal' && styles.goalCard, item.status === 'done' && styles.cardDone, isOverdue && styles.cardOverdue, isProcessing && { opacity: 0.5 }]} onPress={() => !isProcessing && startEditItem(item)} activeOpacity={0.9}>
        <View style={styles.cardHeader}>
          <View style={{flexDirection:'row', alignItems:'center', flex: 1, flexWrap: 'wrap'}}>
             <Text style={[styles.cardTag, isOverdue && {color: Y2K_COLORS.ERROR}]}>
               {item.tag ? `#${item.tag}` : ''} {dateText ? ` // ${dateText}` : ''}
             </Text>
             {isOverdue && <MaterialCommunityIcons name="alert-circle" size={14} color={Y2K_COLORS.ERROR} style={{marginLeft:5}} />}
             {parentGoal && (<View style={styles.linkedBadgeLarge}><MaterialCommunityIcons name="trophy" size={12} color="black" /><Text style={styles.linkedTextLarge}>{parentGoal.title.substring(0, 10)}..</Text></View>)}
          </View>
          <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 5 }}><MaterialCommunityIcons name="dots-horizontal" size={24} color={Y2K_COLORS.LIGHT_GRAY} /></TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <TouchableOpacity onPress={() => toggleStatus(item)} disabled={isProcessing} style={styles.checkboxContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
  };

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
            return (
              <View style={[styles.columnContainer, { width: width, height: Platform.OS === 'web' ? height - 180 : '100%' }]}>
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
                  contentContainerStyle={{ paddingBottom: 20 }} 
                  ListEmptyComponent={<Text style={styles.emptyText}>[ VACÍO ]</Text>} 
                  />              
                </View>
            );
          }}
        />

        <TouchableOpacity style={styles.fab} onPress={() => setSelectorVisible(true)}><Text style={styles.fabText}>+</Text></TouchableOpacity>
        <XPFloatingAnim visible={showXpAnim} />
        <LevelUpModal visible={showLevelUp} level={currentLevel} onClose={() => setShowLevelUp(false)} />

        {/* MODALS (IGUAL) */}
        <Modal transparent visible={selectorVisible} animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectorVisible(false)}>
            <View style={styles.selectorBox}>
              <TouchableOpacity style={styles.selectorOption} onPress={() => startCreateItem('task')}><MaterialCommunityIcons name="checkbox-blank-circle-outline" size={24} color={Y2K_COLORS.WHITE} /><Text style={styles.selectorText}>NUEVA TAREA</Text></TouchableOpacity>
              <View style={{height: 1, backgroundColor: Y2K_COLORS.GRID_LINE, width: '100%'}} />
              <TouchableOpacity style={styles.selectorOption} onPress={() => startCreateItem('task', true)}><MaterialCommunityIcons name="cart-outline" size={24} color={Y2K_COLORS.WHITE} /><Text style={styles.selectorText}>NUEVA COMPRA</Text></TouchableOpacity>
              <View style={{height: 1, backgroundColor: Y2K_COLORS.GRID_LINE, width: '100%'}} />
              <TouchableOpacity style={styles.selectorOption} onPress={() => startCreateItem('goal')}><MaterialCommunityIcons name="trophy-outline" size={24} color={Y2K_COLORS.ACID_GREEN} /><Text style={[styles.selectorText, {color: Y2K_COLORS.ACID_GREEN}]}>NUEVO OBJETIVO</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        
        <Modal transparent visible={formVisible} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingItem ? 'EDITAR' : 'NUEVA'} {shoppingMode ? 'COMPRA 🛒' : targetType === 'goal' ? 'OBJETIVO 🏆' : 'TAREA'}</Text>
              <Text style={styles.label}>DESCRIPCIÓN:</Text>
              <TextInput style={styles.input} value={tempTitle} onChangeText={setTempTitle} placeholder="Escribir..." placeholderTextColor={Y2K_COLORS.DIM_GRAY} autoFocus />
              <Text style={styles.label}>COMENTARIOS / DETALLES:</Text>
              <TextInput style={[styles.input, {height: 60}]} value={tempDesc} onChangeText={setTempDesc} placeholder="Detalles extra..." placeholderTextColor={Y2K_COLORS.DIM_GRAY} multiline />
              {targetType === 'task' && !shoppingMode && (
                <>
                  <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                    <View style={{flex:1, marginRight:10}}>
                      <Text style={styles.label}>ETIQUETA (#):</Text>
                      <TextInput style={styles.input} value={tempTag} onChangeText={setTempTag} placeholder="Ej. URGENTE" placeholderTextColor={Y2K_COLORS.DIM_GRAY} />
                    </View>
                    
                    <View style={{flex:1}}>
                      <Text style={styles.label}>VENCE EL DÍA:</Text>
                      
                      {/* LÓGICA ÚNICA PARA WEB Y MÓVIL */}
                      {Platform.OS === 'web' ? (
                        <input 
                          type="date" 
                          style={{
                            marginTop: 5, padding: 8, backgroundColor: Y2K_COLORS.DARK_GRAY, 
                            color: 'white', border: `1px solid ${Y2K_COLORS.GRID_LINE}`, 
                            width: '100%', fontFamily: 'monospace', outline: 'none'
                          }} 
                          value={tempDate ? tempDate.toISOString().split('T')[0] : ''} 
                          onChange={(e) => {
                            if (e.target.value) setTempDate(new Date(e.target.value + 'T12:00:00'));
                            else setTempDate(null);
                          }} 
                        />
                      ) : (
                        <TouchableOpacity 
                          style={[styles.input, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]} 
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
                      <Text style={styles.label}>REPETIR (GENERAR AUTOMÁTICO):</Text>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        {['none', 'daily', 'weekly', 'monthly'].map((opt) => (
                          <TouchableOpacity key={opt} onPress={() => setRecurrence(opt as any)} style={[styles.dropdownButton, { flex: 1, marginHorizontal: 2, justifyContent: 'center', borderColor: recurrence === opt ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.GRID_LINE }]}>
                            <Text style={{color: recurrence === opt ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.DIM_GRAY, fontWeight: 'bold', fontSize: 10}}>{opt === 'none' ? 'NUNCA' : opt === 'daily' ? 'DIARIO' : opt === 'weekly' ? 'SEMANAL' : 'MENSUAL'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {availableGoals.length > 0 && (
                    <View style={{marginTop: 15, zIndex: 10}}>
                      <Text style={styles.label}>VINCULAR A OBJETIVO:</Text>
                      <TouchableOpacity style={styles.dropdownButton} onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                        <Text style={{color: selectedGoalId ? Y2K_COLORS.ACID_GREEN : Y2K_COLORS.DIM_GRAY, fontWeight: 'bold'}}>{selectedGoalId ? availableGoals.find(g => g.id === selectedGoalId)?.title : "SELECCIONAR OBJETIVO..."}</Text>
                        <MaterialCommunityIcons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={Y2K_COLORS.DIM_GRAY} />
                      </TouchableOpacity>
                      {isDropdownOpen && (
                        <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                          <TouchableOpacity onPress={() => { setSelectedGoalId(''); setIsDropdownOpen(false); }} style={styles.dropdownItem}><Text style={{color: Y2K_COLORS.DIM_GRAY}}>[NINGUNO]</Text></TouchableOpacity>
                          {availableGoals.map(g => (<TouchableOpacity key={g.id} onPress={() => { setSelectedGoalId(g.id); setIsDropdownOpen(false); }} style={styles.dropdownItem}><Text style={{color: Y2K_COLORS.WHITE}}>{g.title}</Text></TouchableOpacity>))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </>
              )}
              <View style={styles.formActions}>
                <TouchableOpacity onPress={() => setFormVisible(false)}><Text style={styles.cancelText}>CANCELAR</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveItem}><Text style={styles.saveText}>GUARDAR</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={columnFormVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingColumn ? 'RENOMBRAR' : 'NUEVA COLUMNA'}</Text>
              <TextInput style={styles.input} value={tempTitle} onChangeText={setTempTitle} placeholder="Ej. PROYECTOS" placeholderTextColor={Y2K_COLORS.DIM_GRAY} autoFocus />
              <View style={styles.formActions}>
                <TouchableOpacity onPress={() => setColumnFormVisible(false)}><Text style={styles.cancelText}>CANCELAR</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveColumn}><Text style={styles.saveText}>CONFIRMAR</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={routinesVisible} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.formCard, {height: '60%'}]}>
              <Text style={styles.formTitle}>MIS RUTINAS ACTIVAS</Text>
              <Text style={{color:Y2K_COLORS.DIM_GRAY, marginBottom: 15, textAlign:'center'}}>Estas tareas se generan automáticamente.</Text>
              <ScrollView>
                {routinesList.length === 0 ? (
                  <Text style={styles.emptyText}>No tienes rutinas configuradas.</Text>
                ) : (
                  routinesList.map(r => (
                    <View key={r.id} style={[styles.card, {flexDirection:'row', justifyContent:'space-between', alignItems:'center'}]}>
                      <View>
                        <Text style={{color:'white', fontWeight:'bold'}}>{r.title}</Text>
                        <Text style={{color:Y2K_COLORS.ACID_GREEN, fontSize:10}}>REPETICIÓN: {r.recurrence?.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteRoutine(r.id)} style={{padding:10}}>
                        <MaterialCommunityIcons name="trash-can" size={20} color={Y2K_COLORS.ERROR} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={[styles.cancelBtn, {marginTop:20}]} onPress={() => setRoutinesVisible(false)}><Text style={styles.cancelBtnText}>CERRAR</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  headerBtn: { padding: 5 },
  container: { flex: 1, backgroundColor: '#000000', ...Platform.select({ web: { height: '100vh', overflow: 'hidden' as any } }) },  bgImage: { flex: 1, width: '100%', height: '100%', ...Platform.select({ web: { height: '100vh', overflow: 'hidden' as any } }) },
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
  line: { width: '100%', height: 2, backgroundColor: Y2K_COLORS.GRID_LINE, marginTop: 5, marginBottom: 15 },  emptyText: { color: Y2K_COLORS.DIM_GRAY, textAlign: 'center', marginTop: 30, fontFamily: 'monospace' },
  card: { backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, borderLeftWidth: 4, borderLeftColor: Y2K_COLORS.DIM_GRAY },
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
  fab: { position: 'absolute', bottom: 30, right: 20, width: 65, height: 65, borderRadius: 35, backgroundColor: Y2K_COLORS.ACID_GREEN, justifyContent: 'center', alignItems: 'center', ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.5)' }, default: { elevation: 5 } }) },
  fabText: { fontSize: 35, fontWeight: '400', color: '#000', marginTop: -3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  selectorBox: { width: 280, backgroundColor: Y2K_COLORS.DARK_GRAY, borderWidth: 1, borderColor: Y2K_COLORS.ACID_GREEN, padding: 20 },
  selectorTitle: { color: Y2K_COLORS.WHITE, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  selectorOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  selectorText: { color: Y2K_COLORS.WHITE, marginLeft: 15, fontWeight: 'bold' },
  formCard: { width: '85%', maxWidth: 400, backgroundColor: '#000', borderWidth: 1, borderColor: Y2K_COLORS.WHITE, padding: 25 },
  formTitle: { color: Y2K_COLORS.ACID_GREEN, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: Y2K_COLORS.DIM_GRAY, fontSize: 12, marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: Y2K_COLORS.DARK_GRAY, color: 'white', padding: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, fontSize: 16 },
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 12, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE },
  dropdownList: { borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, borderTopWidth: 0, maxHeight: 150, backgroundColor: Y2K_COLORS.DARK_GRAY },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  cancelText: { color: Y2K_COLORS.ERROR, fontWeight: 'bold', padding: 10 },
  cancelBtn: { marginTop: 10, alignItems: 'center', padding: 15 },
  cancelBtnText: { color: Y2K_COLORS.DIM_GRAY, fontWeight: 'bold' },
  saveBtn: { backgroundColor: Y2K_COLORS.ACID_GREEN, paddingVertical: 10, paddingHorizontal: 25 },
  saveText: { color: 'black', fontWeight: 'bold' },
  xpContainer: { position: 'absolute', top: '40%', alignSelf: 'center', backgroundColor: Y2K_COLORS.ACID_GREEN, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: 'white', shadowColor: Y2K_COLORS.ACID_GREEN, shadowOpacity: 0.8, shadowRadius: 10, zIndex: 999 },
  xpText: { fontSize: 24, fontWeight: '900', color: 'black' },
  
  levelUpOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  levelUpCard: { width: 300, padding: 30, backgroundColor: Y2K_COLORS.DARK_GRAY, alignItems: 'center', borderWidth: 2, borderColor: Y2K_COLORS.ACID_GREEN },
  levelUpTitle: { color: Y2K_COLORS.ACID_GREEN, fontSize: 30, fontWeight: '900', marginVertical: 10 },
  levelUpText: { color: 'white', fontSize: 16, marginBottom: 5 },
  levelNumber: { color: 'white', fontSize: 80, fontWeight: 'bold', marginBottom: 20 },
  levelUpBtn: { backgroundColor: Y2K_COLORS.ACID_GREEN, paddingHorizontal: 30, paddingVertical: 10 },
  levelUpBtnText: { color: 'black', fontWeight: 'bold' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Y2K_COLORS.DARK_GRAY, marginHorizontal: 20, marginTop: 10,
    paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE
  },
  searchInput: {
    flex: 1, color: 'white', fontSize: 14, fontFamily: 'monospace',
    // @ts-ignore
    outlineStyle: 'none' 
  }
});