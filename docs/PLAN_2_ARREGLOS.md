# Plan 2 — Arreglos sobre el sistema ya funcionando

> **Cómo usarlo:** en VS Code con Claude, uno a la vez:
> *"Lee `docs/PLAN_2_ARREGLOS.md` y ejecuta el ARREGLO 3 completo."*

Este plan es distinto al primero. El primero **construía**; este **arregla lo
que ya está construido y no funciona bien**. Todos los problemas salieron de
usar el sistema de verdad.

| | Arreglo | Gravedad |
|---|---|---|
| 1 | El error que rompe Mi Perfil (✅ ya hecho) | 🔴 bloquea |
| 2 | Crear el usuario para que aparezca en Authentication | 🔴 bloquea |
| 3 | Mi Perfil: no carga ni guarda nada | 🔴 bloquea |
| 4 | Ver y editar las imágenes que se suben | 🟠 importante |
| 5 | Crear el ejercicio y su video en un solo paso | 🟠 importante |
| 6 | Pantalla para ver el video en grande | 🟡 mejora |
| 7 | El video tarda mucho y no se reproduce | 🟠 importante |
| 8 | Las fotos de perfil no se ven en ningún lado | 🟡 mejora |

---

# ARREGLO 1 — El error de "more than one relationship" ✅ YA HECHO

**No hay que hacer nada. Está corregido.** Queda escrito para que se entienda
de dónde venía, porque causaba **tres síntomas distintos**.

## Qué se veía

- El aviso rojo: *"No se pudieron cargar los profesionales: Could not embed
  because more than one relationship was found for 'medicos' and 'usuarios'"*
- **Mi Perfil con todos los campos vacíos**
- **Preferencias colgado en "Cargando…"** para siempre

## Por qué

En `api.js`, `cargarMedicos()` pedía los datos así:

```js
.select('*, usuarios(id_usuario, email, activo, rol)')
```

La tabla `medicos` apunta **dos veces** a `usuarios`: una por `id_usuario` (de
quién es esta ficha) y otra por `actualizado_por` (quién la editó por última
vez). Supabase no puede adivinar cuál de las dos seguir, así que falla.

Y como `PerfilMedico.jsx` pide el perfil y las preferencias **juntos**, cuando
uno de los dos falla **se cae el otro también**. Por eso las preferencias se
quedaban cargando: no era su culpa.

## La corrección

```js
.select('*, usuarios!medicos_id_usuario_fkey(id_usuario, email, activo, rol)')
```

Ahora se le dice exactamente por cuál de las dos relaciones ir.

**Verificación:** recargar el panel, entrar a **Mi Perfil**. El nombre, la
especialidad, el teléfono y la unidad tienen que salir llenos, y las
preferencias tienen que cargar.

---

# ARREGLO 2 — Crear el usuario para que aparezca en Authentication ⭐

## El objetivo, con una imagen clara

Cuando el administrador da de alta a un profesional, esa persona tiene que
aparecer en **Supabase → Authentication → Users**, igual que `dr.martin` y
`superadmin`:

```
UID                                   Email                      Providers
301df789-b6a7-46aa-8dec-7baa8f0bf298  dr.martin@fisioclin.bo     Email
65011cc8-39ec-4c1b-a97d-3566bf009888  superadmin@fisioclin.bo    Email
```

**Si no aparece ahí, no puede entrar.** Así de simple. Esa tabla es la que
guarda el correo y la contraseña; la tabla `usuarios` solo guarda el nombre, el
rol y los permisos.

Hoy el panel crea la ficha en `usuarios` pero **nunca crea esa fila**. Por eso
el usuario nuevo no entra.

## Por qué no se puede desde el navegador

Crear esa fila con una contraseña exige la llave **`service_role`**. Esa llave
**salta toda la seguridad** del sistema: quien la tenga puede leer y borrar
todo, sin importar las reglas.

Si la pusieras en el `.env` del panel, quedaría en el código que se descarga al
navegador. **Cualquiera que abra las herramientas de desarrollador la vería.**

Por eso el código tiene que correr **en el servidor de Supabase**, no en la
computadora del médico. Eso es una Edge Function.

> Antes te dije que esto era opcional y que el enlace por correo alcanzaba.
> Con lo que quieres —que el administrador ponga la contraseña y el usuario
> aparezca en esa lista— **no alcanza: hay que hacer la Edge Function.**

