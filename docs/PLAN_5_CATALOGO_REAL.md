# Plan 5 — Cargar el catálogo real y arreglar su pantalla

> **Cómo usarlo:** en VS Code, una parte a la vez:
> *"Lee `docs/PLAN_5_CATALOGO_REAL.md` y ejecuta la PARTE D completa."*

| Parte | Qué resuelve | Dónde |
|---|---|---|
| **A** | Vaciar el catálogo de demo que hay hoy en Supabase | SQL + Storage |
| **B** | Preparar los 20 videos de tu carpeta (comprimir + miniaturas) | Tu computadora, `ffmpeg` |
| **C** | Sembrar los 20 ejercicios reales con sus parámetros clínicos | SQL + subida desde el panel |
| **D** | Que el catálogo entre en **una sola pantalla** | `CatalogoEjercicios.jsx` |
| **E** | Que la ventana flotante deje de irse hacia abajo | `CatalogoEjercicios.jsx`, `ModalBase.jsx`, `index.css` |
| **F** | Ver la **imagen del video** en la tarjeta y en el visor | `mappers.js`, `api.js`, `CatalogoEjercicios.jsx` |

**Orden:** E → D → F (son de pantalla, se ven al instante y no dependen de nada)
→ B (comprimir tarda, déjalo corriendo) → A → C.

> **Ojo con el orden A/C:** vaciar el catálogo borra también las rutinas
> recetadas. Hazlo cuando estés lista para cargar los nuevos, no antes.

---

# PARTE A — Vaciar el catálogo que hay hoy

## Qué hay ahora

Los ejercicios que ves salieron de `sql/2_DATOS.sql:508`: **10 de demostración**
(`ROD-01`, `CAD-01`, `TOB-01`, `HOM-01`…) que apuntan a videos que **nunca
existieron** (`rodilla/ROD-01.mp4`). Por eso ninguno reproduce nada.

## Lo que hay que saber antes de borrar

Dos tablas apuntan al catálogo:

| Tabla | Columna | Si borras el ejercicio |
|---|---|---|
| `prescripciones_ejercicio` | `id_ejercicio` **not null** (`sql:338`) | La receta se va con él |
| `sesiones` | `id_ejercicio` (acepta nulo) (`sql:358`) | La sesión queda sin ejercicio, pero no se pierde |

O sea: **borrar el catálogo borra las rutinas recetadas**. Como los ejercicios
nuevos tienen otros `id`, esas rutinas habría que rehacerlas igual.

## A.1 — Mirar antes de tocar

```sql
select e.id_ejercicio, e.codigo_fisioclin, e.nombre,
       (select count(*) from public.prescripciones_ejercicio p
         where p.id_ejercicio = e.id_ejercicio) as recetas,
       (select count(*) from public.sesiones s
         where s.id_ejercicio = e.id_ejercicio)  as sesiones
  from public.ejercicios_catalogo e
 order by e.codigo_fisioclin;
```

Si en `recetas` y `sesiones` solo hay datos de prueba, sigue. Si hay algo real,
pará y decidí qué conservar.

## A.2 — Vaciar

```sql
begin;

-- Las sesiones se conservan: solo se les quita el ejercicio que apuntaba.
update public.sesiones
   set id_ejercicio = null
 where id_ejercicio is not null;

-- Las recetas de demo se van (los ejercicios nuevos tendrán otros id).
delete from public.prescripciones_ejercicio;

delete from public.ejercicios_catalogo;

commit;

select count(*) as quedan from public.ejercicios_catalogo;   -- debe dar 0
```

## A.3 — Vaciar también los archivos

Los archivos del depósito **no se borran solos**. En el panel de Supabase:
**Storage → `ejercicios-videos` → seleccionar todo → Delete**.

Es a propósito que se hace a mano: borrar archivos desde SQL deja la fila
eliminada pero el archivo ocupando espacio.

Para comprobar que quedó limpio:

```sql
select count(*) as archivos, coalesce(sum((metadata->>'size')::bigint), 0) as bytes
  from storage.objects
 where bucket_id = 'ejercicios-videos';
```

