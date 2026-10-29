# Plan 3 — Los videos del catálogo y el diseño del sistema

> **Cómo usarlo:** en VS Code con Claude, uno a la vez:
> *"Lee `docs/PLAN_3_VIDEOS_Y_DISENO.md` y ejecuta la PARTE B completa."*

| Parte | Qué resuelve |
|---|---|
| **A** | Tus 20 videos no entran. Por qué, y cómo se arregla |
| **B** | El estado del paciente en su propia columna |
| **C** | Estandarizar el diseño de todos los módulos |

---

# PARTE A — Los 20 videos del catálogo

## Los números, medidos de tu carpeta

```
20 videos
1,77 GB en total
90 MB de promedio
18 de 20  pasan el límite de subida (50 MB)
 5 de 20  pasan hasta el límite de la base (100 MB)
El más grande: 207,9 MB  (EXTENSION Y FLEXION-RODILLA-ejercicio 1.mp4)
```

## El problema no es el que parece

Tú preguntaste cómo subir archivos más pesados. Pero hay **dos límites
distintos**, y el segundo es el que de verdad te frena:

| Límite | Plan gratuito | Tu situación |
|---|---|---|
| Tamaño por archivo | 50 MB | 18 videos lo pasan |
| **Espacio total** | **1 GB** | **Necesitas 1,77 GB** |
| Descarga al mes | 5 GB | ~330 reproducciones y se acabó |

**Aunque subieras el límite por archivo, no te entran.** Tienes 1,77 GB y el
plan gratuito da 1 GB. Ese es el muro real.

## Las tres salidas

### ⭐ Opción 1 — Comprimir los videos (la que recomiendo)

Tus videos están **enormes para lo que muestran**. Un ejercicio de rehabilitación
es una persona quieta en un fondo fijo haciendo un movimiento lento: es el tipo
de video que **más se comprime**.

Grabados en 1080p o 4K desde un celular, a 90 MB de promedio. A 720p —que es de
sobra para ver una técnica— **bajan entre 10 y 20 veces**:

```
1,77 GB   →   entre 120 y 250 MB
90 MB     →   entre 5 y 15 MB por video
```

Con eso: entran en el plan gratuito, ninguno pasa los 50 MB, suben en segundos,
y **el médico los ve al instante en vez de esperar**.

**Qué pierdes:** nada que importe aquí. 720p en una pantalla de consultorio se
ve bien. No estás haciendo cine.

#### Cómo hacerlo

1. Instalar ffmpeg:
   ```bash
   winget install Gyan.FFmpeg
   ```
   (cerrar y volver a abrir la terminal después)

2. Comprimir toda la carpeta de una vez:
   ```bash
   cd "C:/Users/WARA/OneDrive - Escuela Militar de Ingenieria/Desktop/catalogo_de_ejercicios"
   mkdir -p comprimidos/cadera comprimidos/RODILLA
   for f in cadera/*.mp4 RODILLA/*.mp4; do ffmpeg -i "$f" -vf "scale=-2:720" -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k -movflags +faststart "comprimidos/$f"; done
   ```

**Qué hace cada parte:**

| | |
|---|---|
| `scale=-2:720` | Baja a 720p manteniendo la proporción |
| `crf 28` | La calidad. Más alto = más chico. 28 es el punto justo para esto |
| `preset slow` | Tarda más en comprimir pero deja el archivo más chico |
| `+faststart` | **Importante**: deja que el video empiece a verse antes de descargarse entero |

Tarda entre 1 y 3 minutos por video. Déjalo corriendo mientras haces otra cosa.

3. **Revisa uno antes de subir todos.** Abre el comprimido y el original lado a
   lado. Si se ve bien, sigue. Si no, baja el `crf` a 24 (más pesado, mejor
   calidad).

### Opción 2 — Plan Pro de Supabase

**25 dólares al mes.** Sube a 100 GB de espacio y 50 GB por archivo. Tus videos
entran tal cual, sin tocar nada.

Vale la pena **si el sistema va a quedar en uso real** en COSSMIL. Para
sostener una defensa, es pagar por no comprimir.

### Opción 3 — YouTube o Vimeo, sin listar

Subes los videos ahí y guardas el enlace. La base **ya tiene la columna**
(`video_referencia_url`), así que funciona sin programar nada.

**En contra:** los videos salen de tu sistema. Si YouTube cambia algo o alguien
borra el canal, el catálogo se queda sin videos. Y para una tesis sobre un
sistema clínico, que el material esté afuera es difícil de defender.

---

## Tareas para Claude (después de comprimir)

