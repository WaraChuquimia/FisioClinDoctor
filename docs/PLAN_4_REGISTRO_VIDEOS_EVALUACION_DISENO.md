# Plan 4 — Registrar pacientes, videos de 100 MB, evaluación inicial/final y diseño único

> **Cómo usarlo:** abre el proyecto `FisioClinDoctor` en VS Code y pídelo por partes,
> una a la vez:
> *"Lee `docs/PLAN_4_REGISTRO_VIDEOS_EVALUACION_DISENO.md` y ejecuta la PARTE A completa."*

| Parte | Qué resuelve | Dónde se toca |
|---|---|---|
| **A** | El error rojo al registrar un paciente (RLS) | Supabase + `api.js` + `ModalNuevoPaciente.jsx` |
| **B** | Videos: el tope sube de 50 MB a 100 MB | Supabase (bucket) + `api.js` + `CatalogoEjercicios.jsx` |
| **C** | La evaluación queda solo en **inicial** y **final** | Supabase + `ModalEvaluacion.jsx` y quien la use |
| **D** | Todas las pantallas con el mismo diseño que Pacientes | `src/components/ui/` + cada módulo |

**Orden recomendado:** A → C → B → D.
A desbloquea el sistema (sin pacientes no hay nada que probar), C es corto,
B depende de una decisión de plan de Supabase, y D es la más larga.

---

# PARTE A — "No se pudo registrar al paciente: new row violates row-level security policy"

## Qué dice ese error, en castellano

La base tiene una regla (*política RLS*) que decide quién puede insertar una fila
en `pacientes`. Es esta, en `sql/1_BASE_DE_DATOS.sql:1864`:

```sql
create policy p_pacientes_alta on public.pacientes for insert
  with check (app.id_medico() is not null
              and id_medico_registrador = app.id_medico());
```

Se lee así: **«para dar de alta a un paciente tienes que ser un profesional con
ficha, y tienes que quedar tú como registrador»**. Es la regla que impide que un
médico registre pacientes a nombre de otro.

El error aparece cuando la fila que manda el navegador **no cumple** esa
condición. Solo hay dos formas de que eso pase:

| Causa | Qué está mal |
|---|---|
| **1. El usuario no tiene ficha de médico** | `app.id_medico()` devuelve nulo: hay fila en `usuarios` pero no en `medicos`, o la de `medicos` apunta a otro `id_usuario` |
| **2. El registrador que llega no es él** | `src/lib/api.js:430` manda `id_medico_registrador` desde el navegador. Si llega nulo y el trigger `trg_completar_registrador` **no está desplegado** en tu base, la fila entra con nulo y la política la rechaza |

La causa 2 es la más probable en tu caso: el archivo `sql/1_BASE_DE_DATOS.sql`
se editó el 16/09 y trae el trigger (`:922`), pero **si no lo volviste a correr
en Supabase, tu base todavía tiene la versión vieja**.

## A.1 — Diagnóstico (2 minutos, antes de tocar nada)

Supabase → **SQL Editor** → pega y ejecuta:

```sql
-- 1) ¿Qué política de alta está DESPLEGADA de verdad?
select polname,
       pg_get_expr(polwithcheck, polrelid) as with_check
  from pg_policy
 where polrelid = 'public.pacientes'::regclass;

-- 2) ¿Existe el trigger que completa el registrador?
select tgname
  from pg_trigger
 where tgrelid = 'public.pacientes'::regclass and not tgisinternal;

-- 3) ¿Cada usuario del panel tiene ficha de profesional y cuenta vinculada?
select u.id_usuario, u.nombre_usuario, u.rol, u.activo,
       u.auth_user_id, m.id_medico, m.tipo_profesional
  from public.usuarios u
  left join public.medicos m on m.id_usuario = u.id_usuario
 order by u.id_usuario;
```

**Cómo leer el resultado:**

| Lo que ves | Qué significa | Qué aplicar |
|---|---|---|
| En (2) **no aparece** `trg_completar_registrador` | Tu base está desactualizada | A.2 |
| En (3) el usuario con el que entras tiene `id_medico` **vacío** | No tiene ficha de médico | A.3 |
| En (3) tiene `auth_user_id` **vacío** | La cuenta de Supabase Auth no está enlazada con `usuarios` | A.3 |
| Todo correcto y sigue fallando | Es la causa 2 por el nulo del navegador | A.2 + A.4 |

