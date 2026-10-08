import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AREA_COLORS, colors, fonts, radius, space, type } from '../theme/tokens';
import { useZen } from '../state/ZenStore';
import { api, IS_DEMO } from '../services/api';
import { confirmAction } from '../services/dialogs';
import { Area, Objetivo } from '../domain/types';
import ScreenHeader, { SectionLabel } from '../components/ui/ScreenHeader';
import { Sheet, SheetOption } from '../components/ui/Sheet';
import { Field, Input, PrimaryButton } from '../components/ui/Fields';

// Perfil (decisión 8): cuenta, avatar, XP y nivel, gestión de áreas y de
// objetivos. Los gráficos de Progreso llegan en la etapa 5.

const XP_POR_NIVEL = 100;

export default function PerfilScreen() {
  const zen = useZen();
  const { perfil, areas, objetivos, items } = zen;
  const [editPerfil, setEditPerfil] = useState(false);
  const [areaSheet, setAreaSheet] = useState<Area | 'nueva' | null>(null);
  const [objSheet, setObjSheet] = useState<Objetivo | 'nuevo' | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);

  const activas = areas.filter(a => !a.archivada_at).sort((a, b) => a.orden - b.orden);
  const archivadas = areas.filter(a => a.archivada_at);
  const xp = perfil?.xp_points ?? 0;
  const enNivel = ((xp % XP_POR_NIVEL) + XP_POR_NIVEL) % XP_POR_NIVEL;
  const pendientesDe = (o: Objetivo) => items.filter(i => i.objetivo_id === o.id).length;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <ScreenHeader title="Perfil" subtitle={IS_DEMO ? 'Modo demo: datos de ejemplo, no se guarda nada' : undefined} />

      {/* Cuenta y nivel */}
      <TouchableOpacity style={styles.cuenta} onPress={() => setEditPerfil(true)} activeOpacity={0.8}>
        {perfil?.avatar_url
          ? <Image source={{ uri: perfil.avatar_url }} style={styles.avatar} />
          : <View style={[styles.avatar, styles.avatarVacio]}><MaterialCommunityIcons name="account" size={30} color={colors.metal} /></View>}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.nombre}>{perfil?.username || 'Sin nombre'}</Text>
          <View style={styles.nivelRow}>
            <Text style={styles.nivel}>NIVEL {perfil?.level ?? 1}</Text>
            <Text style={type.meta}>{xp} XP</Text>
          </View>
          <View style={styles.barra}><View style={[styles.barraFill, { width: `${enNivel}%` }]} /></View>
          <Text style={type.meta}>{XP_POR_NIVEL - enNivel} XP para el siguiente nivel</Text>
        </View>
        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Áreas */}
      <SectionLabel title="Áreas" count={activas.length} />
      <View style={styles.bloque}>
        {activas.map((a, i) => (
          <View key={a.id} style={[styles.fila, i > 0 && styles.filaBorde]}>
            <TouchableOpacity style={styles.filaMain} onPress={() => setAreaSheet(a)}>
              <View style={[styles.dot, { backgroundColor: a.color }]} />
              <Text style={styles.filaText}>{a.nombre}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={i === 0} onPress={() => zen.moveArea(a, -1)} style={styles.flecha} accessibilityLabel={`Subir ${a.nombre}`}>
              <MaterialCommunityIcons name="chevron-up" size={20} color={i === 0 ? colors.border : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity disabled={i === activas.length - 1} onPress={() => zen.moveArea(a, 1)} style={styles.flecha} accessibilityLabel={`Bajar ${a.nombre}`}>
              <MaterialCommunityIcons name="chevron-down" size={20} color={i === activas.length - 1 ? colors.border : colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[styles.fila, activas.length > 0 && styles.filaBorde]} onPress={() => setAreaSheet('nueva')}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.accentLight} />
          <Text style={[styles.filaText, { color: colors.accentLight }]}>Nueva área</Text>
        </TouchableOpacity>
      </View>
      {archivadas.length > 0 && (
        <TouchableOpacity onPress={() => setVerArchivadas(v => !v)} style={styles.archivadasToggle}>
          <Text style={type.meta}>{verArchivadas ? 'Ocultar' : 'Ver'} archivadas ({archivadas.length})</Text>
        </TouchableOpacity>
      )}
      {verArchivadas && archivadas.map(a => (
        <View key={a.id} style={styles.archivada}>
          <View style={[styles.dot, { backgroundColor: a.color, opacity: 0.5 }]} />
          <Text style={[styles.filaText, { color: colors.textMuted }]}>{a.nombre}</Text>
          <TouchableOpacity onPress={() => zen.updateArea(a, { archivada_at: null, orden: activas.length })}>
            <Text style={styles.link}>Restaurar</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Objetivos */}
      <SectionLabel title="Objetivos" count={objetivos.length} />
      <View style={styles.bloque}>
        {objetivos.map((o, i) => (
          <TouchableOpacity key={o.id} style={[styles.fila, i > 0 && styles.filaBorde]} onPress={() => setObjSheet(o)}>
            <MaterialCommunityIcons name="flag-outline" size={18} color={colors.metal} />
            <Text style={styles.filaText}>{o.titulo}</Text>
            <Text style={type.meta}>{pendientesDe(o)} pendiente{pendientesDe(o) === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.fila, objetivos.length > 0 && styles.filaBorde]} onPress={() => setObjSheet('nuevo')}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.accentLight} />
          <Text style={[styles.filaText, { color: colors.accentLight }]}>Nuevo objetivo</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.salir} onPress={() => api.auth.signOut()}>
        <Text style={styles.salirText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <PerfilSheet visible={editPerfil} onClose={() => setEditPerfil(false)} />
      <AreaSheet area={areaSheet} onClose={() => setAreaSheet(null)} />
      <ObjetivoSheet objetivo={objSheet} onClose={() => setObjSheet(null)} />
    </ScrollView>
  );
}

function PerfilSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { perfil, updatePerfil } = useZen();
  const [nombre, setNombre] = useState('');
  const [avatar, setAvatar] = useState('');
  useEffect(() => { if (visible) { setNombre(perfil?.username ?? ''); setAvatar(perfil?.avatar_url ?? ''); } }, [visible, perfil]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Editar perfil">
      <Field label="Nombre"><Input value={nombre} onChangeText={setNombre} placeholder="Tu nombre" /></Field>
      <Field label="Foto (URL)"><Input value={avatar} onChangeText={setAvatar} placeholder="https://…" autoCapitalize="none" /></Field>
      <PrimaryButton label="Guardar" onPress={() => { updatePerfil({ username: nombre.trim() || null, avatar_url: avatar.trim() || null }); onClose(); }} />
    </Sheet>
  );
}

function AreaSheet({ area, onClose }: { area: Area | 'nueva' | null; onClose: () => void }) {
  const { createArea, updateArea } = useZen();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<string>(AREA_COLORS[0].hex);
  const editando = area && area !== 'nueva' ? area : null;
  useEffect(() => {
    if (!area) return;
    setNombre(editando?.nombre ?? '');
    setColor(editando?.color ?? AREA_COLORS[0].hex);
  }, [area]);

  const guardar = () => {
    if (!nombre.trim()) return;
    if (editando) updateArea(editando, { nombre: nombre.trim(), color });
    else createArea(nombre, color);
    onClose();
  };

  return (
    <Sheet visible={!!area} onClose={onClose} title={editando ? 'Editar área' : 'Nueva área'}>
      <Field label="Nombre"><Input value={nombre} onChangeText={setNombre} placeholder="Ej. Universidad" autoFocus={!editando} onSubmitEditing={guardar} /></Field>
      <Field label="Color">
        <View style={styles.swatches}>
          {AREA_COLORS.map(c => (
            <TouchableOpacity key={c.hex} onPress={() => setColor(c.hex)} accessibilityLabel={c.nombre}
              style={[styles.swatch, { backgroundColor: c.hex }, color === c.hex && styles.swatchActive]} />
          ))}
        </View>
      </Field>
      <PrimaryButton label="Guardar" onPress={guardar} disabled={!nombre.trim()} />
      {editando && (
        <SheetOption icon="archive-outline" label="Archivar área" danger onPress={async () => {
          if (await confirmAction('Archivar área', `"${editando.nombre}" deja de aparecer en los filtros. Sus ítems no se borran y puedes restaurarla.`, 'Archivar')) {
            updateArea(editando, { archivada_at: new Date().toISOString() });
            onClose();
          }
        }} />
      )}
    </Sheet>
  );
}

function ObjetivoSheet({ objetivo, onClose }: { objetivo: Objetivo | 'nuevo' | null; onClose: () => void }) {
  const { createObjetivo, updateObjetivo, deleteObjetivo } = useZen();
  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const editando = objetivo && objetivo !== 'nuevo' ? objetivo : null;
  useEffect(() => {
    if (!objetivo) return;
    setTitulo(editando?.titulo ?? '');
    setNotas(editando?.notas ?? '');
  }, [objetivo]);

  const guardar = async () => {
    if (!titulo.trim()) return;
    if (editando) updateObjetivo(editando, { titulo: titulo.trim(), notas: notas.trim() || null });
    else {
      const o = await createObjetivo(titulo);
      if (o && notas.trim()) updateObjetivo(o, { notas: notas.trim() });
    }
    onClose();
  };

  return (
    <Sheet visible={!!objetivo} onClose={onClose} title={editando ? 'Editar objetivo' : 'Nuevo objetivo'}>
      <Field label="Objetivo"><Input value={titulo} onChangeText={setTitulo} placeholder="Ej. Aprobar Cálculo II" autoFocus={!editando} /></Field>
      <Field label="Notas"><Input value={notas} onChangeText={setNotas} placeholder="Opcional" multiline /></Field>
      <PrimaryButton label="Guardar" onPress={guardar} disabled={!titulo.trim()} />
      {editando && (
        <SheetOption icon="trash-can-outline" label="Eliminar objetivo" danger onPress={async () => {
          if (await confirmAction('Eliminar objetivo', `Las tareas vinculadas a "${editando.titulo}" no se borran: solo quedan sin objetivo.`, 'Eliminar')) {
            deleteObjetivo(editando);
            onClose();
          }
        }} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuenta: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg, marginHorizontal: space.lg, marginTop: space.sm,
    padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.metal },
  avatarVacio: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated },
  nombre: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  nivelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nivel: { color: colors.metalLight, fontFamily: fonts.display, fontSize: 14, letterSpacing: 2 },
  barra: { height: 6, borderRadius: 3, backgroundColor: colors.elevated, overflow: 'hidden' },
  barraFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  bloque: { marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 50 },
  filaBorde: { borderTopWidth: 1, borderTopColor: colors.border },
  filaMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  filaText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  flecha: { padding: 6 },
  archivadasToggle: { paddingHorizontal: space.lg, paddingTop: space.sm },
  archivada: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.sm },
  link: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  salir: { marginHorizontal: space.lg, marginTop: space.xxl, padding: space.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  salirText: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 15 },
});
