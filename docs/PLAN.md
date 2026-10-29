# Plan: conectar FisioClin Doctor con Supabase

> **Cómo usar este archivo:** ábrelo en VS Code con Claude y dile:
> *"Lee `docs/PLAN.md` y ejecuta la FASE 1 completa."*
> **Una fase a la vez.** No le pidas todo de golpe.

## Las 11 fases, de un vistazo

| | Fase | Quién |
|---|---|---|
| 0 | Correr los 2 SQL y crear las contraseñas | la persona |
| 1 | Conectar el proyecto con Supabase | Claude |
| 2 | Google | la persona |
| 3 | Elegir el médico al registrar un paciente | Claude |
| 4 | Subir videos desde la computadora | Claude |
| 5 | Los 4 botones que no hacen nada | Claude |
| 6 | El login completo: 4 ventanas flotantes | Claude |
| 7 | Limpieza de módulos | Claude |
| 8 | Ventana flotante de evaluación con goniómetro | Claude |
| 9 | Los 6 reportes | Claude |
| 10 | El alta del paciente | Claude |

Las fases 1 a 7 dejan el sistema **funcionando**.
Las fases 8 a 10 son las que sostienen **la tesis**.

---

## Los 3 archivos

| Archivo | Qué es |
|---|---|
| `sql/1_BASE_DE_DATOS.sql` | **Crea la base entera desde cero**: 28 tablas, 15 vistas, login, contraseñas, goniómetro, altas, reportes y seguridad |
| `sql/2_DATOS.sql` | Los datos de prueba (mínimo 5 de cada cosa) |
| `docs/PLAN.md` | Este archivo |

*(`sql/EXTRA_borrar_datos.sql` es el botón de emergencia para vaciar los datos de prueba.)*

## Los 4 archivos de código que NO se pegan en Supabase

Estos son JavaScript: viven dentro del proyecto, no en la base de datos. Si
alguien copia solo los 3 archivos de arriba a otra computadora, **el sistema
no funciona**, porque falta esto:

| Archivo | Qué hace |
|---|---|
| `src/lib/supabase.js` | El cable. Lee el `.env` y abre la conexión con Supabase |
| `src/lib/auth.supabase.js` | El portero. Login con usuario+contraseña, Google, recuperar contraseña |
| `src/lib/api.supabase.js` | El mesero. Las ~45 funciones que piden y guardan datos |
| `.env.example` | La plantilla de las llaves (se copia a `.env` y se rellena) |

Los tres primeros todavía se llaman `.supabase.js` porque el panel sigue en
modo demo. En la **FASE 1** se renombran y ahí recién entra en funcionamiento.

## Estado del proyecto

| Pieza | Estado |
|---|---|
| Base de datos (los 2 SQL) | ✅ Escrita |
| `src/lib/supabase.js` (conexión) | ✅ Escrito |
| `src/lib/auth.supabase.js` (login real) | ✅ Escrito |
| `src/lib/api.supabase.js` (datos reales) | ✅ Escrito |
| `.env` con las llaves | ❌ **Falta** |
| Renombrar `auth.js` y `api.js` | ❌ **Falta** |
| Google OAuth configurado | ❌ **Falta** |
| Elegir médico al registrar paciente | ❌ **Falta** (solo en la base) |
| Subir video desde la computadora | ❌ **Falta** |
| 4 botones muertos de `App.jsx` | ❌ **Falta** |
| **4 ventanas del login** (solicitud, recuperar, nueva contraseña, solicitar acceso) | ❌ **Falta** |
| **Ventana flotante de evaluación** | ❌ **Falta** (la base ya está lista) |
| **Reportes en PDF** | ❌ **Falta** (la base ya está lista) |
| **Alta del paciente** | ❌ **Falta** (la base ya está lista) |

---

# FASE 0 — Base de datos (lo hace la persona, no Claude)

El archivo 1 **crea todo desde cero**. No necesitas ningún esquema previo ni
ningún otro archivo.

En Supabase → SQL Editor, en **consultas separadas** (el 2 NO va pegado abajo
del 1: son dos consultas distintas):

1. `sql/1_BASE_DE_DATOS.sql` → responde *"Base de datos lista…"*
2. `sql/2_DATOS.sql` → responde con una tabla de 26 filas con los conteos

Después, en **Authentication → Users → Add user** (marcando *Auto Confirm User*):

| Correo | Para probar como |
|---|---|
| `superadmin@fisioclin.bo` | Administrador |
| `dr.martin@fisioclin.bo` | Doctor |
| `lic.mamani@fisioclin.bo` | Fisioterapeuta |

**Verificación:** `select * from public.usuarios where auth_user_id is not null;` debe devolver 3 filas.

> Los **pacientes** también tienen cuenta, pero con el carnet como usuario
> (`7000001@carnet.cossmil.bo`). Esas son para la app del celular: **no entran
> a este panel**, la base se lo impide.

### Si el archivo 2 termina con más filas de las que dice

Es lo esperado. La base agrega sola: cada evaluación y cada alta escriben en el
historial clínico, cada prescripción y cada cita generan un aviso al paciente,
y los 9 tablas auditadas dejan su rastro en la bitácora. Si ves
`historial_clinico` con 21 en vez de 8, **los triggers están funcionando**.

### Opcional pero recomendado: que las alertas corran solas

Supabase → **Database → Extensions** → buscar `pg_cron` → **Enable**.
Después volver a correr el archivo 1: el PASO 20 programa solo la revisión
diaria de alertas (07:00) y la limpieza semanal. Si no lo activas, las alertas
solo aparecen cuando alguien aprieta el botón "Revisar alertas".