### A.1 — Subida en lote desde el panel

Hoy hay que crear los 20 ejercicios uno por uno. Con la carpeta ya lista, tiene
que poder hacerse de una vez.

En `CatalogoEjercicios.jsx`, un botón **"Importar carpeta"** que:

1. Acepte varios archivos a la vez (`<input type="file" multiple>`)
2. **Adivine el nombre y la articulación del nombre del archivo.** Tus archivos
   ya traen todo: `APERTURA DE CADERA EN CUADRUPEDIA-cadera-ejercicio-10.mp4`
   → nombre *"Apertura de cadera en cuadrupedia"*, articulación *cadera*
3. Muestre una **tabla de revisión** antes de subir nada, donde se pueda
   corregir cada nombre, articulación y ángulos
4. Suba uno por uno con su barra de progreso, y **si uno falla, siga con los
   demás** y avise al final cuáles quedaron pendientes

> Lo importante es el paso 3. Adivinar el nombre está bien, pero **nadie debe
> guardar 20 ejercicios sin verlos antes**.

### A.2 — Avisar antes de que falle

Al elegir un archivo de más de 50 MB, avisar **en el momento**, con el peso
real y qué hacer:

> *"Este video pesa 207 MB y el máximo es 50 MB. Comprímelo antes de subirlo
> (mira `docs/PLAN_3_VIDEOS_Y_DISENO.md`)."*

Hoy deja elegirlo, empieza a subir, y falla al final. Después de dos minutos.

### A.3 — Vigilar el espacio

En el centro de control del administrador, mostrar **cuánto espacio queda**.
Con 1 GB y videos de 15 MB, son unos 60 videos. Conviene saberlo antes de
chocar con el muro, no después.

---

# PARTE B — El estado del paciente, en su propia columna

## Qué pasa hoy

En la lista de pacientes, el estado del tratamiento va **pegado al nombre**:

```
ANA SOFIA VARGAS PEREZ  [ALTA TEMPORAL]
JUAN CARLOS CONDORI MAMANI  [DE ALTA]
LUCIA BEATRIZ CHOQUE MENDOZA  [EN TRATAMIENTO]
```

Eso trae dos problemas:

1. **La columna del nombre queda desordenada.** Cada fila mide distinto, y con
   nombres largos la etiqueta se va a la siguiente línea.
2. **Hay dos "estados" compitiendo.** La columna que hoy dice ESTADO tiene el
   interruptor *Activo*, que es **otra cosa**: activo/inactivo es si la ficha
   se usa; en tratamiento/de alta es en qué punto va el paciente. Verlos
   separados, uno pegado al nombre y otro en su columna, confunde.

## Cómo queda

| CÓDIGO | PACIENTE | DIAGNÓSTICO | **TRATAMIENTO** | ÚLTIMA SESIÓN | **FICHA** | ACCIONES |
|---|---|---|---|---|---|---|
| PAC-0004 | AS · Ana Sofia Vargas<br>CI: 7000004 | Artrosis femorotibial… | 🔵 Alta temporal | 2026-09-13 | ✅ Activa | Ver expediente |
| PAC-0001 | JC · Juan Carlos Condori<br>CI: 7000001 | Gonartrosis bilateral… | 🔵 De alta | 2026-09-09 | ✅ Activa | Ver expediente |
| PAC-0006 | LB · Lucia Beatriz Choque<br>CI: 7000006 | Artrosis de rodilla… | 🟢 En tratamiento | Sin sesiones | ✅ Activa | Ver expediente |

**Tareas para Claude:**

1. En `ModuloPacientes.jsx`, sacar la etiqueta de al lado del nombre y crear la
   columna **TRATAMIENTO**, leyendo `estado_tratamiento`.

2. Colores fijos por estado, siempre los mismos en todo el sistema:

   | Estado | Color |
   |---|---|
   | En tratamiento | 🟢 verde |
   | De alta | 🔵 azul |
   | Alta temporal | 🔵 celeste |
   | Suspendido | 🟡 ámbar |
   | Abandono | ⚪ gris |
   | Derivado | 🟣 morado |

3. Renombrar la columna del interruptor a **FICHA** (Activa / Inactiva), para
   que se entienda que es otra cosa.

4. **Que el filtro "Estado" filtre por tratamiento**, no por activo/inactivo.
   Es lo que el médico busca: *"muéstrame los que siguen en tratamiento"*.
   Poner el de activo/inactivo como filtro aparte.

5. La columna del nombre queda solo con: avatar, nombre y CI.

---

# PARTE C — Estandarizar el diseño de todos los módulos

