-- =============================================================================
-- 20261025000000_contraer_modelo_viejo.sql — Retirar el modelo de columnas
-- =============================================================================
-- Fase "CONTRAER" del rediseño. La etapa 1 agregó el modelo nuevo al lado del
-- viejo (fase "expandir") para poder volver atrás. Jean aprobó las etapas
-- 1 y 2 usando la app (25 oct 2026), así que lo viejo ya no hace falta:
--
-- - items: se quitan las columnas viejas (type, title, status, tag,
--   column_id, linked_goal_id, description, due_date, is_template,
--   recurrence, recurrence_day, last_generated).
-- - Se elimina la tabla columns (el tablero de columnas) y las funciones
--   toggle_task_status y add_xp (las reemplazó completar_item).
--
-- Sin pérdida de datos: las filas de items que nunca pasaron al modelo
-- nuevo (los objetivos y plantillas de rutina viejos, que ya se copiaron a
-- objetivos/rutinas con el MISMO id, y los ítems de la cuenta de prueba)
-- conservan su título, notas y fecha en las columnas nuevas y quedan
-- archivadas (deleted_at). Respaldo CSV obligatorio antes de correr esto.
--
-- No toca profiles (fondo y bio quedan guardados: decisión pendiente de la
-- especificación) ni ninguna tabla fin_* (ZenMoney). Todo en una transacción.
-- =============================================================================

begin;

-- ── 1. Rescatar lo que solo vive en columnas viejas ─────────────────────────
update public.items
   set titulo     = coalesce(titulo, title),
       notas      = coalesce(notas, nullif(btrim(description), '')),
       fecha      = coalesce(fecha, (due_date at time zone 'America/Santiago')::date),
       deleted_at = coalesce(deleted_at, now())
 where tipo is null;

-- Desde ahora todo ítem tiene título (los viejos ya lo recibieron arriba)
alter table public.items alter column titulo set not null;

-- ── 2. Quitar las columnas viejas de items ───────────────────────────────────
-- (column_id y linked_goal_id se llevan sus llaves foráneas con ellas)
alter table public.items
  drop column column_id,
  drop column linked_goal_id,
  drop column type,
  drop column title,
  drop column status,
  drop column tag,
  drop column description,
  drop column due_date,
  drop column is_template,
  drop column recurrence,
  drop column recurrence_day,
  drop column last_generated;

-- ── 3. Tabla y funciones del modelo viejo ────────────────────────────────────
drop table public.columns;
drop function public.toggle_task_status(uuid, text);
drop function public.add_xp(integer);

commit;


-- =============================================================================
-- Verificación (correr después; solo lee). Las 4 filas deben decir OK.
-- =============================================================================
-- select 'no quedan columnas viejas en items' as chequeo,
--        case when not exists (select 1 from information_schema.columns
--                              where table_schema = 'public' and table_name = 'items'
--                                and column_name in ('type','title','status','column_id','due_date','is_template'))
--             then 'OK' else 'REVISAR' end as resultado
-- union all
-- select 'tabla columns eliminada',
--        case when to_regclass('public.columns') is null then 'OK' else 'REVISAR' end
-- union all
-- select 'todos los ítems tienen título',
--        case when not exists (select 1 from public.items where titulo is null) then 'OK' else 'REVISAR' end
-- union all
-- select 'ZenMoney intacto (tablas fin_)',
--        case when (select count(*) from information_schema.tables where table_schema = 'public' and table_name like 'fin\_%') >= 5
--             then 'OK' else 'REVISAR' end;