---

# FASE 1 — Conectar el proyecto

**Tareas para Claude:**

1. `npm install @supabase/supabase-js` (está en `node_modules` pero no declarado en `package.json`).
2. Verificar que existe `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. **Si no existe, parar y pedírselo a la persona.** No inventar las llaves.
3. Renombrar:
   - `src/lib/auth.js` → `src/lib/auth.demo.js`
   - `src/lib/auth.supabase.js` → `src/lib/auth.js`
   - `src/lib/api.js` → `src/lib/api.demo.js`
   - `src/lib/api.supabase.js` → `src/lib/api.js`
4. No borrar `src/lib/mockDb.js`: sirve de referencia de las formas que esperan los componentes.
5. Reiniciar el servidor (Vite no relee `.env` en caliente).

**Verificación:** entrar como `dr.martin` → **3 pacientes**. Entrar como `superadmin` → **6**.

---

# FASE 2 — Google (lo hace la persona, en el navegador)

1. **Supabase** → Authentication → Providers → Google → copiar el *Callback URL*.
2. **console.cloud.google.com** → nuevo proyecto:
   - **Pantalla de consentimiento OAuth**: *Externo*, nombre `FisioClin COSSMIL`, permisos `email` y `profile`. En modo prueba, agregar como *usuarios de prueba* los correos que vayan a probar.
   - **Credenciales** → ID de cliente OAuth → *Aplicación web*:
     - Orígenes JavaScript: `http://localhost:5173`
     - URI de redireccionamiento: el *Callback URL* del paso 1