---

## Tareas para Claude

### 1. Crear la función

`supabase/functions/gestionar-usuario/index.ts`

Una sola función para las cuatro operaciones, con un campo `accion`:

| `accion` | Qué hace |
|---|---|
| `crear` | Crea la cuenta con contraseña + la ficha en `usuarios` y `medicos` |
| `cambiar_password` | Le pone una contraseña nueva |
| `cambiar_email` | Le cambia el correo (y lo confirma) |
| `desactivar` / `reactivar` | Lo bloquea o lo habilita |

### 2. El control de quién puede llamarla ⚠️

**Esto es lo más importante de todo el arreglo.** Antes de hacer nada:

1. Leer el token de quien llama (cabecera `Authorization`)
2. Averiguar quién es con `supabase.auth.getUser(token)`
3. Consultar su rol en la tabla `usuarios`
4. **Si no es `superusuario`, responder 403 y terminar ahí**

Sin ese control, cualquiera que descubra la dirección de la función **puede
crearse un administrador**. La función tiene la llave maestra: es la parte más
delicada de todo el sistema.

### 3. Crear la cuenta

```ts
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,          // sin esto queda esperando confirmación
  user_metadata: { nombre_completo }
});
```

`email_confirm: true` es lo que hace que pueda entrar **de inmediato**, sin
esperar un correo.

La ficha en `usuarios` y `medicos` la crea sola el trigger de la base al
detectar el correo nuevo. Si ese correo ya tenía ficha, la enlaza.

### 4. Desplegarla

```bash
supabase functions deploy gestionar-usuario
```

La llave `service_role` **ya está disponible dentro de la función** como
variable de entorno. No hay que configurarla ni pegarla en ningún lado.

### 5. Conectar el panel

En `api.js`, cambiar `crearCuentaAcceso()` y `crearProfesional()` para que
llamen a la función:

```js
const { data, error } = await sb().functions.invoke('gestionar-usuario', {
  body: { accion: 'crear', email, password, nombre_completo, tipo_profesional, cedula }
});
```

Y agregar `cambiarPasswordDeOtro(idUsuario, nueva)` para el administrador.

### 6. La pantalla de Gestión de usuarios

En `GestionUsuarios.jsx`, que cada fila muestre y permita:

| Columna | |
|---|---|
| **Tiene cuenta de acceso** | ✅ o ❌ — hoy ya viene en `vista_usuarios_admin` |
| **Último acceso** | *"hace 3 días"* / *"nunca ingresó"* |
| Botón **Crear cuenta** | Solo si no tiene. Pide la contraseña inicial |
| Botón **Cambiar contraseña** | Para cuando alguien la olvida y no le llega el correo |
| Botón **Activar / Desactivar** | Ya existe |

### 7. Mostrar errores de verdad

Si el correo ya existe, si la contraseña es muy corta o si el despliegue falla,
**que se vea el motivo**. Hoy varias de estas cosas fallan sin decir nada.

---

**Verificación:** el administrador crea un profesional con contraseña. Abre
Supabase → Authentication → Users y **la fila nueva está ahí, con Provider
"Email"**. Cierra sesión y entra con ese usuario y esa contraseña.

---

# ARREGLO 3 — Mi Perfil: cargar, guardar y cambiar la contraseña

Con el ARREGLO 1 los datos ya deberían salir. Falta que **guardar funcione**.

**Tareas para Claude:**

1. **Comprobar que "Guardar cambios" guarda de verdad.** Llenar los campos,
   guardar, **recargar con F5** y que sigan ahí. Si no, revisar
   `actualizarPerfilMedico()`: usa `vista_sesion_actual` para saber qué médico
   es, y la política `p_medicos_propio_update` solo deja tocar la ficha propia.

2. **Si un campo llega vacío, que se vea el valor real y no el marcador.** En
   la captura, *Consultorio* muestra "Consultorio 3, planta baja" en gris —
   eso es un `placeholder`, no el dato. Confunde: parece lleno y está vacío.

3. **"Cambiar contraseña"** tiene que abrir una ventana flotante con: contraseña
   actual, nueva y repetirla. Llama a `cambiarPassword(nueva)` de `auth.js`,
   que ya cambia la clave **y** apaga el aviso de "debes cambiarla".

4. **La foto de perfil.** El botón de la cámara tiene que subir la imagen con
   `api.subirAvatar()` y mostrarla al instante, sin recargar.

