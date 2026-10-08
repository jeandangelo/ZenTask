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

export interface Rutina {
  id: string;
  titulo: string;
  notas: string | null;
  area_id: string | null;
  recurrencia: Recurrencia;
  dias_semana: number[] | null; // 0 = domingo … 6 = sábado
  dia_mes: number | null;
  modo_horario: 'fija' | 'flexible' | 'sin_hora';
  hora_inicio: string | null;
  marcable: boolean;
  objetivo_id: string | null;
  pausada_at: string | null;
}

export type EstadoEntrada = 'sin_ordenar' | 'procesada' | 'descartada';

export interface Entrada {
  id: string;
  texto: string;
  origen: 'texto' | 'voz';
  estado: EstadoEntrada;
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