3. Pegar **Client ID** y **Client Secret** en Supabase → Enable → Save.
4. Supabase → Authentication → URL Configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`

**Verificación:** entrar con un Gmail que NO esté en `usuarios`. **No debe entrar**: debe aparecer como solicitud pendiente para el administrador.

---

# FASE 3 — El médico tratante al registrar un paciente ⭐ NUEVO

El superusuario **no atiende pacientes**: no tiene ficha en `medicos`. Por eso,
cuando él registra a alguien, tiene que decir **a qué médico se lo asigna**.
Hoy el formulario no lo pregunta, y el alta fallaría.

La base ya está lista (vista `vista_profesionales` y trigger
`trg_completar_registrador`). Falta el formulario.

**Tareas para Claude:**

1. En `src/App.jsx`: cargar los profesionales junto con el resto de los datos
   (`api.cargarProfesionales()`) y guardarlos en estado. Pasarlos a
   `<ModalNuevoPaciente profesionales={profesionales} />`.

2. En `src/components/ModalNuevoPaciente.jsx`, agregar **dos desplegables**
   en la fila donde hoy están *Articulación* y *Grado artrosis*:

   | Campo | Opciones | Obligatorio |
   |---|---|---|
   | **Médico tratante** | `profesionales.medicos` | ✅ sí |
   | **Fisioterapeuta asignado** | `profesionales.fisioterapeutas` + "Sin asignar" | no |

   Mandarlos en `onSave` como `id_medico_tratante` e `id_fisioterapeuta`.

3. **Comportamiento según quién esté conectado** (`currentUser.user.nombre_rol`):
   - **Superusuario**: el desplegable de médico tratante aparece **vacío y es
     obligatorio**. Si no elige, mostrar el error *"Elige a qué médico se le
     asigna este paciente"* y no guardar.
   - **Médico o fisioterapeuta**: el desplegable aparece **preseleccionado con
     él mismo**, pero puede cambiarlo.

4. Mostrar junto a cada médico cuántos pacientes tiene
   (`pacientes_a_cargo`, ya viene en la vista). Ayuda a repartir la carga.

**Verificación:** entrar como `superadmin`, registrar un paciente eligiendo a
la Dra. Rojas. Cerrar sesión, entrar como `dr.martin`: **ese paciente no debe
aparecerle**. Entrar como `dra.rojas`: **sí debe aparecer**.

---

# FASE 4 — Subir el video desde la computadora ⭐ NUEVO

Hoy `src/components/CatalogoEjercicios.jsx:266` solo deja **pegar una URL**.
Hay que cambiarlo por **subir el archivo desde la computadora**, guardarlo en
Supabase, y que lo vean todos.

## Cómo queda el catálogo

> **Es un catálogo COMPARTIDO de la unidad.** Todos los médicos, los
> fisioterapeutas y el administrador **ven todos los ejercicios y pueden
> crear, editar y borrar cualquiera**. No es propiedad de quien lo creó.
> Así está ya configurado en la base (`p_ejercicios_escribir` y
> `p_ejercicios_videos_todos`).

**Tareas para Claude:**

1. **Quitar** el campo de texto "URL de Video de Referencia" y poner en su
   lugar una zona de subida:
   - `<input type="file" accept="video/mp4,video/quicktime,video/webm">`
   - Arrastrar y soltar, igual que los adjuntos de `ModuloPacientes.jsx`
   - Texto de ayuda: *"MP4, MOV o WEBM · hasta 50 MB"*

2. Validar **antes** de subir: tipo de archivo y tamaño máximo 50 MB. Si se
   pasa, mensaje claro con el peso real del archivo.

3. Llamar a `api.subirVideoEjercicio(idEjercicio, archivo, currentUser)`.

4. **Orden importante:** el ejercicio tiene que existir antes de subirle el
   video (la ruta del archivo usa su `id_ejercicio`). En un ejercicio nuevo:
   guardar primero, y recién ahí habilitar la zona de subida. Mientras no
   exista, mostrar la zona en gris con el texto *"Guarda el ejercicio primero"*.

5. Mostrar el estado durante la subida usando `video_estado`:
   `sin_video` → `subiendo` (spinner, botones bloqueados) → `listo` → `error`.

6. Cuando el ejercicio ya tiene video, mostrar:
   - un `<video controls>` con el enlace (`ej.videoUrl`, ya viene firmado)
   - botón **Reemplazar video** (sube otro encima)
   - botón **Quitar video** → `api.quitarVideoEjercicio(id, ej.videoPath)`

7. Agregar el botón **Borrar ejercicio** →
   `api.eliminarEjercicio(id, ej.videoPath)`, con confirmación.
   Esa función ya maneja el caso especial: si el ejercicio **ya está recetado
   a algún paciente**, la base no deja borrarlo (rompería el historial), así
   que lo **desactiva** y devuelve el mensaje explicándolo. Mostrar ese
   mensaje tal cual.

8. Los enlaces de video son **temporales (1 hora)**. Si alguien deja la
   pantalla abierta mucho rato, el video deja de cargar: volver a pedir el
   enlace al darle play, no al cargar la lista.

**Verificación:** subir un video de ~15 MB como `dr.martin`. Cerrar sesión,
entrar como `dra.rojas` y **que lo vea y lo pueda reemplazar**.

---

# FASE 5 — Los 4 botones que no hacen nada

Hoy `src/App.jsx` **no pasa** estas funciones a `ModuloPacientes`, y en
`ModuloPacientes.jsx:1205` caen a `() => {}`. Editar un paciente, agregar una
nota, editarla y activar/desactivar **no hacen nada, sin dar error**.

**Tareas para Claude:**

1. Crear los manejadores en `App.jsx` y pasarlos:

   | Prop | Debe llamar a |
   |---|---|
   | `onUpdatePatient` | `api.actualizarPaciente(db_id, datos)` |
   | `onToggleStatus` | `api.cambiarEstadoPaciente(db_id, activo)` |
   | `onAddHistoryEntry` | `api.crearNotaClinica(db_id, datos, datos.files, currentUser)` |
   | `onUpdateHistoryEntry` | `api.actualizarNotaClinica(id_historial, datos)` |

   Cada uno: `try/catch`, `showToast`, y `await cargarTodo()` al final.

2. **Ojo con los ids.** Los componentes usan `patient.id` (el código
   `PAC-0001`) pero la base necesita `patient.db_id` (el número). Traducir con
   `patients.find(p => p.id === id).db_id`.

3. Corregir `ModuloPacientes.jsx:440`: manda `patient.id_usuario` donde
   `App.jsx` espera el id del paciente. Debe mandar `patient.id`.

4. Corregir `ModuloPacientes.jsx:92` y `PrescripcionRutinas.jsx:16`: adivinan
   la articulación leyendo el texto del diagnóstico. **Ya existe la columna**
   `pacientes.articulacion_principal`, que llega como `patient.articulacion`.
   Usarla y borrar la función que adivina.

5. Los adjuntos guardados deben abrirse: `AttachmentList` usa `a.url`, pero la
   API devuelve `{bucket, path}`. Resolver con `api.urlAdjunto(a)` al hacer
   clic (el enlace es temporal).

**Verificación:** crear una nota con una radiografía, recargar con F5, y que siga ahí.

---

# FASE 6 — El login completo: 4 ventanas flotantes

Las cuatro son **ventanas flotantes** (modales) sobre la pantalla de login, no
páginas aparte. Copiar la estructura de `ModalNuevoPaciente.jsx`: fondo oscuro
semitransparente, tarjeta centrada, cierra con Escape y con clic afuera.

Conviene crear un `src/components/ModalBase.jsx` con esa estructura y que las
cuatro la reutilicen, en vez de repetir el mismo fondo cuatro veces.

---

## 6.1 — Ventana "Tu solicitud está en revisión" ⭐

**Cuándo aparece:** alguien entra con Google, la base le abre la solicitud
correctamente… y entonces `restoreSession()` devuelve
`{ pendiente: true, solicitud: {...} }` en vez de una sesión.

Hoy `App.jsx` no contempla ese caso: lo trata como "no hay sesión" y lo deja
mirando el login **sin explicarle nada**. Parece que el sistema está roto.

**Crear:** `src/components/ModalSolicitudPendiente.jsx`

Se abre **sola**, encima del login, apenas `restoreSession()` devuelve
`pendiente: true`. No se cierra con Escape ni con clic afuera: la persona tiene
que leerla. El único modo de salir es "Cerrar sesión".

Tres estados, según `solicitud.estado`:

| Estado | Qué muestra |
|---|---|
| `pendiente` | ⏳ *"Tu solicitud está en revisión"* · el nombre y correo con que entró · la fecha en que la envió · *"El administrador la revisará y te avisaremos por correo."* |
| `rechazada` | ❌ *"Tu solicitud no fue aprobada"* · el motivo (`observaciones`) si lo hay · a quién contactar |
| `sin_solicitud` | ⚠️ *"Tu correo no está registrado en el sistema"* · botón para **solicitar acceso** (abre la ventana 6.4) |

Botón **"Cerrar sesión"** en los tres casos, que llame a `signOut()` y vuelva al
login limpio.

---

## 6.2 — Ventana "¿Olvidaste tu contraseña?" ⭐

**El profesional la resuelve SOLO.** Hoy `Login.jsx:390` dice *"Contacte al
administrador"*, y eso obliga a molestar a alguien para algo que debería
resolverse en un minuto.

**Crear:** `src/components/ModalRecuperarPassword.jsx`

Se abre al hacer clic en el enlace del login.

1. Un solo campo: **"Tu usuario o tu correo"**. Acepta las dos cosas —
   `recuperarPassword()` ya traduce el usuario a correo, porque el enlace tiene
   que ir al correo de su cuenta.
2. Botón **"Enviarme el enlace"** → `recuperarPassword(texto)` de `auth.js`.
3. Mostrar el mensaje que devuelve y **cerrar la ventana**.

> **No cambies el mensaje de respuesta.** Siempre dice lo mismo —
> *"Si la cuenta existe, te enviamos el enlace"*— exista o no el correo.
> Si dijera *"ese correo no existe"*, cualquiera podría ir probando correos
> hasta averiguar quién tiene cuenta en el sistema. Es a propósito.

También tiene un freno: máximo **3 pedidos por hora** por correo. Si se pasa,
la respuesta es la misma pero no se manda otro correo.

---

## 6.3 — Ventana "Elige tu nueva contraseña" ⭐ LA QUE FALTABA

Sin esta, la 6.2 no sirve de nada: el profesional recibe el correo, hace clic…
y vuelve al login sin que pase nada.

**Cómo funciona:** al hacer clic en el enlace del correo, Supabase lo trae de
vuelta a la aplicación con un token en la URL y **una sesión temporal que solo
sirve para cambiar la contraseña**.

**Crear:** `src/components/ModalNuevaPassword.jsx`

1. En `App.jsx`, al arrancar, llamar a `esRetornoDeRecuperacion()` de `auth.js`.
   Si devuelve `true`, abrir esta ventana **antes que cualquier otra cosa**.
2. Dos campos: nueva contraseña y repetirla.
3. Validar: mínimo 8 caracteres y que las dos coincidan. Mostrar la fuerza de
   la contraseña mientras escribe.
4. Al guardar → `cambiarPassword(nueva)` de `auth.js`. Esa función ya cambia la
   contraseña en Supabase **y** apaga el aviso de "debes cambiarla" en la base.
5. Limpiar el `#` de la URL (`history.replaceState`) para que al recargar no
   vuelva a abrirse, y mandarlo al panel ya con su sesión.