5. **Que los errores se vean.** Si algo falla, un aviso rojo con el motivo.
   Hoy varias cosas fallan en silencio y parece que funcionaron.

**Verificación:** cambiar el nombre, guardar, F5, y que siga el nombre nuevo.
Cambiar la contraseña, cerrar sesión y entrar con la nueva.

---

# ARREGLO 4 — Ver y editar las imágenes que se suben ⭐

## Qué pasa

Subes una radiografía al historial. Se guarda. **Y después no hay forma de
verla.** Haces clic y no pasa nada.

## Por qué

Dos motivos, y el segundo es el feo:

1. Hoy el archivo se abre en **otra pestaña**, y el navegador suele bloquear
   esas ventanas.
2. Si el enlace falla, **el código no avisa**: hay un `if (url)` que, si no hay
   enlace, simplemente no hace nada. Ningún error, ninguna explicación.

## Qué hacer

**Tareas para Claude:**

1. **Crear `src/components/VisorAdjunto.jsx`** — una ventana flotante que
   muestra el archivo **dentro del sistema**, sin abrir pestañas:
   - imágenes: a pantalla completa, con zoom y poder arrastrarlas
   - PDF: en un `<iframe>`
   - flechas para pasar al siguiente adjunto del mismo paciente
   - nombre del archivo, tamaño, fecha y quién lo subió
   - botón de descargar

2. **Nunca fallar en silencio.** Si no se consigue el enlace, mostrar el error
   en pantalla. Cambiar `urlFirmada()` en `api.js` para que devuelva el motivo
   en vez de tragárselo.

3. **Miniaturas en el historial.** Hoy los adjuntos son un texto con un icono.
   Que las imágenes se vean como miniatura: se reconoce una radiografía de un
   vistazo, un nombre de archivo no.

4. **Poder editarlos**, con estos botones en el visor:
   - **Renombrar** (agregar columna `nombre_visible` a `adjuntos_clinicos`)
   - **Cambiar el tipo** (radiografía / resonancia / informe…)
   - **Reemplazar** el archivo
   - **Borrar** → `api.eliminarAdjunto()`, con confirmación

5. Al subir, **mostrar la miniatura antes de guardar**, para que se note si se
   equivocó de archivo.

**Verificación:** subir una radiografía, verla en el visor sin salir del
sistema, renombrarla, y que el nombre nuevo aparezca en el historial.

---

# ARREGLO 5 — El ejercicio y su video, en un solo paso ⭐

## Qué pasa

Hoy hay que hacerlo en dos tiempos: crear el ejercicio, guardar, y **recién
entonces** subirle el video. En la pantalla sale *"Guarda el ejercicio
primero"*.

## Por qué es así hoy

El video se guarda en una carpeta con el **número del ejercicio**, y ese número
no existe hasta que el ejercicio se guarda.

## Por qué se puede arreglar igual

Ese es un problema **interno**, no tiene por qué verlo el usuario. La solución
es hacer los dos pasos seguidos, sin que se note:

```
El usuario elige el archivo  →  lo guarda en memoria, muestra la miniatura
El usuario aprieta "Crear"   →  se crea el ejercicio
                             →  con el id nuevo, se sube el video
                             →  se cierra la ventana
```

**Tareas para Claude:**

1. En `CatalogoEjercicios.jsx`, quitar el bloqueo *"Guarda el ejercicio
   primero"*. La zona de subida está activa **siempre**.
2. Al elegir el archivo, **no subirlo todavía**: guardarlo en memoria y mostrar
   una miniatura con el nombre y el peso.
3. El botón **"Crear Ejercicio"** hace las dos cosas seguidas:
   `crearEjercicio()` y, si hay archivo, `subirVideoEjercicio()` con el id nuevo.
4. Mientras tanto, el botón muestra *"Creando ejercicio…"* → *"Subiendo video…"*,
   para que se sepa en qué va.
5. **Si el video falla, el ejercicio NO se pierde.** Queda creado sin video, y
   se avisa: *"El ejercicio se creó, pero el video no se pudo subir. Puedes
   intentarlo de nuevo editándolo."* Perder los datos escritos por un video que
   falló sería lo peor que puede pasar aquí.

**Verificación:** crear un ejercicio nuevo con su video, todo de una vez, sin
guardar dos veces.