> Guarda una captura del resultado: es la evidencia de por qué fallaba, y sirve
> para la defensa.

## A.2 — La corrección en la base

Supabase → **SQL Editor** → pegar entero y ejecutar. Se puede repetir sin miedo:
todo es `create or replace` / `drop if exists`.

```sql
-- ============================================================
--  ARREGLO A — alta de pacientes
-- ============================================================

-- 1. Quién es el registrador lo decide la BASE, no el navegador.
create or replace function public.fn_completar_registrador()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_yo integer := app.id_medico();
begin
  if new.id_medico_tratante is null then
    raise exception 'Falta elegir el médico tratante del paciente.';
  end if;

  if new.id_medico_registrador is null then
    new.id_medico_registrador := coalesce(v_yo, new.id_medico_tratante);
  end if;

  if new.id_fisioterapeuta_asignado is not null
     and not exists (select 1 from public.medicos
                      where id_medico = new.id_fisioterapeuta_asignado
                        and tipo_profesional::text = 'fisioterapeuta') then
    raise exception 'El fisioterapeuta asignado no es un fisioterapeuta.';
  end if;

  return new;
end $fn$;

drop trigger if exists trg_completar_registrador on public.pacientes;
create trigger trg_completar_registrador
  before insert or update of id_medico_tratante, id_fisioterapeuta_asignado
  on public.pacientes
  for each row execute function public.fn_completar_registrador();

alter table public.pacientes alter column id_medico_registrador drop not null;

-- 2. La política, tolerante al nulo (el trigger ya lo completó antes del control).
--    Sigue prohibiendo registrar a nombre de OTRO médico: eso no se afloja.
drop policy if exists p_pacientes_alta on public.pacientes;
create policy p_pacientes_alta on public.pacientes for insert
  with check (
    app.id_medico() is not null
    and coalesce(id_medico_registrador, app.id_medico()) = app.id_medico()
  );
```

**Por qué funciona:** en PostgreSQL el trigger `before insert` corre **antes** de
que se controle la política. Cuando llega el control, `id_medico_registrador` ya
tiene el valor correcto. El `coalesce` es el cinturón de seguridad por si el
trigger se vuelve a perder en un redespliegue.

## A.3 — Si el usuario no tiene ficha de profesional

Un usuario sin fila en `medicos` **no puede registrar pacientes** y nunca podrá,
por diseño. Hay que crearle la ficha. Lo correcto es desde el panel
(*Superusuario → Gestión de usuarios → Nuevo profesional*). A mano, si hace falta:

```sql
insert into public.medicos
  (id_usuario, nombre_completo, tipo_profesional, especialidad,
   cedula_profesional, unidad)
select u.id_usuario,
       'Dr. Martin Suarez',
       'medico_fisiatra',
       'Medicina Física y Rehabilitación',
       'CM-0001',                         -- única, cámbiala por la real
       'Unidad de Medicina Física y Rehabilitación - COSSMIL'
  from public.usuarios u
 where u.nombre_usuario = 'dr.martin'      -- el usuario que falla
   and not exists (select 1 from public.medicos m where m.id_usuario = u.id_usuario);
```

## A.4 — Tareas para Claude (código)

### A.4.1 — Que el navegador deje de mandar el registrador

En `src/lib/api.js`, función `crearPaciente` (línea 410):

1. **Quitar** la línea `id_medico_registrador: idMedico` (`:430`). Ese dato lo
   pone la base. Mientras lo mande el navegador, cualquier sesión a medio cargar
   vuelve a romper el alta.
2. Antes de armar la fila, si **no es superusuario** y `sesion?.medico?.id_medico`
   viene vacío, cortar con un mensaje claro:
   *"Tu usuario no tiene ficha de profesional. Pídele al administrador que la
   cree antes de registrar pacientes."*

### A.4.2 — Que el error se entienda

En el ayudante `ok()` de `src/lib/api.js:38`, traducir los errores crudos de
Postgres antes de mostrarlos:

| Lo que llega | Lo que debe leer el médico |
|---|---|
| `violates row-level security policy` | "Tu usuario no tiene permiso para esta acción. Revisa con el administrador que tengas ficha de profesional activa." |
| `duplicate key ... numero_carnet` | "Ya existe un paciente con ese carné." |
| `violates foreign key` | "El médico o fisioterapeuta elegido ya no existe." |