**Verificación de 6.2 + 6.3 juntas:** entrar con `dr.martin`, cerrar sesión,
"¿Olvidaste tu contraseña?", poner `dr.martin`, abrir el correo, hacer clic,
poner una contraseña nueva, y entrar con ella. **Sin que el administrador toque
nada.**

---

## 6.4 — Ventana "Solicitar acceso"

El administrador tiene toda una pantalla para aprobar solicitudes, pero **nadie
puede crear una desde el panel**. Solo se puede entrando con Google.

**Crear:** `src/components/ModalSolicitarAcceso.jsx`, que se abre desde un
enlace nuevo en el login: *"¿No tienes cuenta? Solicitar acceso"*.

Campos: nombre completo, correo, tipo profesional (médico fisiatra /
fisioterapeuta), cédula profesional y teléfono.

Llama a `solicitarAcceso({nombre, email, tipo, cedula, telefono})` de `auth.js`.
Al terminar, mostrar *"Tu solicitud fue enviada. El administrador la revisará."*

> Esta ventana la usa **gente que todavía no entró**. La base ya lo contempla:
> hay una política que permite ese `insert` sin sesión, y solo puede crear
> solicitudes en estado `pendiente`.

---

## 6.5 — Cambio de contraseña obligatorio

Si `currentUser.user.debe_cambiar_password` es `true` (porque el administrador
lo forzó, o porque es una cuenta recién creada), mostrar la ventana 6.3
**antes del dashboard** y no dejar salir de ahí hasta que la cambie.

---

**Verificación de toda la fase:** entrar con un Gmail que no esté en el
sistema → debe salir la ventana de "solicitud en revisión" (no el login vacío).
Aprobarla desde el administrador. Volver a entrar con ese Gmail → ahora sí
entra al panel.

---

# FASE 7 — Limpieza de módulos

`src/lib/mappers.js` declara 15 módulos, pero `reportes` y `configuracion`
**se pueden conceder y no existen** (no tienen pantalla), y `superadmin` se usa
como vista pero **no está en la lista**, así que su permiso nunca se evalúa.

Decidir: **(a)** construir las dos pantallas, o **(b)** quitar `reportes` y
`configuracion` y agregar `superadmin`. Aplicarlo en `mappers.js`,
`Sidebar.jsx` y en la tabla `catalogo_modulos`.

---

# FASE 8 — La pantalla del goniómetro: antes y después ⭐ EL RESULTADO DE LA TESIS

Esta es la pantalla más importante del sistema y **no existe**. La base ya
guarda todo (tabla `evaluaciones_goniometro` y dos vistas), pero el médico no
lo ve por ningún lado.

## Qué se mide, y por qué son DOS cosas distintas

| | Qué compara | Qué responde | Vista |
|---|---|---|---|
| **Efectividad** | goniómetro inicial vs goniómetro final | *"el paciente ganó 27°"* | `vista_evaluacion_pre_post` |
| **Exactitud** | cámara vs goniómetro el mismo día | *"la cámara falla 2,4°"* | `vista_validacion_goniometro` |

La primera dice si **el tratamiento sirve**. La segunda, si **tu sistema mide
bien**. Un tribunal va a preguntar por las dos, y no se pueden mezclar.

