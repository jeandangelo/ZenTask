# ZenTask — Especificación del rediseño

Oct 8, 2026 · @Jeanjiiii

## 1. Contexto y visión

ZenTask pasa de ser un tablero de columnas a ser un asistente de productividad: escribes o dictas en un solo campo, la app lo ordena, y todo se ve en un calendario por horas con rutinas y progreso en el tiempo.

**Hoy:** Expo / React Native con versión web, usada sobre todo como PWA en el celular ([jeandangelo.github.io/ZenTask](https://jeandangelo.github.io/ZenTask/)). Base en Supabase, compartida con ZenMoney, sin servidor propio. Tablero de columnas (HOY, ESTA SEMANA, SHOPPING LIST + listas virtuales PROGRAMADAS y MIS OBJETIVOS), tareas con día pero sin hora, rutinas que se copian cada día sin guardar su origen, XP y niveles calculados en la base.

**Ya hecho (8 oct 2026):** R1 cronograma sin rutinas, R3 formulario simple con opciones avanzadas, menú ⋯ con Editar/Eliminar (parte de R2).

**Visión final:** chat de IA + calendario tipo Google Calendar + herramientas de productividad y visualización. La IA es la última capa; primero el modelo de datos, las vistas y una entrada que funcione sin IA.

**Alcance:** app personal de Jean, diseñada para poder escalar (nada específico de Jean en el código; áreas por usuario). Onboarding para otros usuarios queda para el futuro.

**Principios que no se negocian:**

1. Sobrevivir a una semana mala: sin rachas que se pierden; retomar cuesta cero.
2. Capturar en menos de 5 segundos; registrar en menos de 10.
3. Mejorar lo existente antes que construir de cero.
4. Presupuesto $0 hasta la etapa de IA, donde se acepta revisar ese límite.

## 2. Reglas de trabajo para Claude Code

Code implementa por etapas y no avanza a la siguiente sin que Jean pruebe la anterior en su celular.

- **Base de datos:** todo SQL (migraciones, políticas, funciones) se muestra a Jean antes de ejecutarse. Nada se ejecuta sin su aprobación.
- **ZenMoney:** la base es compartida. Ninguna migración toca, renombra o borra tablas de ZenMoney.
- **Sin pérdida de datos:** las tareas, rutinas y objetivos actuales se migran al modelo nuevo; nada se borra. Hacer respaldo (export) antes de cada migración.
- **Esquema versionado:** cada cambio de base queda como archivo de migración en el repo (por ejemplo `supabase/migrations/`).
- **Entregas:** archivos completos en vez de fragmentos sueltos, y comandos exactos para copiar y pegar.
- **Móvil primero:** cada pantalla se diseña para el celular (PWA) y se verifica en la web.
- **Dependencias nuevas** (gestos, calendario, arrastrar) solo con justificación breve: por qué, peso y alternativa.
- **Un commit por paso** con mensaje claro, para poder volver atrás.
- **Si algo no está decidido en este documento,** Code pregunta a Jean en vez de suponer.

## 3. Decisiones tomadas

Las columnas desaparecen: todo se organiza con tres ejes (tipo, cuándo, área) y se navega con una barra inferior de 5 pestañas.

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Organización | Tres ejes: **tipo** (tarea, evento, rutina, objetivo, compra), **cuándo** (fecha + hora y duración opcionales) y **área** (definida por el usuario, opcional al capturar). |
| 1b | Áreas iniciales de Jean | Universidad, Trabajo, Entrenamiento, Desarrollo, Marca, Personal. Editables, archivables. Finanzas y búsqueda de empleo quedan fuera. |
| 1c | Notion | Apuntes y temas de estudio se envían a Notion; ZenTask no los guarda ni los organiza (etapa IA). |
| 1d | Alcance | App personal con modelo genérico; sin onboarding ni otros usuarios por ahora. |
| 2 | Navegación | Barra inferior: Tareas/Calendario · Rutinas · **Home (centro)** · Compras · Perfil. Áreas como chips de filtro dentro de cada vista; sin página por área. |
| 2b | Compras | Es un tipo de ítem con área opcional, con pestaña propia. |
| 3 | Entrada | Un solo campo en el Home, texto y voz. Analiza y distribuye. Sin IA: reglas simples para lo obvio; lo demás cae al Buzón. Todo resultado es visible y editable. |
| 4 | Home | Mínimo: campo de entrada + historial + franja compacta "Lo próximo" (2–3 ítems de hoy, marcables). |
| 5 | Tareas (lista) | Secciones Sin ordenar · Vencidas · Hoy · Pronto (7 días móviles) · Sin fecha. Completadas se ocultan con Deshacer. Vencidas: botón reprogramar por ítem. |
| 6 | Tareas (calendario) | Vistas día, semana y mes. Arrastrar para cambiar hora. Franja "todo el día" para ítems con fecha sin hora. |
| 6b | Código visual | Color = área. Estilo = tipo (evento sólido, rutina punteada, turno relleno apagado, tarea con check). |
| 7 | Rutinas | Entidad propia. No cumplida = se pierde (sin vencida). Horario fijo, flexible (rango) o sin hora. "¿Solo hoy o toda la rutina?" solo en rutinas de hora fija. Checklist interna con avance parcial. Marcable o no (turno = no marcable). |
| 8 | Progreso (en Perfil) | Avance de objetivos, completadas vs. vencidas en el tiempo, cumplimiento semanal de rutinas. Se mantienen XP y niveles; sale la eficiencia. |
| 8b | Objetivos | Avance = tareas vinculadas completadas / total. |
| 8c | Historial honesto | Una tarea que venció queda registrada como vencida aunque se reprograme. |
| 9 | Gestos y menú | Deslizar izquierda = eliminar con Deshacer. Derecha = completar. Menú ⋯: Editar · Reprogramar · Cambiar área · Vincular a objetivo · Convertir en rutina · Duplicar · Eliminar. |
| 9b | Otros | Búsqueda: lupa en Tareas. Avatar por URL se mantiene. Fondo queda como está. |
| 10 | Identidad | Y2K modernizado, más limpio y legible. Textos en lenguaje normal y directo (sale "PROTOCOLO"/"AGENTE"). |
| 11 | Etapas | Orden aprobado en la sección 8. |

## 4. Mapa de pantallas

Cinco pestañas en una barra inferior fija, con el Home al centro; Login se mantiene como hoy.

| Pestaña | Qué muestra | Acciones principales |
| --- | --- | --- |
| **Tareas / Calendario** | Interruptor lista ↔ calendario. Lista: Sin ordenar (Buzón), Vencidas, Hoy, Pronto (7 días), Sin fecha. Calendario: día, semana, mes, con franja "todo el día". Chips de área arriba. | Crear tarea (formulario simple + opciones avanzadas, R3), buscar (lupa), completar, reprogramar, arrastrar en calendario, ordenar ítems del Buzón. |
| **Rutinas** | Lista de rutinas con área, horario y cumplimiento de la semana (ej. 4/5). Chips de área. | Crear, editar, pausar, eliminar; editar checklist interna. |
| **Home** | Franja "Lo próximo" arriba (2–3 ítems de hoy, se oculta si no hay). Historial de entradas con tarjetas de resultado. Campo de entrada abajo (texto + micrófono). | Escribir o dictar; editar o deshacer el resultado de cada entrada; marcar ítems de "Lo próximo". |
| **Compras** | Ítems tipo compra, pendientes arriba y comprados ocultos con Deshacer. Chips de área. | Agregar, marcar comprado, editar, eliminar. |
| **Perfil** | Cuenta, avatar, XP y nivel. Secciones Objetivos (con avance) y Progreso (gráficos). Gestión de áreas (nombre, color, orden, archivar). | Crear y editar objetivos y áreas; cerrar sesión. |

## 5. Modelo de datos propuesto

Se diseña completo en la etapa 1, aunque la interfaz llegue por partes, para no migrar la base varias veces. Es una propuesta: Code la ajusta al esquema real después de la etapa 0 y muestra el SQL a Jean.

| Tabla | Campos principales | Notas |
| --- | --- | --- |
| `areas` | id, user\_id, nombre, color, orden, archivada\_at | Por usuario. Color = código visual del calendario. |
| `items` | id, user\_id, tipo (`tarea`, `evento`, `compra`), titulo, notas, area\_id?, fecha?, hora\_inicio?, duracion\_min?, objetivo\_id?, rutina\_id?, ocurrencia\_fecha?, vencimiento\_original?, completada\_at?, deleted\_at?, created\_at, updated\_at | Reemplaza a las columnas. Sin fecha = "Sin fecha". Fecha sin hora = "todo el día". |
| `objetivos` | id, user\_id, titulo, notas, area\_id?, fecha\_meta?, completado\_at? | Avance = items vinculados completados / total. |
| `rutinas` | id, user\_id, titulo, area\_id?, recurrencia (diaria; semanal + días; mensual + día), modo\_horario (`fija`, `flexible`, `sin_hora`), hora\_inicio?, duracion\_min?, rango\_inicio?, rango\_fin?, marcable, objetivo\_id?, pausada\_at? | Entidad propia y editable (R4). |
| `rutina_pasos` | id, rutina\_id, texto, orden | Checklist interna. |
| `item_pasos` | item\_id, paso\_id, completado\_at | Avance de la checklist en cada ocurrencia. |
| `reprogramaciones` | id, item\_id, fecha\_anterior, fecha\_nueva, estaba\_vencida, created\_at | Historial honesto de vencidas (decisión 8c). |
| `entradas` | id, user\_id, texto, origen (`texto`, `voz`), estado (`sin_ordenar`, `procesada`, `descartada`), item\_id?, regla?, created\_at, procesada\_at? | Historial del Home y Buzón. |

**Reglas del modelo:**

- **Ocurrencias de rutinas:** son filas de `items` con `rutina_id` + `ocurrencia_fecha`. Restricción única `(rutina_id, ocurrencia_fecha)`: elimina los duplicados al abrir en dos dispositivos. Solo se genera la ocurrencia de hoy; las de días sin abrir la app no se generan (decisión 7).
- **"Solo hoy"** = se edita la ocurrencia. **"Toda la rutina"** = se edita la rutina y las ocurrencias futuras ya generadas.
- **Eliminar** es borrado lógico (`deleted_at`) para permitir Deshacer y no romper el historial.
- **Completar** guarda `completada_at`; nunca borra.
- **XP:** la función actual de la base se adapta a `items` (incluye ocurrencias de rutinas). Sin rachas.
- **Seguridad por fila:** todas las tablas filtran por `user_id = auth.uid()`.

**Migración de datos actuales:**

- SHOPPING LIST → `items` tipo `compra`.
- MIS OBJETIVOS → `objetivos`, manteniendo los vínculos de tareas.
- Plantillas de rutina → `rutinas` con `modo_horario = sin_hora` (Jean ajusta horarios después).
- Copias de rutinas existentes → se vinculan por título cuando coincida; si no, quedan como tareas normales.
- Tareas con fecha → se mantienen.
- Tareas sin fecha en HOY y ESTA SEMANA → quedan sin fecha, tal como están (van a la sección "Sin fecha").

## 6. Comportamientos clave

Nada se procesa en silencio: toda entrada deja una tarjeta visible que se puede editar o deshacer.

**Campo de entrada del Home**

- Texto o voz. Voz en etapa 1 = dictado del teclado + botón de micrófono propio solo donde el navegador lo soporte (Chrome/Android). Transcripción en servidor llega con la IA.
- Enter o enviar guarda en `entradas`. Sin reglas (etapa 1), todo queda `sin_ordenar`.
- Con reglas (etapa 2): lo reconocido crea el ítem y muestra una tarjeta, por ejemplo "Compra: leche, pan, palta · Personal", con **Editar** y **Deshacer**. Lo no reconocido queda en el Buzón.
- Reglas iniciales: empieza con "comprar" → compra (separar ítems por coma); "hoy", "mañana", día de la semana, fecha → fecha; "a las 10", "10:30" → hora; nombre de un área → área.
- El Buzón (Sin ordenar) se puede ordenar en cualquier momento desde Tareas: asignar tipo, fecha, área, o descartar.

**Rutinas**

- Hora fija (turno 9–17): bloque en su hora. Mover o editar la ocurrencia pregunta "¿Solo hoy o toda la rutina?".
- Hora flexible (entreno 18–22): aparece en "todo el día" como "por planificar" hasta que se le asigna hora. Asignar o mover la hora aplica solo a hoy, sin preguntar.
- Sin hora (rutina de la mañana): solo se marca.
- Con checklist: se completa al marcar todos los pasos; muestra avance parcial (2/3).
- No marcable (turno): ocupa tiempo, no tiene check, no cuenta para cumplimiento ni XP.
- No cumplida: cuenta como no cumplida en Progreso; no aparece como vencida.

**Tareas**

- Completar (check o deslizar a la derecha) → se oculta con Deshacer de unos segundos.
- Eliminar (menú o deslizar a la izquierda) → borrado lógico con Deshacer, sin confirmación.
- Reprogramar → opciones rápidas: mañana, fin de semana, elegir fecha, quitar fecha. Si estaba vencida, se registra en `reprogramaciones`.
- Crear manual: formulario de R3 (solo título + Enter; opciones avanzadas plegadas), desde Tareas.

**Progreso (Perfil)**

- Avance de cada objetivo (tareas vinculadas completadas / total).
- Completadas vs. vencidas por semana, con vencidas tomadas de `reprogramaciones` y de tareas vencidas sin completar.
- Cumplimiento semanal de cada rutina marcable (ej. Entreno 4/5).
- XP y nivel.

## 7. Identidad visual

Y2K modernizado en negros, grises metálicos y morados; la personalidad va en los detalles y la legibilidad manda en lo funcional. Esta sección es una base para empezar: Jean termina de definir la paleta y la tipografía, y Code las aplica como variables (tokens) para poder cambiarlas en un solo lugar.

**Referencias**

- [SKOOT](https://skootskootskoot.com/es) (estética): streetwear oscuro, letras estilizadas con Ø, etiquetas cortas en mayúsculas, plata y cuero. Tomar el carácter, no copiar logos ni gráficos.
- Notion y NotebookLM (organización): jerarquía clara, mucho espacio, pocas cosas por pantalla.

**Paleta inicial (propuesta, a confirmar por Jean)**

| Rol | Color | Uso |
| --- | --- | --- |
| Fondo | `#0B0B0F` | Fondo de la app |
| Superficie | `#16161C` | Tarjetas, barra inferior |
| Superficie elevada | `#22222A` | Menús, hojas, modales |
| Metal (degradado) | `#8A8D96` → `#C9CCD3` | Bordes, íconos activos, detalles cromados |
| Texto principal | `#ECECF1` | Títulos y texto |
| Texto secundario | `#9A9AA6` | Metadatos, fechas |
| Acento morado | `#8B5CF6` | Botón enviar, selección, elementos activos |
| Morado claro | `#A78BFA` | Estados hover, chips seleccionados |

**Colores de área:** no pueden ser todos morados, o el calendario no distingue áreas. Ofrecer al crear un área una paleta de 8 colores apagados que se lean sobre negro (por ejemplo violeta, azul acero, cian frío, menta, ámbar, magenta, plata, coral). El morado de acento queda reservado para la interfaz.

**Tipografía y estilo**

- Una fuente con carácter Y2K solo para títulos grandes, el nombre de la app y números destacados (XP, nivel).
- Una sans-serif muy legible para todo lo demás (por ejemplo Inter o Space Grotesk).
- Mayúsculas solo en etiquetas cortas (nombres de sección, chips). Texto normal en minúsculas.
- Lo metálico va en detalles (bordes, íconos, estados activos), no en superficies grandes.
- Textos en lenguaje normal y directo: "Hoy", "Guardado", "Deshacer".
- Modo oscuro primero. Modo claro: pendiente.

## 8. Etapas y pasos

Siete etapas; cada una termina con una app usable a diario y Jean la prueba en su celular antes de seguir.

1. **Etapa 0 · Preparación (Jean + Code)**
   1. Jean corre las consultas de solo lectura de la sección 11 en el SQL Editor de Supabase y entrega el resultado a Code.
   2. Code guarda el esquema actual en el repo como migración inicial (tablas, políticas, funciones, triggers, restricciones).
   3. Jean cronometra el arranque en frío: pantalla bloqueada → abrir PWA → escribir "prueba" → guardar. Si pasa de 8–10 s, se agrega una tarea de optimización a la etapa 1.
   4. Respaldo (export) de los datos de ZenTask.
2. **Etapa 1 · Base nueva**
   1. Migración del modelo de datos completo (sección 5), con SQL revisado por Jean.
   2. Migración de datos desde columnas, rutinas y objetivos actuales.
   3. Tokens de diseño (paleta y tipografía de la sección 7) y componentes base: tarjeta de ítem, chip de área, barra inferior.
   4. Barra inferior de 5 pestañas y eliminación del tablero de columnas.
   5. Home mínimo: campo de entrada + historial; todo queda como `sin_ordenar`.
   6. Tareas en modo lista con sus 5 secciones, chips de área, lupa y formulario R3.
   7. Compras.
   8. Gestos (izquierda eliminar, derecha completar) y menú ⋯ definitivo.
   9. Perfil: avatar, XP, nivel y gestión de áreas (crear las 6 de Jean).
3. **Etapa 2 · Reglas simples**
   1. Motor de reglas local (sección 6), separado en su propio módulo para que la IA lo reemplace después.
   2. Tarjetas de resultado con Editar y Deshacer.
   3. Botón de micrófono donde el navegador lo soporte.
4. **Etapa 3 · Rutinas**
   1. Pestaña Rutinas: crear, editar, pausar.
   2. Horario fijo, flexible y sin hora; checklist interna; marcable o no.
   3. Generación idempotente de la ocurrencia de hoy.
   4. Franja "Lo próximo" en el Home.
5. **Etapa 4 · Calendario**
   1. Vistas día, semana y mes; franja "todo el día"; color por área y estilo por tipo.
   2. Editar tocando un bloque; diálogo "¿Solo hoy o toda la rutina?".
   3. Arrastrar para cambiar hora, primero en la vista día y después en semana.
6. **Etapa 5 · Progreso**
   1. Objetivos con avance por tareas vinculadas.
   2. Gráficos: completadas vs. vencidas por semana y cumplimiento de rutinas.
7. **Etapa 6 · IA**
   1. Decidir el costo mensual aceptable.
   2. Edge Function en Supabase con la clave del modelo (nunca en la app).
   3. Interpretación del campo del Home; las reglas quedan como respaldo.
   4. Transcripción de voz en el servidor.
   5. Envío de apuntes y temas de estudio a Notion.

## 9. Criterios de aceptación

Una etapa se da por terminada cuando Jean verifica en su celular todas las casillas de esa etapa.

**Etapa 0**

- [ ] El esquema actual completo está en el repo como migración.
- [ ] Hay respaldo de los datos.
- [ ] El arranque en frío está medido y anotado.

**Etapa 1**

- [ ] Con la app abierta, capturar algo en el Home toma menos de 5 segundos.
- [ ] Ninguna tarea, rutina u objetivo anterior se perdió en la migración.
- [ ] ZenMoney sigue funcionando igual.
- [ ] No queda ningún rastro del tablero de columnas.
- [ ] Cada sección de Tareas muestra lo correcto (una tarea de ayer sin completar aparece en Vencidas; una de dentro de 5 días, en Pronto).
- [ ] Completar y eliminar se pueden deshacer.
- [ ] Los chips de área filtran en Tareas y Compras.
- [ ] Las áreas se crean, renombran, recolorean y archivan desde Perfil.
- [ ] Crear una tarea con el formulario R3 sigue siendo solo título + Enter.

**Etapa 2**

- [ ] "comprar leche, pan, palta" crea 3 compras y muestra una tarjeta.
- [ ] "prueba de cálculo el jueves a las 10" crea un ítem con fecha y hora.
- [ ] Un texto que no se reconoce queda en Sin ordenar.
- [ ] Toda tarjeta de resultado se puede editar o deshacer.

**Etapa 3**

- [ ] Abrir la app en dos dispositivos no duplica rutinas.
- [ ] Editar una rutina cambia sus próximas ocurrencias.
- [ ] Una rutina no marcada ayer no aparece hoy como vencida.
- [ ] La checklist muestra avance parcial.

**Etapa 4**

- [ ] Un turno de hora fija se ve como bloque apagado en su horario.
- [ ] Un entreno flexible aparece como "por planificar" hasta asignarle hora.
- [ ] Mover un ítem de rutina fija pregunta "¿Solo hoy o toda la rutina?".
- [ ] Arrastrar un bloque en la vista día cambia su hora.

**Etapa 5**

- [ ] Una tarea reprogramada después de vencer cuenta como vencida en Progreso.
- [ ] El avance de un objetivo coincide con sus tareas vinculadas.

## 10. Pendientes y temas estacionados

Nada de esta lista bloquea la etapa 1.

**Preguntas abiertas**

- Tareas sin fecha que hoy están en HOY y ESTA SEMANA: resuelto, quedan sin fecha, tal como están hoy.
- Paleta y tipografía definitivas (sección 7).
- ¿Las compras llevan cantidad o precio? (ZenMoney podría usar el precio a futuro.)
- Modo claro.
- Qué hacer con el fondo personalizado del perfil.
- Botón "Mover todas a hoy" para vencidas: agregarlo si reprogramar de a una se vuelve pesado.

**Estacionados por decisión**

- Notificaciones a la hora de cada ítem (limitadas en la PWA de iPhone).
- Sincronización con Google Calendar.
- Proyectos dentro de las áreas (por ejemplo ZenTask dentro de Desarrollo).
- Avance de objetivos por métrica numérica o manual.
- Cuestionario inicial y soporte para otros usuarios.
- Integración con ZenMoney.

## 11. Instrucciones para Claude Code

Exporta este documento como Markdown, guárdalo en el repo como `docs/rediseno.md` y pega el mensaje inicial en Code.

**Mensaje inicial para Code**

```text
Vamos a rediseñar ZenTask. La especificación completa está en docs/rediseno.md: léela entera antes de hacer nada.

Reglas:
- Sigue la sección 2 (reglas de trabajo) en todo momento.
- Trabajamos por etapas (sección 8). No empieces una etapa sin que yo apruebe la anterior.
- Todo SQL me lo muestras antes de ejecutarlo. La base es compartida con ZenMoney: no toques sus tablas.
- Entrégame archivos completos y comandos exactos para copiar y pegar.
- Si algo no está decidido en el documento, pregúntame.

Empezamos con la Etapa 0. Te voy a pasar el resultado de las consultas del esquema actual. Con eso:
1. Crea la migración inicial que refleje el esquema actual tal cual.
2. Revisa el modelo propuesto de la sección 5 contra el esquema real y dime qué ajustarías antes de escribir la migración de la Etapa 1.
3. Ten en cuenta que las tareas sin fecha de HOY y ESTA SEMANA quedan sin fecha al migrar (ya decidido).
```

**Consultas de solo lectura para la Etapa 0** (correr en Supabase → SQL Editor, una por una, y copiar cada resultado)

```sql
-- 1. Tablas y columnas
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

```sql
-- 2. Restricciones (llaves, únicos, checks)
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where connamespace = 'public'::regnamespace
order by 1, 2;
```

```sql
-- 3. Seguridad por fila (RLS)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
-- 4. Funciones (incluye la de XP)
select p.proname, pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

```sql
-- 5. Triggers
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

**Al pasar a cada etapa siguiente**, pega en Code: "Etapa N aprobada. Empecemos la Etapa N+1 según docs/rediseno.md, sección 8. Muéstrame primero el plan de pasos y el SQL si lo hay."
