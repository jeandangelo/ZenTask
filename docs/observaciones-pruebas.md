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

Decisiones de Jean (9 oct 2026):
- **Compras con fecha — resuelto.** Una compra sin fecha es solo una
  compra (vive en Compras). Con fecha también hay que preocuparse por ella:
  aparece además en Tareas (Vencidas / Hoy / Pronto). El formulario de
  compra pide "Comprar antes del" en opciones avanzadas.
- **Vincular compras a eventos — no por ahora.** Cada compra se organiza
  solo por su área (etiqueta).
- **Reglas (etapa 2) — hecho.** "comprar zapatos para el matrimonio el 14
  de noviembre" crea UNA compra con fecha 14 de noviembre. Reconocer que
  "matrimonio" además es un evento queda para la IA (etapa 6).

Pendiente para el chat de diseño:
- Crear más de un ítem desde la misma entrada al ordenar a mano (por
  ejemplo, la compra de los zapatos Y el evento del matrimonio desde una
  sola nota). Jean no lo necesita por ahora; queda para cuando se diseñe
  la IA, que es la que separaría una frase en varias cosas.