**Tareas para Claude:**

1. Crear `src/components/EvaluacionGoniometro.jsx` y agregarlo como módulo
   nuevo (`evaluaciones`) en `mappers.js`, `Sidebar.jsx` y en la tabla
   `catalogo_modulos`.

2. **VENTANA FLOTANTE de evaluación** — `src/components/ModalEvaluacion.jsx`

   Sirve para las dos: la **inicial** y la **final**. Es la misma ventana; lo
   único que cambia es el campo *Momento* y los avisos que muestra.

   Se abre desde tres lugares:
   - botón **"Registrar evaluación"** en la ficha del paciente
   - botón **"Evaluación inicial"** al terminar de registrar un paciente nuevo
   - botón **"Evaluación final"** cuando se intenta dar de alta y falta (FASE 10)

   Copiar la estructura de `ModalNuevoPaciente.jsx`: fondo oscuro, tarjeta
   centrada, cierra con Escape y con clic afuera, y **no cierra si hay datos
   sin guardar** sin preguntar antes.

   **Encabezado:** nombre del paciente, código, articulación y grado K-L, para
   que no haya duda de a quién se está midiendo.

   **Campos:**

   | Campo | Detalle |
   |---|---|
   | **Momento** | `inicial` / `intermedia` / `final` / `seguimiento` |
   | Articulación y lado | preseleccionados con los del paciente |
   | **Ángulo mínimo** | lo que marcó el goniómetro (admite negativos: el tobillo llega a −12°) |
   | **Ángulo máximo** | lo que marcó el goniómetro |
   | Ángulo de la cámara | opcional |
   | Sesión de referencia | desplegable con las sesiones de ese paciente; al elegir una, **rellena solo** el ángulo de la cámara |
   | Dolor EVA (0–10) | deslizador de 0 a 10 |
   | Posición del paciente | texto (ej. *"Decúbito supino, cadera a 0°"*) |
   | Instrumento | por defecto *"Goniómetro universal"* |
   | Observaciones | texto libre |

   **Lo que la ventana calcula EN VIVO mientras se escribe** (solo para que el
   médico lo vea; a la base no se le manda nada de esto):
   - el recorrido: `máximo − mínimo`
   - si puso el ángulo de la cámara: la diferencia, y un semáforo
     🟢 dentro de los 5° / 🔴 fuera
   - si el momento es `final` y ya existe la inicial: **cuánto ganó**, en
     grados y en %, en letra grande. Es el número que el médico quiere ver.

   **Avisos que tiene que mostrar la ventana** (no en la documentación, en la
   pantalla):
   - en `inicial`: *"Esta medición se toma ANTES de que el paciente empiece a
     usar la aplicación."*
   - en `final`: *"Esta medición se toma DESPUÉS de terminar el plan."*
   - si ya existe una evaluación de ese momento: avisar que **solo puede haber
     una inicial y una final** por plan y articulación (la base lo impide), y
     ofrecer editar la que ya está.

   **Validaciones antes de guardar:** el máximo no puede ser menor que el
   mínimo, y los dos son obligatorios. El ROM, el error y si entra en el umbral
   **los calcula la base**: no se mandan.

   Al guardar: cerrar, mostrar el toast, y **recargar el historial** — porque
   la entrada del historial aparece sola (PASO 21 de la base).

3. **Aviso importante en la interfaz:** la evaluación `inicial` se toma
   **ANTES** de que el paciente empiece a usar la app, y la `final` **DESPUÉS**
   de terminar el plan. Si no, la comparación no vale. Ponerlo escrito en el
   formulario, no solo en la documentación.

4. **Tarjeta "Antes y después"** en la ficha del paciente, leyendo
   `vista_evaluacion_pre_post`: ROM inicial → ROM final, la ganancia en grados
   y en %, la reducción de dolor, los días de tratamiento y cuántas sesiones
   hizo. Una barra comparativa se entiende mejor que una tabla.

5. **Tabla de validación** (pantalla aparte, para la tesis), leyendo
   `vista_validacion_goniometro`: por articulación, el número de mediciones,
   el error medio, la desviación estándar, el **% de acuerdo** dentro de los 5°
   y el sesgo. Agregar un botón para exportar a CSV.

6. Si un paciente tiene `inicial` pero no `final` y su plan ya terminó,
   marcarlo como **"falta la evaluación final"**. Sin eso, ese paciente no
   entra en los resultados.

**Verificación:** cargar una evaluación inicial y una final de un paciente y
que la ganancia de ROM salga bien calculada, sin hacer ninguna cuenta en el
navegador.

---

# FASE 9 — Reportes: cada uno saca lo suyo

La base ya entrega **6 reportes listos**, y con una particularidad importante:

> **Las consultas son EXACTAMENTE las mismas para el administrador y para el
> médico.** No hay que programar dos versiones ni filtrar nada en el navegador.
> El administrador pregunta y recibe los 6 pacientes y los 5 profesionales; el
> Dr. Martin manda la misma pregunta y recibe sus 3 pacientes y sus propios
> números. Eso lo hace el PASO 24 de la base (`security_invoker`).

## Los 6 reportes