---

# ARREGLO 6 — Pantalla para ver el ejercicio con el video en grande

## Qué falta

Hoy el video solo se ve chiquito, dentro de la ventana de editar. No hay dónde
mirarlo bien.

**Tareas para Claude:**

**Crear `src/components/VisorEjercicio.jsx`** — ventana grande, en dos
columnas:

| Izquierda (más ancha) | Derecha |
|---|---|
| El video con sus controles | Nombre y código |
| Velocidad 0.5× / 1× / 1.5× ⭐ | Articulación y duración |
| Pantalla completa | Ángulos esperado mínimo y máximo |
| | Las instrucciones clínicas completas |
| | Quién lo creó y cuándo |
| | Cuántos pacientes lo tienen recetado |

Se abre al hacer clic en la tarjeta del ejercicio, en el catálogo.

Botones abajo: **Editar**, **Recetar a un paciente** y **Cerrar**.

> **Lo de la velocidad no es un adorno.** Un fisiatra necesita ver el
> movimiento en cámara lenta para corregir la técnica. Es la función que más se
> va a usar de esa pantalla.

En móvil, las dos columnas pasan a una: el video arriba, las indicaciones
abajo.

**Verificación:** abrir un ejercicio con video, verlo en grande, ponerlo a 0.5×
y leer las indicaciones al lado sin cerrar el video.

---

# ARREGLO 7 — El video tarda mucho y no se reproduce

Son dos problemas distintos que se ven juntos.

## 7.A — "Tarda mucho" (y no sabes si avanza)

Un video de 15 MB **tarda de verdad**: entre 30 segundos y 2 minutos según tu
internet. Eso no se puede acelerar mucho. **Lo que sí se puede es dejar de
parecer que está colgado.**

Hoy solo hay una rueda girando y el texto *"Subiendo video…"*. No se sabe si
va por el 10 % o por el 90 %.

**Tareas para Claude:**

1. **Barra de progreso real.** La función `upload()` de Supabase no informa el
   avance, así que hay que subir con `XMLHttpRequest` contra una URL firmada
   (`createSignedUploadUrl`) y escuchar el evento `progress`.
2. Mostrar **porcentaje, MB subidos de MB totales y tiempo estimado**.
3. **Botón de cancelar.**
4. Avisar **antes** de subir si el archivo es grande:
   *"Este video pesa 40 MB, puede tardar un par de minutos."*

## 7.B — No se reproduce

Tres causas posibles. Comprobarlas en este orden:

1. **El formato.** Los `.MOV` de iPhone suelen venir en HEVC, que **Chrome no
   reproduce**. Es la causa más probable.
   → Al elegir el archivo, comprobar si el navegador lo soporta con
   `document.createElement('video').canPlayType(tipo)`. Si no, avisar antes de
   subir: *"Este video está en un formato que el navegador no reproduce.
   Conviértelo a MP4 (H.264)."*

2. **El enlace venció.** Los enlaces duran 1 hora. `refrescarAntesDePlay()` ya
   existe para eso — verificar que se llame de verdad al darle play.

3. **La lista no se refrescó.** Después de subir, el ejercicio tiene que volver
   a leerse para que `video_estado` pase a `listo` y llegue el enlace nuevo.
   Si la pantalla se queda con los datos viejos, no hay video que mostrar.

Y en los tres casos: **mostrar el error encima del reproductor**, no dejar un
recuadro negro sin explicación.

**Verificación:** subir un MP4 de 15 MB viendo la barra avanzar, y que al
terminar se reproduzca solo, sin recargar la página.

---

# ARREGLO 8 — Las fotos de perfil: que se vean en todo el sistema ⭐

## Qué pasa

Nadie tiene foto, y aunque la suban **no se ve en ningún lado**. En la barra de
arriba sale un círculo verde con las iniciales `DM`, y en la lista de médicos
tampoco hay caras.

## Por qué

Revisé el código: **la sesión YA trae los datos de la foto**
(`avatar_bucket` y `avatar_path` vienen de `vista_sesion_actual`)…
**y nadie los usa.** `Header.jsx` dibuja siempre un círculo de color con las
iniciales, sin mirar nunca si hay foto.

O sea: la mitad del trabajo está hecha desde hace rato, solo que nadie la
conectó.

## Cómo funcionan las fotos aquí

