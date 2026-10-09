-- =============================================================================
-- 20261009000200_etapa1_peliculas_a_compras.sql — Ajuste de datos de la etapa 1
-- =============================================================================
-- Pedido de Jean al probar la etapa 1 (8 oct 2026): las películas (área Cine,
-- venidas de la columna LISTA DE PELÍCULAS) no son tareas sino cosas para
-- conseguir. Pasan a tipo 'compra' manteniendo el área Cine: salen de la
-- pestaña Tareas y en Compras el chip CINE muestra la lista de películas.
--
-- Solo cambia el tipo de esos ítems de la cuenta de Jean. No borra nada.
-- =============================================================================

begin;

update public.items i
   set tipo = 'compra'
  from public.areas a
 where a.id = i.area_id
   and a.nombre = 'Cine'
   and i.tipo = 'tarea'
   and i.user_id = (select id from public.profiles where username = 'Jean ji');

commit;