| Reporte | Vista | Qué trae |
|---|---|---|
| **Resumen de la unidad** | `vista_reporte_resumen` | Una fila con los números gruesos: pacientes, altas, abandonos, sesiones, ganancia media de ROM, % de acuerdo de la cámara |
| **Paciente** | `vista_reporte_paciente` | Ficha, adherencia, dolor, antes/después, plan |
| **Evaluaciones** | `vista_reporte_evaluaciones` | Una fila por medición. **Es la tabla del anexo de la tesis** |
| **Adherencia** | `vista_reporte_adherencia` | Lo que se mandó hacer contra lo que se hizo |
| **Profesionales** | `vista_reporte_profesionales` | Carga de trabajo de cada uno |
| **Usuarios y accesos** | `vista_reporte_usuarios` | Cuentas, roles, último acceso, módulos |

## Qué ve cada uno

| Reporte | 👑 Administrador | 🩺 Doctor |
|---|---|---|
| Resumen de la unidad | Toda la unidad | Solo sus pacientes |
| Paciente | Cualquiera | **Solo los suyos** |
| Evaluaciones | Todas | Solo las de sus pacientes |
| Adherencia | Todos | Solo los suyos |
| Profesionales | Los 5 | Su propia hoja de servicio |
| Usuarios y accesos | Todas las cuentas | Solo su propia cuenta |

**Tareas para Claude:**

1. Instalar una librería de PDF para el navegador: `jspdf` + `jspdf-autotable`
   es lo más simple. (`@react-pdf/renderer` si se quiere más control del
   diseño, pero es bastante más trabajo.)

2. Crear `src/components/Reportes.jsx` para el módulo `reportes`, que hoy se
   puede conceder pero **no tiene pantalla**.

3. **Pantalla de reportes:** un selector con los 6 reportes, filtro de fechas,
   y para los que van por paciente, un selector de paciente. Vista previa en
   pantalla **antes** de generar el PDF — que nadie imprima a ciegas.

4. **No esconder los reportes por rol.** Mostrar los 6 a todos: el médico verá
   el de profesionales con su propia hoja de servicio, y el de usuarios con su
   propia cuenta. Es información suya y le sirve. La base ya se encarga de que
   no vea la de los demás.

5. **Diseño del PDF:** encabezado con el logo COSSMIL y *"Unidad de Medicina
   Física y Rehabilitación"*, título del reporte, rango de fechas, tabla o
   fichas según el caso, y pie con quién lo generó, la fecha y la numeración
   de páginas.

6. Subir el PDF al depósito `reportes` y registrar la fila llamando a
   `fn_registrar_reporte(id_paciente, ruta, desde, hasta, tipo)`. Los tipos
   válidos son: `individual`, `general`, `usuarios`, `profesionales`,
   `evaluaciones`, `adherencia`, `auditoria`.

7. **Exportar a CSV** además del PDF, sobre todo en *Evaluaciones*: para la
   tesis hace falta meter esos números en Excel o en SPSS, y de un PDF no se
   sacan.

8. Listar abajo los reportes ya generados con su enlace (es temporal: hay que
   pedirlo al hacer clic, no al cargar la lista).

> ⚠️ **Datos personales.** El reporte individual lleva nombre y CI, y va a la
> historia clínica del paciente. El reporte general y el de evaluaciones
> **deben usar solo `codigo_anonimo`** — para eso existe esa columna. Si el
> anexo de la tesis lleva nombres reales, tienes un problema con el comité de
> ética, no con el código.

---

# FASE 10 — El alta del paciente y la línea de tiempo ⭐ NUEVO

## Lo que ya hace la base sola

**Cada evaluación con goniómetro se escribe sola en el historial clínico.**
No hay que acordarse de anotarla: al registrarla, la base crea la entrada con
los grados, la posición, el dolor y —si es la final— **cuánto mejoró respecto
a la inicial**, calculado solo.

Así el historial queda como una línea de tiempo que se lee sola:

```
Evaluación inicial  →  notas y controles  →  Evaluación final  →  ALTA
```

## El alta

Desactivar a un paciente no servía: no distingue entre *"se curó"*,
*"abandonó"* y *"se mudó"*, y esas tres cosas significan lo contrario en una
tesis. Ahora hay tabla propia (`altas_paciente`) con **cinco tipos**:

| Tipo | Cuándo |
|---|---|
| `alta_medica` | Cumplió los objetivos. No vuelve |
| `alta_temporal` | *"Por ahora está bien"* — vuelve a control |
| `alta_voluntaria` | El paciente decide dejarlo |
| `abandono` | Dejó de venir |
| `derivado` | Pasa a otro servicio |

Y el paciente pasa a tener `estado_tratamiento`: `en_tratamiento`, `de_alta`,
`alta_temporal`, `suspendido`, `abandono` o `derivado`.

Al dar el alta, la base **sola**: cambia el estado del paciente, cierra el plan,
lo escribe en el historial y le avisa al paciente.

**Tareas para Claude:**

1. **Badge de estado** junto al nombre del paciente en `ModuloPacientes.jsx`,
   leyendo `estado_tratamiento`. Verde *En tratamiento*, azul *De alta*,
   celeste *Alta temporal*, gris *Abandono*. Hoy solo dice Activo/Inactivo, que
   ya no alcanza.

2. **Botón "Dar de alta"** en la ficha, que abra un formulario con: tipo de
   alta, estado funcional (`recuperado` / `funcional` / `mejoria_parcial` /
   `sin_cambios` / `empeoro`), motivo (obligatorio), recomendaciones, y
   *"¿requiere control?"* con fecha.

   Llama a `fn_dar_alta(...)`. El ROM y el dolor **no se piden**: los toma solo
   de la evaluación final.

