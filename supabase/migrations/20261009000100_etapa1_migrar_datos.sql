-- =============================================================================
-- 20261009000100_etapa1_migrar_datos.sql — Etapa 1: datos al modelo nuevo
-- =============================================================================
-- Copia los datos de la cuenta de Jean desde el modelo viejo (columnas,
-- plantillas, objetivos dentro de items) al modelo nuevo. NO borra ni
-- modifica ninguna columna vieja: solo llena las tablas y columnas nuevas.
-- La cuenta de prueba "jeanjiiii" no se migra (decisión de Jean, 8 oct 2026).
--
-- Decisiones aplicadas (8 oct 2026):
-- - Áreas iniciales: Universidad, Trabajo, Entrenamiento, Desarrollo, Marca,
--   Personal + Cine (desde LISTA DE PELÍCULAS).
-- - SHOPPING LIST (o etiqueta COMPRA) → tipo 'compra'.
-- - MIS OBJETIVOS (items type='goal') → tabla objetivos, con el MISMO id, así
--   los vínculos de las tareas (linked_goal_id) siguen valiendo.
-- - Plantillas de rutina → tabla rutinas (mismo id), modo 'sin_hora'.
-- - Copias de rutinas → se vinculan por título; si una rutina tiene dos copias
--   el mismo día, solo la primera queda como ocurrencia y la otra como tarea.
-- - REQUERIMIENTOS ZENTASK → borrado lógico (deleted_at): ya están cubiertos.
-- - Tareas ya completadas: completada_at = fecha de creación (la base nunca
--   guardó cuándo se completaron). Progreso solo contará desde el rediseño.
-- - Tareas sin fecha de HOY / ESTA SEMANA → quedan sin fecha.
--
-- Se puede correr una sola vez: si la cuenta ya tiene áreas, se detiene sin
-- tocar nada. Todo en una transacción.
-- =============================================================================

begin;

do $$
declare
  v_user     uuid;
  v_cine     uuid;
begin
  -- Cuenta a migrar: exactamente una, o no se hace nada
  select id into strict v_user from public.profiles where username = 'Jean ji';

  if exists (select 1 from public.areas where user_id = v_user) then
    raise exception 'La cuenta ya fue migrada (tiene áreas). No se hizo nada.';
  end if;

  -- ── 1. Áreas (color = paleta apagada de docs/rediseno.md, sección 7) ──────
  insert into public.areas (user_id, nombre, color, orden) values
    (v_user, 'Universidad',   '#6E8BB0', 0),  -- azul acero
    (v_user, 'Trabajo',       '#C9A15A', 1),  -- ámbar
    (v_user, 'Entrenamiento', '#C97A6B', 2),  -- coral
    (v_user, 'Desarrollo',    '#5FA8B8', 3),  -- cian frío
    (v_user, 'Marca',         '#B8679A', 4),  -- magenta
    (v_user, 'Personal',      '#6FB59A', 5),  -- menta
    (v_user, 'Cine',          '#9B8AC4', 6);  -- violeta
  select id into v_cine from public.areas where user_id = v_user and nombre = 'Cine';

  -- ── 2. Objetivos (mismo id que el ítem goal original) ──────────────────────
  insert into public.objetivos (id, user_id, titulo, notas, fecha_meta, completado_at, created_at)
  select i.id, i.user_id, i.title, nullif(btrim(i.description), ''),
         (i.due_date at time zone 'America/Santiago')::date,
         case when i.status = 'done' then i.created_at end,
         i.created_at
    from public.items i
   where i.user_id = v_user and i.type = 'goal';

  -- ── 3. Rutinas (mismo id que la plantilla original) ────────────────────────
  insert into public.rutinas (id, user_id, titulo, notas, recurrencia, dias_semana, dia_mes,
                              modo_horario, objetivo_id, created_at)
  select t.id, t.user_id, t.title, nullif(btrim(t.description), ''),
         case t.recurrence when 'daily' then 'diaria' when 'weekly' then 'semanal' else 'mensual' end,
         case when t.recurrence = 'weekly' then array[t.recurrence_day]::smallint[] end,
         case when t.recurrence = 'monthly' then t.recurrence_day end,
         'sin_hora',
         (select o.id from public.objetivos o where o.id = t.linked_goal_id),
         t.created_at
    from public.items t
   where t.user_id = v_user and t.is_template = true
     and t.recurrence in ('daily', 'weekly', 'monthly');

  -- ── 4. Tareas y compras (las mismas filas de items, columnas nuevas) ───────
  -- (left join: una tarea sin columna también se migra)
  update public.items i
     set tipo          = case when coalesce(x.col, '') ~* '(SHOP|COMPRA)' or upper(coalesce(i.tag, '')) = 'COMPRA'
                              then 'compra' else 'tarea' end,
         titulo        = i.title,
         notas         = nullif(btrim(i.description), ''),
         fecha         = (i.due_date at time zone 'America/Santiago')::date,
         area_id       = case when coalesce(x.col, '') ~* 'PEL[IÍ]CULAS' then v_cine end,
         objetivo_id   = (select o.id from public.objetivos o where o.id = i.linked_goal_id),
         completada_at = case when i.status = 'done' then i.created_at end,
         deleted_at    = case when coalesce(x.col, '') ~* 'REQUERIMIENTOS ZENTASK' then now() end
    from (select i2.id, c.title as col
            from public.items i2
            left join public.columns c on c.id = i2.column_id) x
   where x.id = i.id
     and i.user_id = v_user
     and i.type = 'task'
     and coalesce(i.is_template, false) = false;

  -- ── 5. Copias de rutinas → ocurrencias (una por rutina y día) ──────────────
  with candidatas as (
    select i.id, r.id as rutina_id, i.fecha,
           row_number() over (partition by r.id, i.fecha
                              order by (i.completada_at is null), i.created_at, i.id) as n
      from public.items i
      join public.rutinas r on r.user_id = i.user_id and r.titulo = i.titulo
     where i.user_id = v_user and i.tipo = 'tarea' and i.fecha is not null
  )
  update public.items i
     set rutina_id = c.rutina_id, ocurrencia_fecha = c.fecha
    from candidatas c
   where c.id = i.id and c.n = 1;
end;
$$;

commit;


-- =============================================================================
-- Verificación (correr después; solo lee). Cada fila debe decir OK.
-- =============================================================================
-- with u as (select id from public.profiles where username = 'Jean ji')
-- select 'items viejos de tareas = migrados' as chequeo,
--        case when (select count(*) from public.items i, u where i.user_id = u.id and i.type = 'task' and not coalesce(i.is_template, false))
--                = (select count(*) from public.items i, u where i.user_id = u.id and i.tipo is not null)
--             then 'OK' else 'REVISAR' end
-- union all
-- select 'objetivos = goals viejos',
--        case when (select count(*) from public.items i, u where i.user_id = u.id and i.type = 'goal')
--                = (select count(*) from public.objetivos o, u where o.user_id = u.id)
--             then 'OK' else 'REVISAR' end
-- union all
-- select 'rutinas = plantillas viejas',
--        case when (select count(*) from public.items i, u where i.user_id = u.id and i.is_template)
--                = (select count(*) from public.rutinas r, u where r.user_id = u.id)
--             then 'OK' else 'REVISAR' end
-- union all
-- select 'vínculos a objetivos conservados',
--        case when (select count(*) from public.items i, u where i.user_id = u.id and i.type = 'task' and i.linked_goal_id is not null and not coalesce(i.is_template, false))
--                = (select count(*) from public.items i, u where i.user_id = u.id and i.objetivo_id is not null)
--             then 'OK' else 'REVISAR' end;