## El patrón ya existe

**La pantalla de Pacientes está bien resuelta.** No hay que inventar un diseño
nuevo: hay que **copiar ese** en todas las demás.

Tiene cuatro partes, siempre en el mismo orden:

```
┌─────────────────────────────────────────────────────────┐
│ [icono] Título                        [Botón principal] │  ← ENCABEZADO
│         Subtítulo explicando qué es                     │
├─────────────────────────────────────────────────────────┤
│ [🔍 Buscar...]  [Filtro ▾]  [Filtro ▾]     [Limpiar]   │  ← FILTROS
├─────────────────────────────────────────────────────────┤
│ COLUMNA    COLUMNA    COLUMNA         ACCIONES          │  ← CONTENIDO
│ dato       dato       dato            [Ver ...]         │
├─────────────────────────────────────────────────────────┤
│ Mostrando 1-4 de 4        ‹ 1 ›       Mostrar 6 ▾      │  ← PIE
└─────────────────────────────────────────────────────────┘
```

## Tareas para Claude

### C.1 — Sacar el patrón a componentes

Crear en `src/components/ui/`:

| Componente | Qué hace |
|---|---|
| `EncabezadoModulo.jsx` | Icono, título, subtítulo y botón principal |
| `BarraFiltros.jsx` | Buscador, filtros y "Limpiar" |
| `Tabla.jsx` | Cabecera, filas, "sin resultados" y "cargando" |
| `Paginacion.jsx` | "Mostrando X-Y de Z", números y "por página" |
| `Badge.jsx` | Las etiquetas de colores, **una sola definición** |
| `Avatar.jsx` | Foto o iniciales (ver ARREGLO 8 del plan 2) |
| `ModalBase.jsx` | Fondo oscuro y tarjeta centrada |
| `EstadoVacio.jsx` | Icono, mensaje y qué hacer |

**Sacar los colores de `theme.js`**, que ya existe. Hoy cada componente tiene su
propia constante `C = { navy: '#123C68', ... }` copiada — encontré esa misma
paleta repetida en cinco archivos. Si mañana cambia el verde institucional, hay
que tocarlos todos.

### C.2 — Aplicarlo módulo por módulo

En este orden, uno por vez:

| Módulo | Qué le falta hoy |
|---|---|
| **Catálogo de Ejercicios** | Tarjetas sin buscador ni filtro por articulación, sin paginación |
| **Agenda de Controles** | No sigue el patrón de encabezado ni de filtros |
| **Sesiones y Repeticiones** | Sin paginación; con muchas sesiones se vuelve inusable |
| **Evolución Clínica** | Sin encabezado estándar |
| **Mensajes y Avisos** | Sin buscador |
| **Usuarios y permisos** | Tabla con otro estilo |
| **Médicos** | Tarjetas con otro estilo |
| **Solicitudes de acceso** | Sin el patrón |
| **Auditoría** | Sin paginación — y es la que más filas va a tener |

### C.3 — Las reglas que no se negocian

1. **Toda lista lleva paginación.** Auditoría y Sesiones van a tener cientos de
   filas.
2. **Toda lista lleva buscador**, aunque hoy haya 4 registros.
3. **Toda pantalla vacía explica qué hacer**, no se queda en blanco:
   *"Todavía no hay ejercicios. Crea el primero con el botón de arriba."*
4. **Un mismo estado, un mismo color, en todo el sistema.** Si "en tratamiento"
   es verde en Pacientes, es verde en los Reportes y en las Altas.
5. **Toda acción que borra pregunta antes.**
6. **Todo error se ve.** Nada de fallar en silencio — es el problema que más
   veces apareció en este proyecto.

### C.4 — Que funcione en pantalla chica

El panel se usa en consultorio, a veces en una laptop de 13 pulgadas. Las tablas
tienen que poder desplazarse a lo ancho sin romper la página.

---

# En qué orden

```
PARTE A (comprimir)  →  PARTE B  →  PARTE C.1  →  PARTE C.2
```

**Por qué:**

- **A primero**, porque comprimir lo haces tú en tu computadora y tarda un rato.
  Déjalo corriendo mientras Claude trabaja en lo demás.
- **B** es corto y se nota al instante.
- **C.1** (los componentes) antes que **C.2** (aplicarlos). Si se hace al revés,
  se reescribe dos veces.

> **Si andas corta de tiempo:** la PARTE A es la única imprescindible — sin ella
> no tienes catálogo. La C es la que hace que el sistema se vea profesional en
> la defensa, pero ninguna pantalla deja de funcionar sin ella.
