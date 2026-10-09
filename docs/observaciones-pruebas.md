# Observaciones de Jean al probar el rediseño

Registro de lo que Jean ve al usar cada etapa en el día a día. Lo que ya se
resolvió queda marcado; lo que necesita una decisión de diseño se lleva al
chat de diseño antes de implementarlo (docs/rediseno.md manda).

## Etapa 1 (8 oct 2026)

### Las películas aparecían como tareas — resuelto
La columna LISTA DE PELÍCULAS se migró como tareas del área Cine y ocupaban
espacio entre las tareas reales. Jean pidió tenerlas en Compras con la
etiqueta de cine. Se pasan a tipo `compra` manteniendo el área Cine
(migración `20261009000200_etapa1_peliculas_a_compras.sql`): en Compras, el
chip CINE muestra la lista de películas.

### Una entrada que es varias cosas a la vez — para diseñar (etapas 2 y 6)
Ejemplo de Jean: *"comprar zapatos para un matrimonio que tengo el 14 de
noviembre, lo antes posible"*. Al ordenarla, la app pregunta si es tarea,
evento o compra, pero en realidad es las tres:

- una **compra** (los zapatos), con urgencia ("lo antes posible");
- un **evento** (el matrimonio, el 14 de noviembre), si no estaba anotado;
- y la compra tiene sentido **antes** de ese evento.

Qué ya permite la base: una entrada puede crear varios ítems
(`items.entrada_id`), así que no hace falta cambiar el modelo para esto.

Preguntas para el chat de diseño:
1. Al ordenar a mano (etapa 1), ¿se puede crear más de un ítem desde la
   misma entrada? Propuesta: después de crear el primero, ofrecer "Crear
   otro desde esta entrada" en vez de marcarla como ordenada de inmediato.
2. ¿Las compras pueden tener fecha límite? Hoy el formulario de compra no
   pide fecha. Con fecha, "zapatos antes del 14 de noviembre" aparecería en
   Pronto / Vencidas como cualquier pendiente.
3. ¿Se puede vincular un ítem a un evento ("los zapatos son para el
   matrimonio")? Sería un vínculo nuevo, parecido al de objetivos.
4. Reglas (etapa 2): las reglas simples reconocen "comprar" y la fecha, pero
   no que "matrimonio" es un evento. Separar una frase en compra + evento
   es trabajo de la IA (etapa 6); las reglas deberían como mínimo crear la
   compra con su fecha y dejar el resto para ordenar a mano.
