-- =============================================================================
-- 20261009000000_etapa1_modelo_nuevo.sql — Etapa 1 del rediseño: modelo nuevo
-- =============================================================================
-- Fase "EXPANDIR" (docs/rediseno.md, sección 5). Solo AGREGA: tablas nuevas y
-- columnas nuevas en items. No borra ni renombra nada, así que la versión
-- actual de la app sigue funcionando igual después de correr esto.
--
-- Lo viejo (tabla columns; columnas type, status, tag, column_id, due_date,
-- is_template, recurrence… de items; función toggle_task_status) se retira en
-- una migración posterior ("CONTRAER"), recién cuando Jean apruebe la etapa 1.
--
-- No toca ninguna tabla fin_* (ZenMoney) ni profiles.
-- Todo va en una transacción: si algo falla, no queda nada a medias.
-- =============================================================================

begin;

-- ── Utilidad: updated_at automático ─────────────────────────────────────────
create or replace function public.zt_set_updated_at()
 returns trigger
 language plpgsql
 set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ── Áreas ────────────────────────────────────────────────────────────────────
-- Eje "área": definidas por cada usuario. El color pinta el calendario.
create table public.areas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre       text not null check (length(btrim(nombre)) > 0),
  color        text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden        integer not null default 0,
  archivada_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- No puede haber dos áreas activas con el mismo nombre (sin importar mayúsculas)
create unique index areas_nombre_activo_unico
  on public.areas (user_id, lower(nombre)) where archivada_at is null;
create index areas_user_orden_idx on public.areas (user_id, orden);


-- ── Objetivos ────────────────────────────────────────────────────────────────
-- Avance = ítems vinculados completados / total (se calcula, no se guarda).
create table public.objetivos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null check (length(btrim(titulo)) > 0),
  notas         text,
  area_id       uuid references public.areas(id) on delete set null,
  fecha_meta    date,
  completado_at timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index objetivos_user_idx on public.objetivos (user_id) where deleted_at is null;


-- ── Rutinas ──────────────────────────────────────────────────────────────────
-- Entidad propia y editable. Cada día que toca se genera UNA ocurrencia en
-- items (rutina_id + ocurrencia_fecha); la restricción única de items impide
-- duplicados aunque la app se abra en dos dispositivos.
create table public.rutinas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo       text not null check (length(btrim(titulo)) > 0),
  notas        text,
  area_id      uuid references public.areas(id) on delete set null,
  recurrencia  text not null check (recurrencia in ('diaria', 'semanal', 'mensual')),
  -- semanal: días de la semana, 0 = domingo … 6 = sábado
  dias_semana  smallint[] check (dias_semana <@ array[0,1,2,3,4,5,6]::smallint[]),
  -- mensual: día del mes; en meses más cortos cae el último día
  dia_mes      smallint check (dia_mes between 1 and 31),
  modo_horario text not null default 'sin_hora' check (modo_horario in ('fija', 'flexible', 'sin_hora')),
  hora_inicio  time,
  duracion_min integer check (duracion_min > 0),
  rango_inicio time,
  rango_fin    time,
  -- false = solo ocupa tiempo (un turno): sin check, no cuenta para XP ni cumplimiento
  marcable     boolean not null default true,
  objetivo_id  uuid references public.objetivos(id) on delete set null,
  pausada_at   timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint rutinas_semanal_con_dias check (recurrencia <> 'semanal' or cardinality(dias_semana) > 0),
  constraint rutinas_mensual_con_dia  check (recurrencia <> 'mensual' or dia_mes is not null),
  constraint rutinas_fija_con_hora    check (modo_horario <> 'fija' or hora_inicio is not null),
  constraint rutinas_flexible_rango   check (modo_horario <> 'flexible'
                                             or (rango_inicio is not null and rango_fin is not null and rango_fin > rango_inicio))
);
create index rutinas_user_idx on public.rutinas (user_id) where deleted_at is null;

