-- =============================================================================
-- 20261008000000_esquema_inicial.sql — ZenTask: esquema tal como existe hoy
-- =============================================================================
-- Etapa 0 del rediseño (docs/rediseno.md). Este archivo DOCUMENTA la base que
-- ya está en producción (sacado de information_schema, pg_constraint,
-- pg_policies, pg_proc, information_schema.triggers y pg_indexes el 8 oct 2026). NO se ejecuta contra la base actual:
-- esos objetos ya existen. Sirve para recrear ZenTask desde cero y como punto
-- de partida de las migraciones siguientes.
--
-- Solo cubre las tablas de ZenTask. Las tablas fin_* son de ZenMoney y viven
-- en ZenMoney-App/supabase/fin_schema.sql.
-- =============================================================================


-- ── Tablas ───────────────────────────────────────────────────────────────────

create table public.columns (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id),
  title          text not null,
  position       integer default 0,
  is_goal_column boolean default false,
  created_at     timestamptz not null default timezone('utc'::text, now())
);

create table public.items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id),
  column_id      uuid references public.columns(id) on delete cascade,
  type           text not null check (type = any (array['task'::text, 'goal'::text])),
  title          text not null,
  status         text default 'pending'::text check (status = any (array['pending'::text, 'done'::text])),
  tag            text,
  -- Sin ON DELETE: borrar un objetivo con tareas vinculadas falla.
  linked_goal_id uuid references public.items(id),
  created_at     timestamptz not null default timezone('utc'::text, now()),
  description    text,
  due_date       timestamptz,
  is_template    boolean default false,
  recurrence     text default 'none'::text,
  recurrence_day integer,
  last_generated text
);

create table public.profiles (
  id             uuid primary key references auth.users(id),
  username       text,
  avatar_url     text,
  xp_points      integer default 0,
  level          integer default 1,
  created_at     timestamptz not null default timezone('utc'::text, now()),
  background_url text,
  bio            text
);


-- ── Seguridad por fila (RLS) ─────────────────────────────────────────────────

alter table public.columns  enable row level security;
alter table public.items    enable row level security;
alter table public.profiles enable row level security;

create policy "Users can all columns" on public.columns
  for all using (auth.uid() = user_id);

create policy "Users can all items" on public.items
  for all using (auth.uid() = user_id);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

create policy "Users can view own profile." on public.profiles
  for select using (auth.uid() = id);


-- ── Funciones ────────────────────────────────────────────────────────────────

-- Crea el perfil al registrarse un usuario (la llama un trigger en auth.users).
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
  insert into public.profiles (id, username, xp_points)
  values (new.id, split_part(new.email, '@', 1), 0);
  return new;
end;
$function$;

-- Suma XP al usuario actual. La app no la usa hoy.
create or replace function public.add_xp(amount integer)
 returns void
 language plpgsql
 security definer
as $function$
DECLARE
  current_xp int;
  new_xp int;
  current_level int;
  new_calculated_level int;
BEGIN
  -- 1. Obtener datos actuales
  SELECT xp_points, level INTO current_xp, current_level
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Calcular nuevos valores
  new_xp := current_xp + amount;
  new_calculated_level := floor(new_xp / 100) + 1;

  -- 3. Actualizar (El nivel solo cambia si el nuevo es MAYOR al actual)
  UPDATE public.profiles
  SET xp_points = new_xp,
      level = GREATEST(current_level, new_calculated_level)
  WHERE id = auth.uid();
END;
$function$;

-- Tacha/destacha una tarea y suma/resta 10 XP; el nivel nunca baja.
-- Ojo: es SECURITY DEFINER (salta RLS) y no verifica que la tarea sea del
-- usuario que llama. Se corrige en la migración de la etapa 1.
create or replace function public.toggle_task_status(task_id uuid, target_status text)
 returns void
 language plpgsql
 security definer
as $function$
DECLARE
  current_status text;
  current_xp int;
  new_level int;
BEGIN
  -- 1. Bloquear la fila de la tarea para que nadie más la toque mientras operamos
  SELECT status INTO current_status FROM public.items WHERE id = task_id FOR UPDATE;

  -- 2. IDEMPOTENCIA: Si la tarea YA tiene el estado que queremos, NO HACEMOS NADA.
  -- Esto evita que ganes puntos dobles si haces click rápido.
  IF current_status = target_status THEN
    RETURN;
  END IF;

  -- 3. Actualizar el estado de la tarea
  UPDATE public.items SET status = target_status WHERE id = task_id;

  -- 4. Calcular y Actualizar XP (Todo en la misma transacción)
  IF target_status = 'done' THEN
    -- Sumar puntos
    UPDATE public.profiles SET xp_points = xp_points + 10 WHERE id = auth.uid();
  ELSE
    -- Restar puntos (Si se desmarca)
    UPDATE public.profiles SET xp_points = xp_points - 10 WHERE id = auth.uid();
  END IF;

  -- 5. Ratchet de Nivel (Recalcular nivel, pero NUNCA bajar)
  -- Obtenemos el XP actualizado
  SELECT xp_points INTO current_xp FROM public.profiles WHERE id = auth.uid();

  -- Calculamos el nivel teórico (xp / 100 + 1)
  new_level := floor(current_xp / 100) + 1;

  -- Actualizamos el nivel SOLO si el nuevo es mayor al actual (Ratchet)
  UPDATE public.profiles
  SET level = GREATEST(level, new_level)
  WHERE id = auth.uid();

END;
$function$;


-- ── Triggers ─────────────────────────────────────────────────────────────────

-- Al registrarse un usuario se le crea su perfil.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Índices ──────────────────────────────────────────────────────────────────
-- No hay índices fuera de las llaves primarias (columns_pkey, items_pkey,
-- profiles_pkey, creadas arriba). Ni items.user_id ni items.column_id tienen
-- índice: con pocos cientos de filas no se nota; se agregan en la etapa 1.