3. **Importante:** `fn_dar_alta` **rechaza el alta si no existe la evaluación
   final** con goniómetro, y devuelve un mensaje explicándolo. Mostrarlo tal
   cual, con dos salidas: *"Registrar evaluación final"* (lleva a la FASE 8) o
   *"Dar de alta igualmente"* (manda `p_forzar = true`, para abandonos y
   derivaciones). **No saltarse esa validación por comodidad**: sin la medición
   final, el alta es una opinión.

4. **Botón "Reingreso"** en un paciente de alta que vuelve →
   `fn_reabrir_tratamiento(id, motivo)`.

5. **Panel de altas** (puede ir dentro del módulo `evaluaciones`), leyendo
   `vista_altas`: quién terminó, cuánto ganó de ROM, cuánto bajó el dolor, y
   —lo más útil— **quiénes tienen un control vencido** (`control_vencido`).
   Esos son los pacientes que hay que llamar.

6. En el historial clínico, dar estilo propio a los tipos nuevos
   (`evaluacion_inicial`, `evaluacion_final`, `alta_medica`) en `TONO_HIST` de
   `ModuloPacientes.jsx`, y traducirlos en `tipoEntradaLabel` de `mappers.js`.
   Si no, aparecen como "Control", que es justo lo contrario de lo que son.

**Verificación:** cargar la evaluación final de un paciente, comprobar que
aparece sola en su historial con la ganancia calculada, darle el alta, y que el
badge cambie y el plan quede como *completado*.

---

# ¿Qué puede hacer cada uno? (CRUD)

Esto **no lo decide el panel**: lo decide la base con las políticas RLS.
Aunque alguien modifique el JavaScript del navegador, la base no le entrega lo
que no le toca.

## 👑 ADMINISTRADOR (superusuario)

| Sobre qué | Crear | Leer | Editar | Borrar |
|---|:---:|:---:|:---:|:---:|
| Usuarios y cuentas | ✅ | ✅ | ✅ | ⛔ *(desactiva)* |
| Permisos por módulo (16 casillas) | — | ✅ | ✅ | — |
| Profesionales | ✅ | ✅ | ✅ | ⛔ *(desactiva)* |
| Solicitudes de acceso | ⛔ *(las crea quien pide)* | ✅ | ✅ aprobar/rechazar | ⛔ |
| Contraseñas de otros | ✅ enviar acceso | ✅ historial | ✅ forzar cambio | ⛔ |
| **Todos** los pacientes | ✅ **eligiendo médico** | ✅ | ✅ | ⛔ *(desactiva)* |
| Planes y prescripciones | ✅ | ✅ | ✅ | ⛔ *(desactiva)* |
| **Catálogo de ejercicios + videos** | ✅ | ✅ | ✅ | ✅ |
| Citas | ✅ | ✅ | ✅ | ⛔ *(cancela)* |
| Historial clínico y adjuntos | ✅ | ✅ | ✅ | ✅ adjuntos |
| **Evaluaciones con goniómetro** | ✅ | ✅ | ✅ | ✅ |
| **Altas de pacientes** | ✅ | ✅ | ✅ | ⛔ *(se reabre)* |
| **Reportes en PDF** | ✅ | ✅ | ⛔ | ⛔ |
| Mensajes y avisos | ✅ | ✅ | ✅ | ⛔ |
| Auditoría | ⛔ | ✅ | ⛔ | ⛔ |
| Sesiones, métricas, repeticiones | ⛔ | ✅ | ⛔ | ⛔ |

## 🩺 DOCTOR (médico fisiatra)

| Sobre qué | Crear | Leer | Editar | Borrar |
|---|:---:|:---:|:---:|:---:|
| **Sus** pacientes | ✅ *(queda él de registrador)* | ✅ | ✅ | ⛔ *(desactiva)* |
| Pacientes de otros médicos | ⛔ | ⛔ **no existen para él** | ⛔ | ⛔ |
| Planes y prescripciones de los suyos | ✅ | ✅ | ✅ | ⛔ *(desactiva)* |
| **Catálogo de ejercicios + videos** | ✅ | ✅ | ✅ **también los de otros** | ✅ |
| Citas de los suyos | ✅ | ✅ | ✅ | ⛔ *(cancela)* |
| Historial clínico y adjuntos | ✅ | ✅ | ✅ | ✅ adjuntos |
| Mensajes **a sus** pacientes | ✅ | ✅ | ✅ leídas | ⛔ |
| **Evaluaciones con goniómetro** de los suyos | ✅ | ✅ | ✅ | ✅ |
| **Dar de alta / reabrir** a los suyos | ✅ | ✅ | ✅ | ⛔ |
| **Reportes en PDF** de los suyos | ✅ | ✅ | ⛔ | ⛔ |
| Su perfil, foto, preferencias, contraseña | — | ✅ | ✅ | ⛔ |
| Usuarios, permisos, solicitudes, auditoría | ⛔ | ⛔ | ⛔ | ⛔ |
| Su tipo profesional y su cédula | ⛔ | ✅ | ⛔ **solo el admin** | ⛔ |

## 🧑‍⚕️ FISIOTERAPEUTA

Igual que el doctor, **menos**: prescripción de rutinas y evolución clínica.
El catálogo de ejercicios **sí** lo puede usar y modificar como todos.

## Lo que NADIE puede borrar (a propósito)

`sesiones` · `metricas_articulares` · `repeticiones_ejercicio` ·
`registro_dolor` · `bitacora_auditoria`

Son la evidencia clínica y el rastro de auditoría. Ninguna relación tiene
borrado en cascada: un paciente con sesiones **no se puede eliminar**, solo
desactivar. Es deliberado, y para una tesis conviene que sea así.