| Dónde | Qué |
|---|---|
| Depósito `avatares` | El archivo (hasta 5 MB) |
| Tabla `fotos_perfil` | Quién es el dueño, el peso, el tipo |
| `vista_sesion_actual` | Devuelve `avatar_bucket` y `avatar_path` |

El depósito es **privado**: el archivo no se ve con una dirección normal, hay
que pedir un enlace temporal que dura 1 hora.

## Tareas para Claude

### 1. Un componente único para toda la aplicación

**Crear `src/components/Avatar.jsx`**, que reciba `{ bucket, path, nombre, tamano }`:

- si hay foto → la muestra, redonda, recortada al centro
- si no hay → el círculo con las iniciales, **como ahora**
- si la foto falla al cargar → vuelve a las iniciales, sin recuadro roto
- mientras carga → un círculo gris

**Que todas las pantallas usen este componente.** Si no, dentro de un mes
habrá cuatro formas distintas de dibujar la misma cara.

### 2. Resolver el enlace una sola vez

El enlace temporal **no se pide en cada pantalla**: se pide una vez al entrar,
se guarda en la sesión, y de ahí lo lee quien lo necesite. Si cada componente
lo pide por su cuenta, son decenas de llamadas repetidas por la misma imagen.

En `auth.js`, al armar la sesión, resolver el enlace y guardarlo como
`user.avatar_url`.

### 3. Ponerlo donde corresponde

| Pantalla | Qué mostrar |
|---|---|
| **Barra de arriba** | La foto del que entró, en vez de `DM` |
| **Menú desplegable** del usuario | La foto, más grande |
| **Mi Perfil** | La foto actual, con el botón de cámara encima |
| **Médicos** (admin) | La foto en cada tarjeta |
| **Usuarios y permisos** | Una foto chiquita en cada fila |
| **Selector de médico tratante** | La foto junto al nombre |

### 4. Subir, cambiar y quitar

En **Mi Perfil**, el botón de la cámara tiene que:

1. Aceptar JPG, PNG, WEBP y HEIC, **máximo 5 MB** (lo exige la base)
2. Mostrar una vista previa **antes** de subir
3. **Recortar a cuadrado** antes de mandarla ⭐ — si no, las fotos verticales
   del celular salen deformadas en todos los círculos
4. Subirla con `api.subirAvatar()`
5. **Actualizar la barra de arriba al instante**, sin recargar la página
6. Tener un botón de **quitar foto**, que vuelve a las iniciales

### 5. Que el administrador vea las fotos de los demás

En **Usuarios y permisos**, mostrar la foto de cada profesional. Las reglas del
depósito ya lo permiten: todo el equipo puede ver las fotos de perfil, pero
**cada quien solo puede cambiar la suya**.

> Ese límite es a propósito: el administrador puede cambiar el rol y los
> permisos de alguien, pero no su cara.

### 6. El enlace vence en 1 hora

Si alguien deja el panel abierto toda la mañana, las fotos dejan de cargar.
Dos salidas:

- **(a)** Volver a pedir el enlace cuando la imagen falle en cargar ← recomendada
- **(b)** Hacer público el depósito `avatares`

La (b) es más simple, pero significa que **cualquiera con la dirección podría
ver las fotos del personal médico**, sin estar dentro del sistema. Para una
foto de perfil institucional puede ser aceptable; es una decisión que tiene que
tomar la persona, no el programador.

**Verificación:** subir una foto en Mi Perfil y que aparezca **al instante** en
la barra de arriba, sin recargar. Cerrar sesión, entrar con otro usuario, y ver
esa foto en la lista de médicos.

---

# En qué orden

```
1 (ya está)  →  3  →  4  →  7  →  8  →  5  →  6  →  2
```

**Por qué ese orden:**

- El **3** te devuelve Mi Perfil, que está roto
- El **4** y el **7** son los que te impiden usar el sistema: subes cosas y no
  las puedes ver
- El **5** y el **6** son comodidad: molestan, pero se puede trabajar
- El **8** (las fotos) va ahí porque es corto y se nota mucho: media hora y el
  sistema deja de parecer una maqueta
- El **2** va al final porque es el más largo: hay que crear y desplegar una
  Edge Function. Mientras tanto, para dar de alta a alguien tienes dos salidas
  que ya funcionan: el enlace por correo desde el panel, o crear la cuenta a
  mano en Supabase → Authentication → Add user