Regla del proyecto: **el mensaje técnico no se pierde**, se deja en
`console.error` para poder depurar; en pantalla va el humano.

### A.4.3 — Avisar antes, no después de llenar 12 campos

En `src/components/ModalNuevoPaciente.jsx`: si el usuario no tiene ficha de
médico y no es superusuario, mostrar el aviso **al abrir** la ventana y
deshabilitar el botón «Registrar». Hoy se llena todo el formulario para chocar
al final.

## A.5 — Cómo verificar que quedó

1. Entrar como **Dr. Martin** → Pacientes → Registrar paciente → guardar.
   Debe aparecer el toast verde con el código `PAC-000X`.
2. En Supabase: `select codigo_anonimo, id_medico_tratante, id_medico_registrador from pacientes order by id_paciente desc limit 3;`
   El registrador tiene que ser el `id_medico` de Martin.
3. Entrar como **superusuario** y registrar otro eligiendo médico tratante:
   también debe entrar.
4. Que el paciente nuevo **aparezca en la lista** al recargar (eso prueba que la
   política de lectura también lo alcanza).

---

# PARTE B — Los videos: de 50 MB a 100 MB

## Lo que pediste y lo que hay

Quieres aceptar videos **de más de 50 MB y menos de 100 MB**. La base ya está
lista para eso: la columna `video_tamano_bytes` acepta hasta 104.857.600 bytes
(`sql/1_BASE_DE_DATOS.sql:315`). Lo que frena son **tres topes de 50 MB**, en
tres lugares distintos, y **un cuarto que no está en el código**:

| Dónde | Hoy | Debe quedar |
|---|---|---|
| Bucket `ejercicios-videos` (`sql/1_BASE_DE_DATOS.sql:1147`) | 52428800 | 104857600 |
| `src/lib/api.js:781` — `const MAX` | `50 * 1024 * 1024` | `100 * 1024 * 1024` |
| `src/components/CatalogoEjercicios.jsx:19` — `MAX_VIDEO_MB` | 50 | 100 |
| **Supabase → Storage → Settings → Upload file size limit** | 50 MB | 100 MB |

## La advertencia que tienes que leer antes de tocar nada

El cuarto tope es del **proyecto**, no del código, y **en el plan gratuito no se
puede subir de 50 MB**. Si pones el bucket en 100 MB pero el proyecto sigue en
Free, el archivo de 70 MB se va a rechazar igual, ahora con un error más raro.

Además está el espacio total: el plan gratuito da **1 GB**. Con videos de 100 MB
te entran **diez**. Tienes veinte.

| Camino | Qué consigues | Qué cuesta |
|---|---|---|
| **Comprimir a 720p** (recomendado, ver `PLAN_3` Parte A) | Los 20 videos pesan 120–250 MB en total y ninguno pasa de 15 MB | Un rato de `ffmpeg` |
| **Plan Pro** | 100 GB de espacio y hasta 50 GB por archivo | 25 USD/mes |
| **Solo subir el límite del código** | Nada, si el proyecto sigue en Free | — |

**Mi recomendación:** haz las dos cosas. Sube el tope a 100 MB (es lo que
pediste y deja el sistema preparado), **y** comprime los videos igual. Un video
de 100 MB en un consultorio con internet de COSSMIL tarda minutos en abrir;
el mismo a 12 MB abre al instante. El tope alto es para no quedarte trabada,
no para usarlo todos los días.

## B.1 — SQL

```sql
update storage.buckets
   set file_size_limit = 104857600            -- 100 MB
 where id in ('ejercicios-videos', 'videos-sesiones');

select id, file_size_limit from storage.buckets;
```

Y en `sql/1_BASE_DE_DATOS.sql:1147` dejar el valor nuevo con su comentario, para
que el archivo maestro y la base no se contradigan.

Después, en el panel de Supabase: **Storage → Settings → Upload file size limit
→ 100 MB**. Si el campo no te deja pasar de 50, estás en el plan gratuito: ahí
se termina el asunto hasta que pases a Pro.

## B.2 — Tareas para Claude (código)