---

# Lo que todavía le falta

1. **Los archivos de los datos de prueba no existen.** El archivo 2 crea filas
   que apuntan a `PAC-0001/rx-rodillas-ap.jpg` y a videos, pero **esos archivos
   nunca se subieron**. Al hacer clic en un adjunto de prueba va a fallar. Es
   normal: se arregla subiendo archivos de verdad desde el panel.

2. **Rendimiento de las reglas RLS.** Las políticas llaman a `app.id_usuario()`
   directamente y Postgres puede evaluarlas **una vez por fila**. Con 6
   pacientes da igual; con 5.000 se nota. El arreglo es envolver la llamada en
   un `(select ...)`. Dejarlo para cuando haya volumen real.

3. **Sin copias de seguridad.** Supabase hace backup diario solo en planes de
   pago. Con datos clínicos reales, deja de ser opcional.

4. **La app del paciente (móvil) no está tocada.** La base ya le dejó lista la
   vista `vista_sesion_paciente` y sus permisos, pero ese proyecto es otro
   (`C:\Users\WARA\FisioClin`).

5. **El alta no se puede borrar, solo reabrir.** Es a propósito: un alta
   borrada haría desaparecer el cierre del caso del historial. Si fue un error,
   se reabre el tratamiento y queda registrado que se reabrió.

6. **Nada valida que la evaluación inicial sea de verdad ANTES de usar la app.**
   La base acepta cualquier fecha. Si alguien carga la inicial después de que
   el paciente ya lleva un mes entrenando, los resultados de la tesis quedan
   mal y el sistema no se entera. Se puede agregar una validación que compare
   la fecha de la evaluación inicial con la primera sesión registrada.

---

# Referencia: cómo está organizada la base

Son 26 tablas, pero en realidad son **5 cajones**:

### 🟢 Quién entra al sistema
`usuarios` · `medicos` · `solicitudes_acceso` · `catalogo_modulos` ·
`fotos_perfil` · `preferencias_usuario` · `intentos_login` ·
`recuperaciones_password`

`usuarios` es **la raíz de todo**. Toda persona (superusuario, médico,
fisioterapeuta, paciente) es primero un `usuario`. Si además atiende pacientes,
tiene una fila en `medicos`.

### 🔵 A quién se atiende
`pacientes` · `documentos_identidad` · `consentimiento_informado`

Cada paciente tiene **tres médicos** apuntándolo: el tratante, el
fisioterapeuta y el que lo registró.

### 🟡 Qué se le manda hacer
`planes_tratamiento` → `prescripciones_ejercicio` → `ejercicios_catalogo`

*"A este paciente le armo un plan de 8 semanas; dentro del plan le receto 3
ejercicios del catálogo, cada uno con sus series y repeticiones."*

### 🟠 Qué hizo de verdad (lo que graba la app del celular)
`sesiones` → `metricas_articulares` · `repeticiones_ejercicio` ·
`registro_dolor`

### 🟣 Qué se mide, se anota y se comunica
`evaluaciones_goniometro` · `altas_paciente` · `historial_clinico` ·
`adjuntos_clinicos` · `citas` · `mensajes` · `notificaciones` ·
`dispositivos_push` · `reportes_generados` · `bitacora_auditoria`

### La cadena completa

```
usuario → médico → paciente → plan → prescripción → sesión → métricas
                       │
                       └── evaluación inicial → … → evaluación final → ALTA
```

La primera línea es **lo que hace el paciente cada día**.
La segunda es **lo que demuestra si sirvió**.

---

# Referencia: de dónde saca los datos cada pantalla

| Pantalla | Qué consulta |
|---|---|
| Inicio (médico) | `pacientes` + `citas` + `notificaciones` |
| Centro de control (admin) | `vista_reporte_resumen` + `solicitudes_acceso` |
| Pacientes | `pacientes` + `vista_sesiones_detalle` + `vista_progreso_semanal` + `historial_clinico` + `adjuntos_clinicos` + `planes_tratamiento` + `prescripciones_ejercicio` |
| Prescripción de rutinas | `ejercicios_catalogo` + `planes_tratamiento` + `prescripciones_ejercicio` |
| Catálogo de ejercicios | `ejercicios_catalogo` + depósito `ejercicios-videos` |
| Agenda de controles | `citas` |
| Sesiones y repeticiones | `vista_sesiones_detalle` |
| Evolución clínica | `vista_progreso_semanal` |
| **Evaluaciones (goniómetro)** | `evaluaciones_goniometro` + `vista_evaluacion_pre_post` + `vista_validacion_goniometro` |
| **Altas** | `vista_altas` |
| **Reportes** | las 6 vistas `vista_reporte_*` |
| Mensajes y avisos | `mensajes` + `notificaciones` |
| Mi perfil | `medicos` + `preferencias_usuario` + `fotos_perfil` |
| Usuarios y permisos (admin) | `vista_usuarios_admin` + `catalogo_modulos` |
| Médicos (admin) | `vista_profesionales` |
| Solicitudes de acceso (admin) | `solicitudes_acceso` |
| Auditoría (admin) | `bitacora_auditoria` |

> **Nada de esto filtra por rol en el navegador.** Todas las vistas corren con
> los permisos de quien pregunta (PASO 24 de la base), así que el
> administrador y el médico mandan la misma consulta y cada uno recibe lo suyo.
> Si alguna vez te dan ganas de escribir `if (esSuperusuario)` para filtrar
> datos: no hace falta, y además no sería seguridad.
