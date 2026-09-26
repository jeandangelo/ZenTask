# CLAUDE.md — ZenTask

## Qué es
App de Jean para gestionar la **toma de decisiones y el cumplimiento de
objetivos a partir de rutinas**. Es la capa de **Ejecutar** del Segundo
Cerebro (sistema personal de productividad) y, cuando se construya, también
la de **Capturar** (el Buzón). La visión completa se va definiendo por
partes: los diseños llegan como documentos desde chats de diseño y
arquitectura aparte. Ante ambigüedad, preguntar antes de asumir.

## Modelo conceptual (terminología de la UI)
- **Columnas / listas** (`columns`) = tablero horizontal paginado. Una
  columna cuyo título contiene SHOP o COMPRA es la **SHOPPING LIST**: se
  crea sola y no se puede borrar.
- **Ítems** (`items`) = tareas (`type='task'`) u **objetivos**
  (`type='goal'`). Una tarea puede vincularse a un objetivo
  (`linked_goal_id`).
- **Rutinas** = ítems con `is_template=true` y `recurrence`
  (`daily` / `weekly` / `monthly`, día en `recurrence_day`). Cada día que
  toca se genera una tarea normal a partir de la plantilla
  (`last_generated` evita duplicar en el mismo día).
- Listas virtuales (no existen en la base): **PROGRAMADAS** (tareas
  pendientes con fecha futura) y **MIS OBJETIVOS**.
- **XP y niveles** (`profiles.xp_points`, `profiles.level`): los calcula la
  función `toggle_task_status` en Supabase al tachar o destachar una tarea.
- **Eficiencia** (Perfil): solo cuentan las tareas exigibles. No cuentan
  objetivos, compras ni tareas programadas a futuro.

## Principios del Segundo Cerebro (no se negocian)
1. **Sobrevivir a una semana mala**: nada de rachas que se pierden;
   retomar cuesta cero. Los niveles solo suben, nunca castigan.
2. Registrar algo toma **menos de 10 segundos**; capturar, **menos de 5**.
3. Preferir mejorar lo que ya existe antes que programar algo nuevo
   (construir el sistema no debe volverse la procrastinación).

## Buzón de captura (diseño en curso, NO implementar todavía)
Decidido a nivel conceptual: el Buzón vive en ZenTask como una columna
propia con un input sin campos obligatorios (texto crudo → enter → listo).
Se vacía cada noche y cada ítem va a un solo destino: tarea de ZenTask,
lista de deseos, Notion, chat de arquitectura o se borra. El diseño
funcional se está resolviendo en un chat aparte y llegará como documento.
**No construirlo antes de recibir ese documento.**

## Arquitectura
- **Frontend**: Expo SDK 54 / React Native 0.81 / React 19, con soporte
  web. `src/services/api.ts` es la **única** capa que habla con Supabase;
  las pantallas no hacen queries directas.
- **Lógica de dominio pura** (sin red ni UI) en `src/domain/`: reglas de
  rutinas, fechas y listas. La comparten el Dashboard, el Calendario y la
  capa de datos.
- **Componentes** por pantalla en `src/components/<pantalla>/`. El
  Dashboard ya delega tarjeta, recompensas y modales chicos; el formulario
  de tarea sigue en la pantalla hasta que se defina el Buzón.
- **Backend**: Supabase. Es la MISMA instancia que ZenMoney (sus tablas
  llevan el prefijo `fin_`). RLS está activo: un cliente anónimo no ve
  filas. Mostrar todo SQL a Jean ANTES de ejecutarlo.
- **Fechas**: toda fecha "del día" se calcula en hora LOCAL con date-fns
  (`format(d, 'yyyy-MM-dd')`), nunca con `toISOString()`, que da el día
  UTC y en Chile se adelanta un día pasadas las ~20:00.
- **Despliegue**: PWA en GitHub Pages (https://jeandangelo.github.io/ZenTask/)
  vía `scripts/deploy-web.ps1`. `experiments.baseUrl` es `/ZenTask`.
- `C:\Proyectos\ZenTask-backend` es un esqueleto sin uso: la app no tiene
  servidor propio.

## Comandos
```powershell
npm run web        # dev server web
npm run android    # dev en celular vía Expo Go
npm run typecheck  # tsc --noEmit — correr antes de cada commit
powershell -ExecutionPolicy Bypass -File scripts\deploy-web.ps1  # publicar PWA
```

## Estilo (reglas del ecosistema Zen)
Comentarios y UI en español. Commits chicos y descriptivos. Cambios
incrementales, no reescrituras. Explicar lo que se hace: Jean está
aprendiendo de su propio sistema. No agregar dependencias sin justificarlas.
Confirmaciones y avisos siempre por `src/services/dialogs.ts` (funciona en
web y en celular; `Alert.alert` solo no funciona en la PWA).