---

# PARTE B — Preparar tus 20 videos

## Lo que hay en la carpeta, medido

`Desktop\catalogo_de_ejercicios` → **20 videos, 1,8 GB**.

| | Cadera | Rodilla |
|---|---|---|
| Videos | 10 | 10 |
| El más liviano | 50,2 MB | 30,8 MB |
| El más pesado | 105,3 MB | 207,9 MB |

**Contra los límites de hoy (tope por archivo ya en 100 MB):**

```
 2 de 20  pasan sin problema (menos de 50 MB)
13 de 20  entran, pero pesados (50–100 MB)
 5 de 20  NO entran: pasan de 100 MB
Total     1,8 GB  →  el plan gratuito da 1 GB
```

Los cinco que no entran:

| Video | Peso |
|---|---|
| EXTENSION Y FLEXION-RODILLA-ejercicio 1 | 207,9 MB |
| SUBIMOS Y BAJAMOS LA PIENA-RODILLA-ejercicio 2 | 170,6 MB |
| elevación lateral de pierna tumbado-rodilla-ejercicio 3 | 150,6 MB |
| sentadillla bulgara-rodilla-ejercicio-9 | 110,1 MB |
| RECTO ANTERIOR-cadera-ejercicio-7 | 100,4 MB |

**Conclusión sin rodeos:** aunque subiste el tope a 100 MB, con estos archivos
tal cual **no se puede cargar el catálogo**: cinco no entran por tamaño y el
conjunto no entra por espacio. Hay que comprimir. No es opcional.

## B.1 — Comprimir (una vez, deja correr)

```bash
winget install Gyan.FFmpeg
```
(cerrar y volver a abrir la terminal)

```bash
cd "C:/Users/WARA/OneDrive - Escuela Militar de Ingenieria/Desktop/catalogo_de_ejercicios"
mkdir -p comprimidos/cadera comprimidos/RODILLA
for f in cadera/*.mp4 RODILLA/*.mp4; do
  ffmpeg -i "$f" -vf "scale=-2:720" -c:v libx264 -crf 28 -preset slow \
         -c:a aac -b:a 96k -movflags +faststart "comprimidos/$f"
done
```

Esperado: **1,8 GB → entre 120 y 250 MB**, ninguno por encima de 20 MB.
Tarda 1–3 minutos por video.

> Revisa **uno** antes de subir los veinte. Si se ve bien a 720p, sigue.
> Si no, baja `-crf` a 24 (más pesado, mejor calidad).

## B.2 — Sacar la miniatura de cada video (para la PARTE F)

Del segundo 2 de cada video, para que no salga la persona a medio entrar:

```bash
mkdir -p posters/cadera posters/RODILLA
for f in cadera/*.mp4 RODILLA/*.mp4; do
  ffmpeg -ss 00:00:02 -i "$f" -frames:v 1 -vf "scale=-2:720" -q:v 3 "posters/${f%.mp4}.jpg"
done
```

Quedan 20 imágenes de ~80 KB. Son las que se van a ver en las tarjetas.

---

# PARTE C — Sembrar los 20 ejercicios reales

## De dónde salen los datos clínicos

No hay que inventar ángulos: ya están medidos en
`FisioClin/backend/cv-service/configuracion_ejercicios.json`, con el ROM
esperado, la postura y el criterio de ejecución de cada uno, validados por
fisioterapeuta. Y los códigos `C01…C10` / `R01…R10` son **las clases del modelo
LSTM** (`fisioclin_clases.json`), así que el catálogo queda enlazado con el
evaluador.

## El mapa: tu archivo → el ejercicio

Los nombres de tus archivos terminan en `ejercicio-N`, y ese número es el código.
Coinciden **los veinte, uno a uno**:

| Archivo | Código | Nombre en el catálogo | Articulación | ROM |
|---|---|---|---|---|
| `PUENTE-cadera.ejercicio-1` | C01 | Puente de glúteos | cadera | 0–30° |
| `LA CONCHA LADO DERECHO-…-2` | C02 | Clamshell (la concha) | cadera | 0–45° |
| `PATADA LATERAL LADO DERECHO-…-3` | C03 | Elevación lateral de pierna | cadera | 0–60° |
| `TWIST-cadera-ejercicio-4` | C04 | Rotación de cadera | cadera | 0–45° |
| `EXTENSIÓN DE CUADRICEPS CON COJÍN-…-5` | C05 | Extensión de rodilla con cojín | **rodilla** | 0–90° |
| `PSOAS Y RECTO ANTERIOR-…-6` | C06 | Flexión de cadera | cadera | 0–90° |
| `RECTO ANTERIOR-…-7` | C07 | Estiramiento del recto anterior | cadera | 0–120° |
| `EL BICHO MUERTO-…-8` | C08 | Dead bug (bicho muerto) | cadera | 0–90° |
| `EXTENSIÓN DE CADERA … CUADRUPEDIA-…-9` | C09 | Extensión de cadera en cuadrupedia | cadera | 0–30° |
| `APERTURA DE CADERA EN CUADRUPEDIA-…-10` | C10 | Apertura lateral en cuadrupedia | cadera | 0–45° |
| `EXTENSION Y FLEXION-RODILLA-…1` | R01 | Extensión y flexión de rodilla | rodilla | 0–135° |
| `SUBIMOS Y BAJAMOS LA PIENA-…2` | R02 | Elevación de pierna recta | rodilla | 0–45° |
| `elevación lateral de pierna tumbado-…3` | R03 | Abducción de cadera en decúbito | **cadera** | 0–60° |
| `hip thrust-…4` | R04 | Hip thrust | **cadera** | 0–30° |
| `levantamiento hacia atras-…5` | R05 | Extensión de rodilla en prono | rodilla | 0–120° |
| `elevacion de rodilla hacia el pecho-…6` | R06 | Flexión de rodilla al pecho | rodilla | 0–120° |
| `sentadilla con peso muerto-…7` | R07 | Sentadilla con peso muerto | rodilla | 0–90° |
| `sentadi profunda-…8` | R08 | Sentadilla profunda | rodilla | 0–120° |
| `sentadillla bulgara-…9` | R09 | Sentadilla búlgara | rodilla | 0–90° |
| `equilibrio-…10` | R10 | Equilibrio monopodal | rodilla | 0–30° |

> **Los tres marcados en negrita** están en una carpeta y trabajan otra
> articulación: C05 está en *cadera* pero mide **rodilla**; R03 y R04 están en
> *rodilla* pero miden **cadera**. En la tabla va la articulación que **se
> mide**, que es la que usan el goniómetro y el modelo. Si prefieres que el
> filtro los agrupe por carpeta, cámbialos — pero entonces el filtro deja de
> coincidir con lo que se evalúa.

## C.1 — El SQL de carga

Pegar en Supabase después de la PARTE A:

