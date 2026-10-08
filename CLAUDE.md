# CLAUDE.md — ZenTask

## Qué es
App de Jean para gestionar la **toma de decisiones y el cumplimiento de
objetivos a partir de rutinas**. Es la capa de **Ejecutar** del Segundo
Cerebro (sistema personal de productividad) y, cuando se construya, también
la de **Capturar** (el Buzón). Los diseños llegan como documentos desde
chats de diseño y arquitectura aparte. Ante ambigüedad, preguntar antes
de asumir.

## Modelo conceptual ACTUAL (antes del rediseño; la etapa 1 lo reemplaza)
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
4. Presupuesto $0 hasta la etapa de IA, donde se revisa ese límite.

## Rediseño en curso — docs/rediseno.md manda
La especificación completa del rediseño está en **docs/rediseno.md**:
leerla entera antes de tocar código del rediseño. ZenTask deja el tablero
de columnas y pasa a: entrada única en el Home (Buzón, luego reglas, al
final IA), barra inferior de 5 pestañas, tres ejes (tipo · cuándo · área),
rutinas como entidad propia y calendario por horas.

**Etapa actual: 1 — SQL en revisión de Jean** (etapa 0 cerrada el 8 oct;
el arranque en frío quedó postergado por decisión de Jean). Por etapas
(sección 8): no se empieza una sin que Jean apruebe la anterior
probándola en su celular.

Reglas de trabajo del rediseño (sección 2 del documento):
- Todo SQL se muestra a Jean antes de ejecutarse; nada sin su aprobación.
- La base es compartida con ZenMoney: ninguna migración toca, renombra ni
  borra tablas `fin_`.
- Sin pérdida de datos: se migra, no se borra; respaldo antes de cada
  migración.
- Cada cambio de base queda como archivo en `supabase/migrations/`.
- Entregar archivos completos y comandos exactos para copiar y pegar.
- Móvil primero (PWA), verificado en la web.
- Dependencias nuevas solo con justificación: por qué, peso y alternativa.
- Un commit por paso.
- Si algo no está decidido en el documento, preguntar a Jean.

## Arquitectura
- **Frontend**: Expo SDK 54 / React Native 0.81 / React 19, con soporte
  web. `src/services/api.ts` es la **única** capa que habla con Supabase;
  las pantallas no hacen queries directas.
- **Lógica de dominio pura** (sin red ni UI) en `src/domain/`: reglas de
  rutinas, fechas y listas. La comparten el Dashboard, el Calendario y la
  capa de datos.
- **Componentes** por pantalla en `src/components/<pantalla>/`. El
  Dashboard ya delega tarjeta, recompensas y modales chicos (el tablero
  completo desaparece en la etapa 1 del rediseño).
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