1. `src/lib/api.js:781` — `MAX = 100 * 1024 * 1024` y el mensaje:
   *"El video pesa X MB y el máximo es 100 MB. Comprímelo a 720p antes de subirlo."*
2. `src/components/CatalogoEjercicios.jsx:19` — `MAX_VIDEO_MB = 100`.
   Subir `AVISO_GRANDE_MB` de 20 a **50**: entre 50 y 100 MB el video se acepta
   pero se avisa *"pesa 78 MB: va a tardar en subir y en abrirse; conviene
   comprimirlo"*.
3. `CatalogoEjercicios.jsx:734` — el texto de ayuda pasa a
   *"MP4, MOV o WEBM · hasta 100 MB (ideal: menos de 20 MB)"*.
4. Que el aviso salga **al elegir el archivo**, no al terminar de subir (eso ya
   está en `:185`; solo hay que mantenerlo con el número nuevo).
5. Un solo número, en un solo lugar: exportar `MAX_VIDEO_MB` desde `src/theme.js`
   o desde un `src/lib/limites.js` e importarlo en los dos archivos. Hoy el 50
   está escrito dos veces y por eso se desincroniza.

## B.3 — Verificar

- Un video de **40 MB** → sube sin avisos.
- Un video de **70 MB** → sube, con el aviso de "conviene comprimirlo".
- Un video de **120 MB** → se rechaza al elegirlo, con el mensaje de comprimir.

---

# PARTE C — La evaluación: solo **inicial** y **final**

## Qué hay hoy

La base acepta cuatro momentos (`sql/1_BASE_DE_DATOS.sql:2532`):
`inicial`, `intermedia`, `final`, `seguimiento`. El formulario ofrece los cuatro
(`src/components/ModalEvaluacion.jsx:5-8`).

Pero **todo lo demás del sistema ya trabaja solo con dos**: la vista
`vista_evaluacion_pre_post` cruza inicial contra final (`:2624`), el índice único
solo cuida esos dos (`:2584`), el alta del paciente exige la final
(`ModalAlta.jsx:71`) y la pantalla del goniómetro pregunta por `tieneInicial` y
`tieneFinal` (`EvaluacionGoniometro.jsx:13-14`).

O sea: los otros dos momentos **no los usa nadie** y sí ensucian el resultado —
son el tipo de dato que en una defensa te obliga a explicar por qué está ahí.

## C.1 — SQL

```sql
-- 1) ¿Hay evaluaciones con los momentos que se van a eliminar?
select momento, count(*)
  from public.evaluaciones_goniometro
 group by momento;
```

**Si el resultado da 0 en `intermedia` y `seguimiento`**, aplica directo:

```sql
alter table public.evaluaciones_goniometro
  drop constraint if exists evaluaciones_goniometro_momento_check;

alter table public.evaluaciones_goniometro
  add constraint evaluaciones_goniometro_momento_check
  check (momento in ('inicial', 'final'));
```

**Si hay filas**, decide una por una antes de tocar la restricción: no se pueden
convertir todas en `final` porque el índice único `ux_evaluacion_momento` solo
admite **una** final por paciente, plan, articulación y lado. Lo sano es borrar
las de prueba y conservar las reales como inicial o final según la fecha.

Y en `sql/1_BASE_DE_DATOS.sql:2532` dejar la lista corta, más
`fn_historial_evaluacion` (`:2849`), quitando las ramas `intermedia` y
`seguimiento` del `case` de títulos.

## C.2 — Tareas para Claude (código)

1. `src/components/ModalEvaluacion.jsx:5-8` — la lista `MOMENTOS` queda en dos:
   `inicial` y `final`. Actualizar el comentario de `:38`.
2. Si solo hay dos opciones, **el desplegable sobra**: mejor dos botones grandes
   o un selector de dos posiciones, con el momento ya decidido por dónde entró el
   médico (`App.jsx:215` ya pasa `momento`).
3. **Regla dura, no aviso:** no se puede guardar una evaluación `final` si no
   existe la `inicial` de esa articulación y lado. Hoy solo se advierte
   (`ModalEvaluacion.jsx:209`); con dos momentos, la advertencia pasa a ser
   bloqueo — sin inicial, la final no significa nada.
4. Revisar que no quede el texto "intermedia" ni "seguimiento" en
   `Reportes.jsx`, `EvaluacionGoniometro.jsx` ni `mappers.js`.