-- Checklist interna de una rutina
create table public.rutina_pasos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rutina_id  uuid not null references public.rutinas(id) on delete cascade,
  texto      text not null check (length(btrim(texto)) > 0),
  orden      integer not null default 0,
  created_at timestamptz not null default now()
);
create index rutina_pasos_rutina_idx on public.rutina_pasos (rutina_id, orden);


-- ── Entradas (Home / Buzón) ──────────────────────────────────────────────────
-- Todo lo que se escribe o dicta en el Home. Una entrada puede crear VARIOS
-- ítems ("comprar leche, pan, palta" = 3 compras), por eso el vínculo va en
-- items.entrada_id y no aquí.
create table public.entradas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto        text not null check (length(btrim(texto)) > 0),
  origen       text not null default 'texto' check (origen in ('texto', 'voz')),
  estado       text not null default 'sin_ordenar' check (estado in ('sin_ordenar', 'procesada', 'descartada')),
  -- qué regla la interpretó (etapa 2); null = nadie, quedó para ordenar a mano
  regla        text,
  created_at   timestamptz not null default now(),
  procesada_at timestamptz
);
create index entradas_user_fecha_idx on public.entradas (user_id, created_at desc);
create index entradas_sin_ordenar_idx on public.entradas (user_id) where estado = 'sin_ordenar';


-- ── Items: columnas nuevas (las viejas quedan intactas hasta CONTRAER) ───────
alter table public.items
  add column tipo             text check (tipo in ('tarea', 'evento', 'compra')),
  add column titulo           text,
  add column notas            text,
  add column area_id          uuid references public.areas(id) on delete set null,
  -- fecha sin hora = "todo el día"; sin fecha = sección "Sin fecha"
  add column fecha            date,
  add column hora_inicio      time,
  add column duracion_min     integer check (duracion_min > 0),
  add column objetivo_id      uuid references public.objetivos(id) on delete set null,
  add column rutina_id        uuid references public.rutinas(id) on delete set null,
  add column ocurrencia_fecha date,
  add column entrada_id       uuid references public.entradas(id) on delete set null,
  add column completada_at    timestamptz,
  add column deleted_at       timestamptz,
  add column updated_at       timestamptz not null default now(),
  add constraint items_hora_requiere_fecha check (hora_inicio is null or fecha is not null),
  -- una sola ocurrencia por rutina y día (dos dispositivos no duplican)
  add constraint items_ocurrencia_unica unique (rutina_id, ocurrencia_fecha);

-- Los ítems nuevos ya no llevan type ni title (usan tipo y titulo).
-- Quitar el NOT NULL no cambia ningún dato ni afecta a la app actual.
alter table public.items alter column type  drop not null;
alter table public.items alter column title drop not null;

create index items_user_fecha_idx on public.items (user_id, fecha) where deleted_at is null and tipo is not null;
create index items_objetivo_idx   on public.items (objetivo_id) where objetivo_id is not null;
create index items_entrada_idx    on public.items (entrada_id) where entrada_id is not null;