```sql
insert into public.ejercicios_catalogo
  (codigo_fisioclin, clase_lstm, nombre, descripcion, articulacion_objetivo,
   angulo_min_esperado, angulo_max_esperado, duracion_estimada_segundos,
   id_medico_creador, activo)
select v.codigo, v.codigo, v.nombre, v.descripcion, v.articulacion::public.articulacion,
       v.amin, v.amax, v.dur,
       (select m.id_medico from public.medicos m
         where m.tipo_profesional::text = 'medico_fisiatra'
         order by m.id_medico limit 1),
       true
  from (values
  ('C01','Puente de glúteos','Supino. Pelvis estable sin rotación; elevación completa de cadera.','cadera',0,30,40),
  ('C02','Clamshell (la concha)','Decúbito lateral. Rodillas separadas sin rotación pélvica.','cadera',0,45,40),
  ('C03','Elevación lateral de pierna','Decúbito lateral. Pierna recta sin rotación; tronco estable.','cadera',0,60,40),
  ('C04','Rotación de cadera','Supino. Control de la rotación sin compensación lumbar.','cadera',0,45,40),
  ('C05','Extensión de rodilla con cojín','Supino. Extensión completa sin dolor; control de la velocidad.','rodilla',0,90,40),
  ('C06','Flexión de cadera','Supino. Control de la flexión sin rotación pélvica.','cadera',0,90,40),
  ('C07','Estiramiento del recto anterior','Prono. Talón cerca del glúteo; sin dolor.','cadera',0,120,40),
  ('C08','Dead bug (bicho muerto)','Supino. Lumbar apoyada en el suelo; movimiento controlado.','cadera',0,90,40),
  ('C09','Extensión de cadera en cuadrupedia','Cuadrupedia. Cadera sin rotación; tronco estable.','cadera',0,30,30),
  ('C10','Apertura lateral en cuadrupedia','Cuadrupedia. Rodilla flexionada 90°; sin rotación de tronco.','cadera',0,45,40),
  ('R01','Extensión y flexión de rodilla','Supino. Extensión completa a 0°; flexión máxima sin dolor.','rodilla',0,135,40),
  ('R02','Elevación de pierna recta','Supino. Pierna recta; control en la bajada.','rodilla',0,45,40),
  ('R03','Abducción de cadera en decúbito','Semisentado. Pierna recta; tronco estable.','cadera',0,60,30),
  ('R04','Hip thrust','Supino. Elevación completa de cadera; alineación tronco-muslo.','cadera',0,30,40),
  ('R05','Extensión de rodilla en prono','De pie. Flexión máxima; control en la bajada.','rodilla',0,120,40),
  ('R06','Flexión de rodilla al pecho','De pie. Rodilla cerca del pecho; sin dolor.','rodilla',0,120,40),
  ('R07','Sentadilla con peso muerto','De pie. Espalda recta; rodillas sobre los pies.','rodilla',0,90,40),
  ('R08','Sentadilla profunda','De pie. Control de la profundidad; alineación de la rodilla.','rodilla',0,120,40),
  ('R09','Sentadilla búlgara','De pie. Rodilla delantera estable; tronco recto.','rodilla',0,90,40),
  ('R10','Equilibrio monopodal','De pie. Estabilidad sin oscilación excesiva; alineación.','rodilla',0,30,30)
  ) as v(codigo, nombre, descripcion, articulacion, amin, amax, dur);

select codigo_fisioclin, nombre, articulacion_objetivo,
       angulo_min_esperado, angulo_max_esperado
  from public.ejercicios_catalogo order by codigo_fisioclin;   -- deben salir 20
```

**Sobre la duración:** el JSON trae la duración *por repetición* (3 a 30 s), no
la de la serie. Acá va 40 s como estimación de serie, y 30 s en los tres de
sostén (C09, R03, R10). Es una columna suelta: se cambia después sin romper nada.

## C.2 — Subir los videos

Con los ejercicios ya creados, quedan dos caminos:

**Camino corto (hoy mismo):** desde el panel, *Catálogo → Editar* en cada
ejercicio → subir el video comprimido que le toca según la tabla de arriba.
Veinte veces. Con archivos de 10–15 MB cada subida es de segundos.

**Camino bueno (tarea para Claude):** el botón **"Importar carpeta"** del
`PLAN_3` A.1 — acepta varios archivos, adivina el código por el `ejercicio-N`
del nombre, muestra una **tabla de revisión** antes de subir nada, sube uno por
uno con su barra de progreso y, si uno falla, sigue con los demás y avisa al
final cuáles quedaron.

> Si vas corta de tiempo: el camino corto ya te deja el catálogo funcionando.
> El botón de importar es comodidad, no requisito.

---

# PARTE D — Que el catálogo entre en una sola pantalla

## Por qué hoy no entra

Las tarjetas están en una rejilla sin paginación (`CatalogoEjercicios.jsx:323`):
`grid-cols-1 sm:2 lg:3 xl:4` con imagen de `h-32` y texto de dos líneas.
Con 10 ejercicios de demo ya se hacía largo; **con 20 son cinco filas**: en una
laptop de 13" hay que bajar tres pantallas para ver el último.