5. En la ficha del paciente, pestaña Evaluaciones: dejar la lectura de un
   vistazo — **Inicial 12/08 · Final pendiente · Ganancia: —**.

## C.3 — Verificar

- Registrar una inicial de rodilla derecha → se guarda.
- Intentar una segunda inicial de rodilla derecha → la rechaza (índice único).
- Intentar una final sin inicial → la bloquea con el motivo.
- Registrar la final → la historia clínica escribe sola el párrafo de
  "RESULTADO DEL TRATAMIENTO" con los grados ganados (`sql:2876`).

---

# PARTE D — Estandarizar todas las pantallas

## El molde ya existe: es la pantalla de Pacientes

No hay que inventar diseño. La segunda captura **es el estándar**, y tiene cuatro
bloques siempre en el mismo orden (`ModuloPacientes.jsx:1735-1950`):

```
┌──────────────────────────────────────────────────────────────┐
│ [icono] Pacientes                        [Registrar paciente]│  ENCABEZADO
│         Registro de pacientes, control clínico y seguimiento │
├──────────────────────────────────────────────────────────────┤
│ [Buscar...]      [Estado v]  [Articulación v]     [Limpiar]  │  FILTROS
├──────────────────────────────────────────────────────────────┤
│ CÓDIGO  PACIENTE  DIAGNÓSTICO  ÚLTIMA SESIÓN  ESTADO ACCIONES│  TABLA
├──────────────────────────────────────────────────────────────┤
│ Mostrando 1-4 de 4          < 1 >           Mostrar 6 v      │  PIE
└──────────────────────────────────────────────────────────────┘
```

## Cómo está el resto hoy (medido, archivo por archivo)

| Módulo | Buscador | Paginación | Limpiar | Vacío explicado | Usa `theme.js` |
|---|---|---|---|---|---|
| **Pacientes** (molde) | sí | sí | sí | sí | no, copia local |
| Catálogo de Ejercicios | sí | no | no | no | no |
| Agenda de Controles | no | no | no | sí | no |
| Sesiones y Repeticiones | no | no | no | sí | no |
| Evolución Clínica | no | no | no | no | no |
| Evaluaciones (goniómetro) | no | no | no | sí | no |
| Mensajes y Avisos | no | no | no | sí | no |
| Reportes | no | no | no | sí | no |
| Usuarios y permisos | sí | no | no | no | no |
| Solicitudes de acceso | no | no | no | sí | no |
| Superadmin / Auditoría | sí | no | no | sí | no |
| Mi Perfil | — | — | — | no | no |

**Ninguna pantalla importa `theme.js`**, y el mismo objeto de colores
`C = { navy: '#123C68', ... }` está copiado a mano en cinco archivos:
`DashboardInicio`, `Header`, `Login`, `ModuloPacientes` y `SuperadminViews`.
Si mañana cambia el verde institucional, hay que tocar los cinco y no olvidarse
de ninguno.

## D.0 — Decisión previa (2 minutos, la tomas tú)

En la captura, el estado del tratamiento (`ALTA TEMPORAL`, `DE ALTA`,
`EN TRATAMIENTO`) va **pegado al nombre**, y la columna ESTADO tiene el
interruptor Activo, que es **otra cosa**. Eso ya estaba señalado en
`PLAN_3` Parte B y sigue pendiente.

> **Hay que resolverlo ANTES de copiar el molde a las demás pantallas**, porque
> si no se copia el problema nueve veces.

Queda así:

| CÓDIGO | PACIENTE | DIAGNÓSTICO | **TRATAMIENTO** | ÚLTIMA SESIÓN | **FICHA** | ACCIONES |
|---|---|---|---|---|---|---|
| PAC-0004 | AS · Ana Sofia Vargas<br>CI: 7000004 | Artrosis femorotibial… | Alta temporal | 2026-09-13 | Activa | Ver expediente |

Y el filtro «Estado» pasa a filtrar por **tratamiento** (que es lo que busca el
médico), con el de activo/inactivo como filtro aparte.

## D.1 — Sacar el molde a componentes (primero esto, siempre)

Crear `src/components/ui/` con:

| Componente | Qué hace | De dónde sale |
|---|---|---|
| `EncabezadoModulo.jsx` | Icono, título, subtítulo, botón principal | `ModuloPacientes.jsx:1735-1759` |
| `BarraFiltros.jsx` | Buscador + filtros + Limpiar | `ModuloPacientes.jsx:1761-1800` |
| `FilterDropdown.jsx` | El desplegable de filtro | `ModuloPacientes.jsx:140` |
| `Tabla.jsx` | Cabecera, filas, "cargando", "sin resultados" | `ModuloPacientes.jsx:1803-1900` |
| `Paginacion.jsx` | "Mostrando X-Y de Z", páginas, "por página" | `ModuloPacientes.jsx:1925-1950` |
| `Badge.jsx` | Las etiquetas de color, **una sola definición** | `theme.js` (`BADGE`, `STATUS`) |
| `EstadoVacio.jsx` | Icono + qué pasó + qué hacer | nuevo |
| `Avatar.jsx`, `ModalBase.jsx` | ya existen: moverlos a `ui/` | — |

**Los colores salen de `src/theme.js`, que ya tiene todo lo necesario**
(`C`, `CARD`, `TH`, `TD`, `BTN`, `INPUT`, `BADGE`, `STATUS`, `AVATARS`).
En el mismo paso: borrar los cinco objetos `C` locales y reemplazarlos por
`import { C, CARD, TH, TD } from '../theme'`.

> Hazlo en dos pasos: primero crear `ui/` y migrar **solo Pacientes**
> (si algo se rompe, se ve al instante en la pantalla que mejor conoces);
> después el resto.

## D.2 — Aplicarlo módulo por módulo

En este orden, **uno por vez**, verificando en el navegador antes de seguir:

1. **Catálogo de Ejercicios** — falta filtro por articulación y paginación
2. **Sesiones y Repeticiones** — sin paginación se vuelve inusable
3. **Agenda de Controles** — encabezado y filtros del molde
4. **Evaluaciones** — encabezado, filtro por articulación y momento
5. **Evolución Clínica** — encabezado estándar
6. **Mensajes y Avisos** — buscador
7. **Usuarios y permisos** — tabla con el estilo del molde
8. **Solicitudes de acceso** — el patrón completo
9. **Auditoría** — paginación obligatoria: es la que más filas va a tener
10. **Reportes** y **Mi Perfil** — encabezado estándar

## D.3 — Las reglas que no se negocian

1. **Toda lista lleva paginación**, aunque hoy tenga 4 filas.
2. **Toda lista lleva buscador.**
3. **Ninguna pantalla vacía se queda en blanco**: dice qué falta y qué hacer
   ("Todavía no hay ejercicios. Crea el primero con el botón de arriba").
4. **Un estado, un color, en todo el sistema.** Si "en tratamiento" es verde en
   Pacientes, es verde en Reportes y en el Alta. Se define una vez en `theme.js`.
5. **Toda acción que borra pregunta antes.**
6. **Todo error se ve.** Nada de fallar en silencio — es el problema que más
   veces apareció en este proyecto (y la Parte A es justamente eso).
7. **Un número mágico, un solo lugar** (el tope de los videos, el tamaño de
   página): se exporta, no se copia.

## D.4 — Que funcione en pantalla chica

El panel se usa en consultorio, a veces en una laptop de 13". Cada tabla va
dentro de `overflow-x-auto` con `min-w-[...]`, como ya hace Pacientes
(`ModuloPacientes.jsx:1804-1810`). La página nunca se desplaza a lo ancho:
la tabla sí.

## D.5 — Verificar

Recorre los diez módulos con esta lista en la mano. En todos: encabezado igual,
buscador, filtros con «Limpiar», tabla con la misma cabecera, pie con
paginación, y la pantalla vacía explicada. Si una pantalla se ve distinta de
Pacientes, está mal.

---

# Resumen para la defensa

| Parte | Antes | Después |
|---|---|---|
| **A** | El alta de pacientes fallaba con un error técnico en inglés | La base decide quién registra; el error se explica en castellano |
| **B** | 50 MB por video | 100 MB, con aviso desde los 50 y recomendación de comprimir |
| **C** | Cuatro momentos de evaluación, dos sin usar | Dos: inicial y final, que es lo que mide la tesis |
| **D** | Cada pantalla con su propio diseño y su paleta copiada | Un molde, ocho componentes y una sola fuente de color |