-- ── Checklist de cada ocurrencia ─────────────────────────────────────────────
create table public.item_pasos (
  item_id       uuid not null references public.items(id) on delete cascade,
  paso_id       uuid not null references public.rutina_pasos(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  completado_at timestamptz not null default now(),
  primary key (item_id, paso_id)
);


-- ── Reprogramaciones (historial honesto, decisión 8c) ────────────────────────
-- Reprogramar una tarea vencida no borra que venció: queda registrado aquí.
create table public.reprogramaciones (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id        uuid not null references public.items(id) on delete cascade,
  fecha_anterior date,
  fecha_nueva    date, -- null = se le quitó la fecha
  estaba_vencida boolean not null,
  created_at     timestamptz not null default now()
);
create index reprogramaciones_user_fecha_idx on public.reprogramaciones (user_id, created_at);


-- ── updated_at automático ────────────────────────────────────────────────────
create trigger areas_updated_at     before update on public.areas     for each row execute function public.zt_set_updated_at();
create trigger objetivos_updated_at before update on public.objetivos for each row execute function public.zt_set_updated_at();
create trigger rutinas_updated_at   before update on public.rutinas   for each row execute function public.zt_set_updated_at();
create trigger items_updated_at     before update on public.items     for each row execute function public.zt_set_updated_at();


-- ── Seguridad por fila: cada usuario ve y toca solo lo suyo ─────────────────
-- (select auth.uid()) en vez de auth.uid(): Postgres lo evalúa una vez por
-- consulta y no una vez por fila (mismo patrón que las tablas de ZenMoney).
alter table public.areas            enable row level security;
alter table public.objetivos        enable row level security;
alter table public.rutinas          enable row level security;
alter table public.rutina_pasos     enable row level security;
alter table public.entradas         enable row level security;
alter table public.item_pasos       enable row level security;
alter table public.reprogramaciones enable row level security;

create policy areas_propias            on public.areas            for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy objetivos_propios        on public.objetivos        for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rutinas_propias          on public.rutinas          for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rutina_pasos_propios     on public.rutina_pasos     for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy entradas_propias         on public.entradas         for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy item_pasos_propios       on public.item_pasos       for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reprogramaciones_propias on public.reprogramaciones for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- items ya tiene RLS activa ("Users can all items"); se le agrega WITH CHECK
-- explícito para que no se pueda insertar un ítem a nombre de otro usuario.
drop policy "Users can all items" on public.items;
create policy "Users can all items" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── Completar / descompletar un ítem (+10 / −10 XP) ──────────────────────────
-- Reemplaza a toggle_task_status para el modelo nuevo. A diferencia de la
-- vieja, verifica que el ítem sea del usuario. Las ocurrencias de rutinas no
-- marcables (turnos) no se completan ni dan XP. El nivel nunca baja.
create or replace function public.completar_item(p_item_id uuid, p_completar boolean)
 returns void
 language plpgsql
 security definer
 set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_completada timestamptz;
  v_marcable   boolean;
  v_xp         integer;
begin
  select i.completada_at, coalesce(r.marcable, true)
    into v_completada, v_marcable
    from public.items i
    left join public.rutinas r on r.id = i.rutina_id
   where i.id = p_item_id and i.user_id = v_uid and i.deleted_at is null
   for update of i;

  if not found then
    raise exception 'Ítem no encontrado';
  end if;
  if not v_marcable then
    raise exception 'Esta rutina no se marca (solo ocupa tiempo)';
  end if;

  -- Idempotente: si ya está en el estado pedido no hace nada (doble toque).
  if p_completar = (v_completada is not null) then
    return;
  end if;

  update public.items
     set completada_at = case when p_completar then now() end
   where id = p_item_id;

  update public.profiles
     set xp_points = coalesce(xp_points, 0) + case when p_completar then 10 else -10 end
   where id = v_uid
  returning xp_points into v_xp;

  -- Ratchet: el nivel sube con el XP pero nunca baja
  update public.profiles
     set level = greatest(coalesce(level, 1), floor(coalesce(v_xp, 0) / 100) + 1)
   where id = v_uid;
end;
$$;

-- La función vieja sigue en uso por la app actual hasta el cambio de versión:
-- se le agrega la verificación de dueño que le faltaba.
create or replace function public.toggle_task_status(task_id uuid, target_status text)
 returns void
 language plpgsql
 security definer
 set search_path = ''
as $$
declare
  current_status text;
  current_xp int;
  new_level int;
begin
  select status into current_status from public.items
   where id = task_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Tarea no encontrada';
  end if;
  if current_status = target_status then
    return;
  end if;

  update public.items set status = target_status where id = task_id;

  if target_status = 'done' then
    update public.profiles set xp_points = xp_points + 10 where id = auth.uid();
  else
    update public.profiles set xp_points = xp_points - 10 where id = auth.uid();
  end if;

  select xp_points into current_xp from public.profiles where id = auth.uid();
  new_level := floor(current_xp / 100) + 1;
  update public.profiles set level = greatest(level, new_level) where id = auth.uid();
end;
$$;

commit;