Además el módulo **no usa el molde** que ya creaste en `src/components/ui/`
(`EncabezadoModulo`, `BarraFiltros`, `FilterDropdown`, `Paginacion`,
`EstadoVacio`): tiene su propio encabezado y su propia barra de búsqueda
escritos a mano (`:274-311`).

## Tareas para Claude

1. **Usar el molde.** Reemplazar el encabezado propio por `EncabezadoModulo`
   (icono `Dumbbell`, título "Catálogo de Ejercicios", subtítulo, botón
   "Nuevo Ejercicio") y la barra propia por `BarraFiltros` + `FilterDropdown`
   con **Limpiar**, igual que Pacientes.

2. **Paginar: 8 por página.** Con `xl:grid-cols-4` son **dos filas exactas**, que
   es lo que entra sin desplazarse en 1366×768. Usar el `Paginacion` de `ui/`,
   con el mismo pie: *"Mostrando 1-8 de 20"*, números, y "Mostrar 8 ▾"
   (8 / 12 / 24).

3. **Tarjeta más compacta**, para que entren las dos filas:
   - miniatura 16:9 de `h-28` (PARTE F),
   - nombre en una línea con `truncate`,
   - una sola línea de chips: articulación · ROM · duración · Video,
   - quitar la descripción de dos líneas de la tarjeta (va en el visor),
   - el botón "Editar" pasa a ser un icono de lápiz en la esquina; la tarjeta
     entera ya abre el visor.

4. **El filtro de articulación sale de los datos**, no de una lista fija: con el
   catálogo real son cadera y rodilla, y así no aparecen "tobillo" y "hombro"
   vacíos como ahora.

5. **Pantalla vacía con `EstadoVacio`**: *"El catálogo está vacío. Crea el primer
   ejercicio con el botón de arriba."*

**Cómo verificar:** con los 20 cargados, en una ventana de 1366×768 se ven el
encabezado, los filtros, 8 ejercicios y el pie **sin desplazar la página**.

---

# PARTE E — La ventana flotante que se va hacia abajo

## La causa (es una sola línea)

`CatalogoEjercicios.jsx:274` — el contenedor de todo el módulo:

```jsx
<div className="space-y-6 animate-slide-in">
```

Y la animación (`src/index.css:45-59`) termina en
`transform: translateY(0)` con `animation-fill-mode: forwards`.

Eso significa que **el transform queda aplicado para siempre**, y en CSS
un elemento con `transform` se convierte en el marco de referencia de todos sus
hijos con `position: fixed`. El modal (`:385`) y el visor (`:524`) están
**adentro** de ese div, así que su `fixed inset-0` ya no se mide contra la
ventana sino contra el módulo: arrancan debajo del encabezado y corridos por el
desplazamiento de la página. De ahí que la ventana "se vaya muy abajo" y el
fondo oscuro no cubra toda la pantalla.

Por eso en **Pacientes** no pasa: su contenedor (`ModuloPacientes.jsx:1734`) no
tiene `animate-slide-in`.

## Tareas para Claude

1. **La animación, sin `transform`.** En `src/index.css`, que `slideIn` anime
   solo `opacity`. El efecto casi no se nota y desaparece el problema de raíz:

   ```css
   @keyframes slideIn { from { opacity: 0 } to { opacity: 1 } }
   ```

2. **Los flotantes, en un portal.** Que `ModalBase.jsx` y `VisorEjercicio.jsx`
   se rendericen con `createPortal(…, document.body)`. Así no importa dónde se
   los invoque: siempre se anclan a la ventana. Es el arreglo que impide que
   esto vuelva a aparecer cuando alguien agregue otra animación.

3. Aplicar lo mismo al modal propio de `CatalogoEjercicios.jsx:385` (o, mejor,
   pasarlo a usar `ModalBase`, que para eso existe).

4. **Revisar los otros nueve módulos** que tienen `animate-slide-in` en su
   contenedor raíz y flotantes adentro: `AgendaCitas`, `EvaluacionGoniometro`,
   `GestionUsuarios`, `GraficosEvolucion`, `HistorialSesiones`,
   `MensajesPacientes`, `ModuloAccesos`, `PerfilMedico`, `Reportes`.

