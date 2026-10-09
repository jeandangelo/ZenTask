// Modelo de datos del rediseño (docs/rediseno.md, sección 5), tal como lo
// devuelve la base. Fechas como 'yyyy-MM-dd' y horas como 'HH:mm[:ss]'.

export type TipoItem = 'tarea' | 'evento' | 'compra';

export interface Area {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  archivada_at: string | null;
}

export interface Item {
  id: string;
  tipo: TipoItem;
  titulo: string;
  notas: string | null;
  area_id: string | null;
  fecha: string | null;        // sin fecha = sección "Sin fecha"
  hora_inicio: string | null;  // fecha sin hora = "todo el día"
  duracion_min: number | null;
  objetivo_id: string | null;
  rutina_id: string | null;
  ocurrencia_fecha: string | null;
  entrada_id: string | null;
  completada_at: string | null;
  created_at: string;
}

export interface Objetivo {
  id: string;
  titulo: string;
  notas: string | null;
  area_id: string | null;
  fecha_meta: string | null;
  completado_at: string | null;
}

export type Recurrencia = 'diaria' | 'semanal' | 'mensual';

export type ModoHorario = 'fija' | 'flexible' | 'sin_hora';

export interface Rutina {
  id: string;
  titulo: string;
  notas: string | null;
  area_id: string | null;
  recurrencia: Recurrencia;
  dias_semana: number[] | null; // 0 = domingo … 6 = sábado
  dia_mes: number | null;
  // fija = bloque a una hora (turno 9–17); flexible = en un rango, "por
  // planificar" hasta darle hora (entreno 18–22); sin_hora = solo se marca
  modo_horario: ModoHorario;
  hora_inicio: string | null;
  duracion_min: number | null;
  rango_inicio: string | null;
  rango_fin: string | null;
  marcable: boolean; // false = solo ocupa tiempo: sin check, sin XP, sin cumplimiento
  objetivo_id: string | null;
  pausada_at: string | null;
  created_at: string;
}

// Datos editables de una rutina (formulario)
export type RutinaInput = Omit<Rutina, 'id' | 'pausada_at' | 'created_at'>;

// Paso de la checklist interna de una rutina
export interface RutinaPaso {
  id: string;
  rutina_id: string;
  texto: string;
  orden: number;
}

// Paso marcado en una ocurrencia concreta (un día)
export interface ItemPaso {
  item_id: string;
  paso_id: string;
}

export type EstadoEntrada = 'sin_ordenar' | 'procesada' | 'descartada';

export interface Entrada {
  id: string;
  texto: string;
  origen: 'texto' | 'voz';
  estado: EstadoEntrada;
  regla: string | null; // qué reglas la interpretaron (etapa 2); null = ordenada a mano o sin ordenar
  created_at: string;
  procesada_at: string | null;
}

export interface Perfil {
  id: string;
  username: string | null;
  avatar_url: string | null;
  xp_points: number;
  level: number;
}

// Datos para crear o editar un ítem desde un formulario
export type ItemInput = Partial<Pick<Item,
  'titulo' | 'notas' | 'area_id' | 'fecha' | 'hora_inicio' | 'duracion_min' | 'objetivo_id'>> & { tipo?: TipoItem };
