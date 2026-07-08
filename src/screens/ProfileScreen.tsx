import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  TextInput, ScrollView, Image, Modal, TouchableWithoutFeedback 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';
import { Y2K_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { supabase } from '../services/supabase';
import { api } from '../services/api';

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);
  
  const [profile, setProfile] = useState<any>(null);
  // ESTADO PARA ESTADÍSTICAS
  const [stats, setStats] = useState({ total: 0, done: 0, pending: 0, percent: 0 });
  
  const [formName, setFormName] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formAvatar, setFormAvatar] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileData = await api.getProfile();
      if (profileData) {
        setProfile(profileData);
        setFormName(profileData.username || '');
        setFormBio(profileData.bio || '');
        setFormAvatar(profileData.avatar_url || '');
      }

      // CALCULAR ESTADÍSTICAS EN TIEMPO REAL
      // (En una app masiva esto se haría en el servidor, pero para MVP está bien aquí)
      // EFICIENCIA JUSTA: solo cuentan las tareas EXIGIBLES.
      // Quedan fuera: objetivos, compras (shopping list) y tareas programadas
      // a futuro — hacer una tarea el día que la estipulaste no baja la eficacia.
      const { data: items } = await supabase.from('items').select('status, due_date, tag, type, column_id').eq('is_template', false);
      const { data: cols } = await supabase.from('columns').select('id, title');
      if (items) {
        const shoppingColIds = new Set(
          (cols || []).filter((c: any) => /SHOP|COMPRA/i.test(c.title || '')).map((c: any) => c.id)
        );
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const relevant = items.filter((i: any) =>
          i.type === 'task' &&
          !shoppingColIds.has(i.column_id) &&
          (i.tag || '').toUpperCase() !== 'COMPRA'
        );
        const done = relevant.filter((i: any) => i.status === 'done').length;
        const pending = relevant.filter((i: any) => {
          if (i.status === 'done') return false;
          if (!i.due_date) return true; // sin fecha = exigible hoy
          const d = parseISO(i.due_date);
          return !isValid(d) || format(d, 'yyyy-MM-dd') <= todayStr; // las futuras no cuentan
        }).length;
        const total = done + pending;
        const percent = total > 0 ? Math.round((done / total) * 100) : 100; // sin pendientes exigibles = al día
        setStats({ total, done, pending, percent });
      }

    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        username: formName,
        bio: formBio,
        avatar_url: formAvatar 
      });
      setProfile({ ...profile, username: formName, bio: formBio, avatar_url: formAvatar });
      setIsEditing(false);
      alert("PERFIL ACTUALIZADO");
    } catch (e) {
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Lógica Nivel
  const xp = profile?.xp_points || 0;
  const currentLevel = Math.floor(xp / 100) + 1;
  const xpInCurrentLevel = xp % 100;
  const progressPercent = (xpInCurrentLevel / 100) * 100;

  if (loading) {
    return (
      <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
        <ActivityIndicator size="large" color={Y2K_COLORS.ACID_GREEN} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Y2K_COLORS.ACID_GREEN} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ID DE AGENTE</Text>
          <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
             <Text style={[styles.editBtn, isEditing && {color: Y2K_COLORS.ACID_GREEN}]}>
               {isEditing ? (saving ? '...' : 'GUARDAR') : 'EDITAR'}
             </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.idCard}>
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              onPress={() => profile?.avatar_url && setZoomVisible(true)}
              disabled={!profile?.avatar_url} 
              style={styles.avatarPlaceholder}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <MaterialCommunityIcons name="account" size={40} color="black" />
              )}
            </TouchableOpacity>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>LVL {currentLevel}</Text>
            </View>
          </View>

          <View style={{flex: 1}}>
            {isEditing ? (
              <View>
                <Text style={styles.label}>NOMBRE CLAVE:</Text>
                <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Nombre..." placeholderTextColor="#666" />
              </View>
            ) : (
              <Text style={styles.username}>{profile?.username || 'AGENTE'}</Text>
            )}

            {isEditing ? (
              <View style={{marginTop: 10}}>
                 <Text style={styles.label}>INFO / BIO:</Text>
                 <TextInput style={[styles.input, {height: 60}]} value={formBio} onChangeText={setFormBio} multiline placeholder="Estado actual..." placeholderTextColor="#666" />
              </View>
            ) : (
              <Text style={styles.bio}>{profile?.bio || 'Sin biografía.'}</Text>
            )}
          </View>
        </View>

        {/* --- SECCIÓN NUEVA: ESTADÍSTICAS DE RENDIMIENTO --- */}
        {!isEditing && (
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>RENDIMIENTO DE MISIÓN</Text>
            
            <View style={styles.statsGrid}>
               <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.done}</Text>
                  <Text style={styles.statLabel}>COMPLETADAS</Text>
               </View>
               <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.pending}</Text>
                  <Text style={styles.statLabel}>PENDIENTES</Text>
               </View>
               <View style={[styles.statCard, {borderColor: Y2K_COLORS.ACID_GREEN}]}>
                  <Text style={[styles.statValue, {color: Y2K_COLORS.ACID_GREEN}]}>{stats.percent}%</Text>
                  <Text style={styles.statLabel}>EFICIENCIA</Text>
               </View>
            </View>

            <Text style={[styles.label, {marginTop: 20}]}>PROGRESO ACTUAL (XP):</Text>
            <View style={styles.xpTrack}>
               <View style={[styles.xpFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={{color: '#666', fontSize: 10, marginTop: 5, textAlign: 'right'}}>{xpInCurrentLevel} / 100 XP PARA SIGUIENTE NIVEL</Text>
          </View>
        )}

        {isEditing && (
          <View style={styles.configSection}>
            <Text style={styles.sectionTitle}>CONFIGURACIÓN DE IMAGEN</Text>
            <Text style={styles.label}>URL FOTO DE PERFIL:</Text>
            <TextInput style={styles.input} value={formAvatar} onChangeText={setFormAvatar} placeholder="https://..." placeholderTextColor="#666" />
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={zoomVisible} transparent={true} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setZoomVisible(false)}>
          <View style={styles.zoomOverlay}>
            {profile?.avatar_url && <Image source={{ uri: profile.avatar_url }} style={styles.zoomImage} resizeMode="contain" />}
            <Text style={styles.zoomText}>[ TOCAR PARA CERRAR ]</Text>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Y2K_COLORS.DEEP_BLACK },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Y2K_COLORS.GRID_LINE },
  backBtn: { padding: 5, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE },
  headerTitle: { color: Y2K_COLORS.WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  editBtn: { color: Y2K_COLORS.DIM_GRAY, fontWeight: 'bold', fontSize: 12, padding: 5 },
  idCard: { flexDirection: 'row', backgroundColor: 'rgba(26, 26, 26, 0.9)', padding: 20, borderWidth: 1, borderColor: Y2K_COLORS.ACID_GREEN, marginBottom: 20 },
  avatarSection: { alignItems: 'center', marginRight: 20 },
  avatarPlaceholder: { width: 70, height: 70, backgroundColor: Y2K_COLORS.ACID_GREEN, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden', borderWidth: 2, borderColor: Y2K_COLORS.WHITE },
  avatarImage: { width: '100%', height: '100%' },
  levelBadge: { backgroundColor: Y2K_COLORS.WHITE, paddingHorizontal: 8, paddingVertical: 2 },
  levelText: { color: 'black', fontWeight: 'bold', fontSize: 10 },
  username: { color: Y2K_COLORS.WHITE, fontSize: 22, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  bio: { color: Y2K_COLORS.DIM_GRAY, fontSize: 14, fontFamily: 'monospace', lineHeight: 20 },
  label: { color: Y2K_COLORS.ACID_GREEN, fontSize: 10, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#000', color: 'white', padding: 10, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, fontSize: 16, width: '100%' },
  configSection: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, marginBottom: 20 },
  sectionTitle: { color: Y2K_COLORS.WHITE, fontWeight: 'bold', marginBottom: 15 },
  
  // NUEVOS ESTILOS DE ESTADÍSTICAS
  statsContainer: { marginBottom: 30 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { 
    flex: 1, backgroundColor: Y2K_COLORS.DARK_GRAY, padding: 15, 
    alignItems: 'center', borderWidth: 1, borderColor: Y2K_COLORS.GRID_LINE, marginHorizontal: 4 
  },
  statValue: { color: Y2K_COLORS.WHITE, fontSize: 24, fontWeight: '900' },
  statLabel: { color: Y2K_COLORS.DIM_GRAY, fontSize: 9, marginTop: 5, fontWeight: 'bold' },

  xpTrack: { height: 12, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#444' },
  xpFill: { height: '100%', backgroundColor: Y2K_COLORS.ACID_GREEN },

  logoutBtn: { borderWidth: 1, borderColor: Y2K_COLORS.ERROR, padding: 15, alignItems: 'center', marginTop: 10 },
  logoutText: { color: Y2K_COLORS.ERROR, fontWeight: 'bold', letterSpacing: 1 },
  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  zoomImage: { width: '100%', height: '80%' },
  zoomText: { color: Y2K_COLORS.ACID_GREEN, marginTop: 20, fontWeight: 'bold', letterSpacing: 2 },
});