5. **Que el visor quepa siempre**: `max-h-[85vh]` en la tarjeta y
   `max-h-[55vh]` en el `<video>`, con el encabezado y la barra de acciones
   fijos y solo el contenido del medio desplazable. Hoy el video puede empujar
   los botones fuera de la vista en pantallas bajas.

**Cómo verificar:** abrir el catálogo, bajar hasta el último ejercicio, abrir el
visor. La ventana tiene que aparecer **centrada en la pantalla**, con el fondo
oscuro cubriendo todo, sin importar cuánto habías bajado.

---

# PARTE F — La imagen del video en la pantalla

## Por qué hoy sale un icono gris

- La base **ya tiene la columna**: `video_poster_path` (`sql:310`).
- Pero `mappers.js:173` devuelve **`image: null` siempre**, para todos los
  ejercicios.
- Y la tarjeta (`CatalogoEjercicios.jsx:335`) hace `ex.image ? <img> : <icono>`.

Como `image` nunca llega con nada, **siempre** cae en el icono de pesa. No es
que falte la foto: es que nadie la lee.

## F.1 — Permitir imágenes en el depósito (si no, la subida se rechaza)

El bucket `ejercicios-videos` solo acepta tipos de video
(`sql:1148`). Un `.jpg` se rechaza antes de empezar:

```sql
update storage.buckets
   set allowed_mime_types = array['video/mp4','video/quicktime','video/webm',
                                  'video/x-matroska','video/3gpp',
                                  'image/jpeg','image/webp']
 where id = 'ejercicios-videos';
```

Las miniaturas van al lado del video, en la misma carpeta del ejercicio
(`<id>/<archivo>.jpg`), así se borran juntas cuando se borra el ejercicio.

## F.2 — Tareas para Claude

1. **`mappers.js:173`** — `image` deja de ser `null` y pasa a leer
   `video_poster_path` (la ruta; el enlace firmado se resuelve en `api.js`).
2. **`api.js` → `cargarEjercicios` (`:666`)** — igual que ya hace con el video,
   firmar también el poster y devolverlo en `image`. Un solo `Promise.all`, sin
   llamadas extra por tarjeta.
3. **La tarjeta** ya está lista: al llegar `ex.image` con una URL, la muestra sola.
   Solo hay que dejarla en 16:9 (`aspect-video`) para que no se recorte la persona.
4. **El visor** — poner `poster={ejercicio.image}` en el `<video>`
   (`VisorEjercicio.jsx:110`). Así se ve el primer cuadro **antes** de darle
   play, en vez del rectángulo negro de ahora.
5. **Al subir un video nuevo**, generar la miniatura en el navegador: cargar el
   video en un `<video>` oculto, saltar al segundo 2, dibujarlo en un `<canvas>`,
   exportarlo como JPG y subirlo junto al video, guardando la ruta en
   `video_poster_path`. Así nadie tiene que acordarse de hacerlo aparte.
6. **Para los 20 de ahora**, las miniaturas ya salieron de la PARTE B.2: se
   suben a la misma carpeta del ejercicio y se guarda la ruta:

   ```sql
   update public.ejercicios_catalogo
      set video_poster_path = video_storage_path || '.jpg'   -- ajustar al nombre real
    where video_storage_path is not null;
   ```

**Cómo verificar:** el catálogo muestra 8 miniaturas reales de los ejercicios,
no ocho iconos grises iguales; y al abrir el visor se ve el cuadro del video
antes de darle play.

---

# Resumen

| | Antes | Después |
|---|---|---|
| **Catálogo** | 10 ejercicios de demo con videos que no existen | Los 20 reales, con ROM y códigos del modelo LSTM |
| **Videos** | 1,8 GB, 5 imposibles de subir | ~200 MB, todos por debajo de 20 MB |
| **Pantalla** | 20 tarjetas, tres pantallas de desplazamiento | 8 por página, todo a la vista |
| **Ventana flotante** | Se abría corrida hacia abajo | Centrada, por un portal |
| **Imagen** | Un icono gris para todos | La miniatura real de cada ejercicio |
