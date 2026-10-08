# ZenTask — Requerimientos para el rediseño (auditoría, 8 oct 2026)

Documento para llevar a un chat de diseño. Recoge lo que pidió Jean, el
estado actual de la app y las decisiones que hay que tomar antes de
programar. El resultado del chat de diseño vuelve al chat de desarrollo
para implementarse por etapas.

---

## 0. Contexto: cómo está ZenTask hoy

**Qué es.** App personal de Jean para gestionar la toma de decisiones y el
cumplimiento de objetivos a partir de rutinas. Es la capa "Ejecutar" del
Segundo Cerebro y será también la capa "Capturar" (el Buzón).

**Tecnología.** Expo / React Native con versión web. Se usa sobre todo
como PWA instalada en el celular (https://jeandangelo.github.io/ZenTask/).
Base de datos en Supabase, compartida con ZenMoney. No hay servidor propio:
la app habla directo con Supabase.

**Modelo actual.**
- **Columnas**: tablero horizontal que se desliza de lado. Por defecto:
  HOY [FOCUS], ESTA SEMANA y SHOPPING LIST (protegida). Más dos listas
  virtuales: PROGRAMADAS (tareas con fecha futura) y MIS OBJETIVOS.
- **Ítems**: tareas u objetivos. Una tarea puede vincularse a un objetivo.
  Las tareas tienen **día de vencimiento, pero no hora**.
- **Rutinas**: una plantilla con repetición diaria, semanal o mensual. Cada
  día que toca, la app copia la plantilla como una tarea suelta. **La copia
  no guarda de qué rutina viene.**
- **Gamificación**: XP y niveles al tachar tareas (los calcula la base de
  datos). Eficiencia en el perfil (solo cuenta tareas exigibles).
- **Pantallas**: Login, Tablero (columnas), Cronograma (calendario
  mensual + lista del día), Perfil.

**Principios que no se negocian** (del documento del Segundo Cerebro):
1. Sobrevivir a una semana mala: nada de rachas que se pierden; retomar
   cuesta cero.
2. Registrar algo en menos de 10 segundos; capturar, en menos de 5.
3. Preferir mejorar lo que existe antes que construir algo nuevo.
4. Presupuesto $0: solo planes gratuitos.

---

## 1. Estado de cada requerimiento

| # | Requerimiento | Estado |
|---|---|---|
| R1 | Cronograma sin rutinas | ✅ Hecho (8 oct) |
| R2 | Menú de opciones en la tarjeta + deslizar para borrar | 🟡 Menú hecho; deslizar pendiente |
| R3 | Formulario simple + opciones avanzadas | ✅ Hecho (8 oct) |
| R4 | Rutinas con identidad propia (editables) | 🔴 Requiere diseño y cambio en la base |
| R5 | Buzón de captura / asistente como pantalla inicial | 🔴 Requiere diseño |
| R6 | Quitar el sistema de columnas → vistas o páginas | 🔴 Requiere diseño (cambio de fondo) |
| R7 | Vista tipo Classroom: vencidas / hoy / pronto | 🔴 Requiere diseño |
| R8 | Cronograma tipo Google Calendar con horas | 🔴 Requiere diseño y cambio en la base |
| R9 | Interfaz moderna | 🔴 Requiere diseño |
| R10 | Conservar funciones existentes en el modelo nuevo | 🔴 Decidir qué se queda |

---

## 2. Detalle por requerimiento

### R1 · Cronograma solo con tareas programadas — ✅ HECHO
- **Problema:** las rutinas se proyectaban todos los días y tapaban las
  tareas programadas reales.
- **Solución aplicada:** el cronograma muestra solo tareas con fecha; se
  ocultan las rutinas y las copias que generan.
- **Limitación conocida:** las copias se reconocen por tener el mismo
  título que una rutina activa. Una tarea normal con el mismo título que
  una rutina también se ocultaría. Se resuelve de raíz con R4.
- **Para el diseño:** ¿las rutinas deberían verse en *algún* lugar del
  calendario nuevo (R8), por ejemplo como bloques tenues o con un filtro?

### R2 · Menú de opciones en la tarjeta + deslizar para borrar — 🟡 PARCIAL
- **Problema original:** el ícono ⋯ borraba la tarea directamente.
- **Hecho:** ⋯ abre un menú con EDITAR y ELIMINAR; tocar la tarjeta edita.
- **Pendiente:**
  - Deslizar hacia la izquierda para eliminar, como en otras apps.
  - Definir qué otras acciones van en el menú (mover de lista, posponer
    a mañana, convertir en rutina, vincular a objetivo, duplicar…).
- **Riesgo técnico:** el tablero actual ya se desliza de lado para cambiar
  de columna; un gesto lateral sobre la tarjeta compite con ese gesto. Si
  las columnas desaparecen (R6), el conflicto desaparece. Requiere agregar
  una librería de gestos (se justifica al implementar).
- **Decisiones para el diseño:**
  - ¿Deslizar borra directo con opción "Deshacer" unos segundos, o pide
    confirmación? (Recomendación: borrar + Deshacer; es lo estándar y más
    rápido.)
  - ¿Deslizar hacia el otro lado hace otra acción (por ejemplo, completar
    o posponer)?
  - Lista final de acciones del menú.

### R3 · Formulario simple con opciones avanzadas — ✅ HECHO
- **Problema:** para anotar una tarea simple del día aparecían demasiadas
  opciones.
- **Solución aplicada:** al crear una tarea solo se pide el título (Enter
  guarda). Detalles, etiqueta, fecha, repetición y objetivo quedan detrás
  de "OPCIONES AVANZADAS".
- **Requisito permanente:** este patrón debe sobrevivir al rediseño, como
  la forma manual de crear tareas junto al Buzón (R5). Jean quiere ambos
  caminos.

### R4 · Rutinas con identidad propia — 🔴 DISEÑO + BASE DE DATOS
- **Problema:** hoy una rutina es una plantilla que se copia cada día. Si
  Jean edita la tarea de hoy, cambia solo esa copia; la próxima vez la
  rutina vuelve a salir con el contenido viejo. Desde "Mis rutinas" no se
  puede editar nada, solo borrar.
- **Necesidad:** que la rutina sea una entidad propia y editable, no un
  efecto secundario de crear una tarea con repetición.
- **Implicación técnica:** cada copia diaria debe guardar de qué rutina
  viene (una columna nueva en la base, `template_id` o similar). Es un
  cambio de esquema; el SQL se muestra a Jean antes de ejecutarlo.
- **Decisiones para el diseño:**
  - ¿Las rutinas tienen su propia pantalla (crear, editar, pausar, ver
    historial)?
  - Al editar la tarea de hoy que vino de una rutina: ¿preguntar "solo
    hoy / toda la rutina", como Google Calendar con eventos repetidos?
  - ¿Se crean desde "Nueva tarea → repetir" (como hoy), desde una sección
    de rutinas, o ambas?
  - ¿Qué datos tiene una rutina? (título, días, hora, objetivo vinculado,
    checklist interna como "Rutina mañana: ducha, desayuno, revisar
    agenda"…)
  - Si no se abre la app el día que tocaba una rutina semanal o mensual,
    hoy esa tarea **no se genera nunca**. ¿Debe aparecer atrasada al abrir,
    o se pierde? (Ligado al principio "retomar cuesta cero".)
  - ¿Se muestra cumplimiento de rutinas (por ejemplo, 5 de 7 esta semana)
    sin castigar rachas perdidas?

### R5 · Buzón de captura / asistente como pantalla inicial — 🔴 DISEÑO
- **Necesidad:** al abrir la app, lo primero es el Buzón, un chat o ambos.
  Jean escribe o dicta lo que quiere ("agéndame una prueba el jueves",
  "comprar proteína", "idea para el proyecto", "apuntes de cálculo", "mi
  PR de banca") y el sistema lo registra donde corresponde.
- **Base existente:** el documento "Segundo Cerebro / Buzón" ya decidió:
  un solo buzón, captura en menos de 5 segundos, capturar no es organizar
  (texto crudo sin campos), se vacía cada noche, y cada ítem tiene un solo
  destino (tarea, lista de deseos, Notion, chat de arquitectura o borrar).
- **Hay dos niveles distintos que conviene separar:**
  1. **Buzón simple:** escribir → Enter → guardado crudo; el ruteo lo hace
     Jean en el vaciado nocturno. Es barato, rápido de construir y cumple
     el documento del Buzón.
  2. **Asistente inteligente:** interpreta el texto o la voz y crea
     directamente la tarea, la fecha, la compra, etc.
- **Implicaciones técnicas del asistente:**
  - Interpretar lenguaje natural requiere un modelo de IA, con costo por
    uso (bajo, pero no $0) y una clave que no puede vivir en la app: haría
    falta una función en el servidor (Supabase Edge Functions sirve).
  - La voz funciona bien en Chrome/Android. En la PWA de iPhone el dictado
    del navegador es limitado; el teclado de iOS sí trae dictado propio.
  - Varios destinos aún no existen como áreas: "apuntes de la universidad"
    depende del área de Estudio (sin diseñar); "PR de banca" depende de un
    área de Salud física (sin diseñar).
- **Decisiones para el diseño:**
  - ¿Se parte con el Buzón simple y el asistente viene después?
    (Recomendación: sí.)
  - ¿Qué destinos existen el día 1 y cuáles quedan para cuando existan sus
    áreas?
  - ¿Cómo se ve el vaciado nocturno (lista con un botón por destino,
    deslizar, menú)?
  - ¿Qué pasa con un ítem que lleva muchos días en el buzón?
  - ¿Se acepta un costo mensual pequeño por la IA, o se mantiene $0?
- **Pendiente previo (tarea de Jean):** cronometrar el arranque en frío
  (pantalla bloqueada → abrir → escribir "prueba" → guardar). Si pasa de
  8–10 segundos, primero hay que optimizar el arranque.

### R6 · Quitar el sistema de columnas — 🔴 DISEÑO (CAMBIO DE FONDO)
- **Problema:** hoy todo se organiza por "en qué columna está". Es mucha
  información visual y obliga a decidir dónde guardar cada cosa.
- **Necesidad:** reemplazarlo por pantallas o vistas (Jean menciona
  "widgets" o "páginas"), con el Buzón al entrar y el resto accesible
  desde ahí.
- **Implicaciones:**
  - Es el cambio que más afecta a todo lo demás: define la navegación,
    la pantalla inicial y dónde viven compras y objetivos.
  - Hay que decidir qué pasa con los datos actuales (las tareas hoy
    pertenecen a una columna). Se pueden migrar sin perder nada.
- **Decisiones para el diseño:**
  - Mapa de pantallas y cómo se navega (por ejemplo, barra inferior con
    Buzón · Hoy · Calendario · Rutinas · Objetivos/Perfil).
  - ¿Qué reemplaza a las columnas para agrupar? (categorías, etiquetas,
    proyectos, o solo fecha y tipo).
  - ¿La SHOPPING LIST pasa a ser la "lista de deseos" del Buzón? ¿Con
    precio? (ZenMoney tiene planificada su integración con esta lista.)
  - ¿Dónde viven los objetivos y cómo se ve su progreso?

### R7 · Vista tipo Classroom: vencidas / vencen hoy / vencen pronto — 🔴 DISEÑO
- **Necesidad:** ver de un vistazo qué está atrasado, qué toca hoy y qué
  viene, como en Google Classroom.
- **Encaja bien con R6:** puede ser la vista principal de tareas (o la
  parte inferior de la pantalla del Buzón).
- **Decisiones para el diseño:**
  - ¿Cuántos días cuentan como "pronto" (3, 7)?
  - ¿Dónde van las tareas sin fecha?
  - ¿Las tareas hechas se ven (sección "Completadas"), se ocultan, o se
    ven unos segundos como hoy?
  - ¿Cómo se muestran las vencidas sin generar culpa (principio de semana
    mala)? Por ejemplo, botón "mover todas a hoy".

### R8 · Cronograma tipo Google Calendar con horas — 🔴 DISEÑO + BASE DE DATOS
- **Necesidad:** ver el día por horas para planificar qué se hace y cuándo.
- **Implicación técnica:** hoy las tareas tienen día pero no hora ni
  duración. Hay que agregar hora de inicio y, opcionalmente, duración (cambio
  de esquema). También hay que decidir cómo se ve una tarea sin hora en una
  vista por horas (Google Calendar la pone arriba, como "todo el día").
- **Decisiones para el diseño:**
  - Vistas: ¿día, semana, mes, o solo día + mes?
  - ¿Arrastrar para mover una tarea de hora?
  - ¿Las rutinas con hora aparecen como bloques? (Ver R1.)
  - ¿Notificaciones a la hora de la tarea? (En la PWA de iPhone las
    notificaciones locales son limitadas.)
  - ¿Sincronizar con Google Calendar real o es solo una vista propia?
    (Integrar con Google agrega complejidad; recomendación: vista propia
    primero.)

### R9 · Interfaz moderna — 🔴 DISEÑO
- **Necesidad:** una interfaz mucho más moderna y con mejor diseño, que
  simplifique el uso.
- **Estado actual:** estética Y2K (negro, verde ácido #CCFF00, mayúsculas,
  tipografía monospace, textos tipo "PROTOCOLO", "AGENTE").
- **Decisiones para el diseño:**
  - ¿Se mantiene la identidad Y2K modernizada o se cambia por completo?
    (ZenMoney comparte la base Y2K con acento dorado; cambiar una afecta
    la coherencia del ecosistema.)
  - Apps de referencia que le gusten a Jean (2 o 3 ejemplos ayudan mucho).
  - Modo claro/oscuro, tipografía, tono de los textos (¿se mantiene el
    lenguaje tipo "agente/protocolo"?).
  - Prioridad móvil: la app se usa sobre todo en el celular.

### R10 · Conservar funciones existentes — 🔴 DECIDIR
Jean quiere simplificar, pero sin perder lo que funciona. Para cada
función hay que decidir si se queda, cambia o sale:

| Función | Hoy | Pregunta |
|---|---|---|
| Tareas (to-do) | Por columna | ¿Agrupadas por fecha (R7)? |
| Tareas programadas | Columna virtual | ¿Se integra en R7/R8? |
| Rutinas | Plantilla + copia diaria | Ver R4 |
| Objetivos | Columna virtual, tareas vinculadas | ¿Pantalla propia con progreso? |
| Shopping list | Columna protegida | ¿Pasa a "lista de deseos"? |
| XP y niveles | Al tachar | ¿Se mantiene? ¿Se ve dónde? |
| Eficiencia | En el perfil | ¿Se mantiene? |
| Búsqueda | Barra en el tablero | ¿Dónde va? |
| Fondo y avatar por URL | En el perfil | ¿Se mantiene? |

---

## 3. Pendientes técnicos conocidos (no son de diseño, pero afectan)
1. **Esquema de la base no versionado:** falta guardar en el repo la
   definición de las tablas, la seguridad por fila y la función de XP.
   Jean debe correr una consulta de solo lectura en Supabase y pasar el
   resultado. Es requisito antes de R4, R6 y R8 (todos cambian la base).
2. **Rutinas duplicadas** si la app se abre en dos dispositivos al mismo
   tiempo. Se resuelve con R4 (restricción en la base).
3. **Arranque en frío:** medir antes de decidir si el Buzón necesita
   optimización (ver R5).

---

## 4. Dependencias y orden sugerido

```
Esquema versionado ─┬─> R4 Rutinas ──────────┐
                    ├─> R8 Horas ────────────┤
R6 Sin columnas ────┼─> R7 Vista Classroom ──┼─> R9 Interfaz moderna
                    └─> R5 Buzón simple ─────┘        (se aplica a todo)
                                └─> R5 Asistente IA (después, cuando
                                    existan las áreas de Estudio/Salud)
```

Orden sugerido de implementación, una vez diseñado:
1. Versionar el esquema de la base.
2. R6 + R7: nueva navegación sin columnas, con la vista de tareas por
   vencimiento.
3. R5 (Buzón simple) como pantalla inicial.
4. R4: rutinas como entidad propia.
5. R2: deslizar para borrar y menú definitivo.
6. R8: cronograma por horas.
7. R9 se diseña al inicio y se aplica en cada etapa, no al final.
8. R5 (asistente con IA) cuando el Buzón simple esté en uso y existan los
   destinos.

---

## 5. Qué debe traer de vuelta el chat de diseño
Para que el chat de desarrollo pueda implementarlo sin adivinar:
1. **Mapa de pantallas** y navegación, con qué muestra cada una.
2. **Decisiones** de cada sección "Decisiones para el diseño" de arriba.
3. **Modelo de datos nuevo** en palabras (qué reemplaza a las columnas,
   qué datos tiene una rutina, si las tareas tienen hora).
4. **Identidad visual:** referencias, colores, tipografía y tono.
5. **Qué entra en la primera etapa** y qué se deja para después.
6. **Criterios de aceptación** por pantalla (por ejemplo, "capturar en el
   Buzón toma menos de 5 segundos desde la app abierta").
