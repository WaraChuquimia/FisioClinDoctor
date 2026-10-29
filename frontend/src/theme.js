/* ==================================================================
   COSSMIL MEDICAL — TOKENS DE DISEÑO
   Fuente única de verdad. Cada pantalla debe importar de aquí en vez
   de declarar su propio objeto `C`, que es como aparecieron 16 verdes
   distintos repartidos por el proyecto.

       import { C, TONES, CARD, TH, TD } from '../theme';

   Regla: si un color no está en este archivo, no se usa. Si hace falta
   uno nuevo, se agrega aquí con su rol, no suelto en el componente.

   MODO OSCURO: cada valor de acá es un `var(--token)` definido dos
   veces en `index.css` (una vez bajo `:root`, otra bajo `:root.dark`).
   Ningún componente que use estos tokens necesita saber que existe un
   modo oscuro — cambia solo con la clase `dark` en <html>.
   ================================================================== */

/* ------------------------------------------------------------------
   1. COLOR
   ------------------------------------------------------------------ */
export const C = {
  /* --- Marca: verdes --- */
  green:      'var(--c-green)',      // acento principal: iconos, enlaces, foco, activos
  greenDeep:  'var(--c-greenDeep)',  // botones sólidos primarios, logo
  greenSoft:  'var(--c-greenSoft)',  // kickers ("BIENVENIDO AL"), textos de apoyo
  greenUp:    'var(--c-greenUp)',    // variaciones positivas (+12%), punto "sistema operativo"
  greenLine:  'var(--c-greenLine)',  // serie "pacientes activos" del gráfico
  greenOn:    'var(--c-greenOn)',    // texto sobre fondo menta (píldora activa del sidebar)

  /* --- Texto --- */
  navy:       'var(--c-navy)',       // títulos, cifras, texto principal
  body:       'var(--c-body)',       // párrafos y texto secundario
  muted:      'var(--c-muted)',      // etiquetas, metadatos, placeholders
  faded:      'var(--c-faded)',      // texto desactivado, "sin datos"
  iconDark:   'var(--c-iconDark)',   // iconos de la barra superior (campana)
  icon:       'var(--c-icon)',       // iconos neutros (hamburguesa, ayuda)

  /* --- Azules --- */
  blue:       'var(--c-blue)',       // icono e identidad de "Médicos"
  blueLine:   'var(--c-blueLine)',   // serie "sesiones registradas" del gráfico
  joint:      'var(--c-joint)',      // iconos anatómicos (rodilla / cadera)

  /* --- Superficies --- */
  white:      'var(--c-white)',
  pageBg:     'var(--c-pageBg)',     // fondo del área de contenido
  fieldBg:    'var(--c-fieldBg)',    // inputs y cajas internas
  headBg:     'var(--c-headBg)',     // cabeceras de tabla y de modal
  mint:       'var(--c-mint)',       // fondo de badges y botones suaves verdes
  mintTile:   'var(--c-mintTile)',   // tiles de icono verdes
  mintForm:   'var(--c-mintForm)',   // formularios destacados dentro del expediente

  /* --- Bordes --- */
  border:     'var(--c-border)',     // borde de cards y separadores de fila
  fieldBd:    'var(--c-fieldBd)',    // borde de inputs y controles
  grid:       'var(--c-grid)',       // rejilla de gráficos, barras de progreso

  /* --- Semánticos --- */
  danger:     'var(--c-danger)',     // icono de alerta
  dangerStr:  'var(--c-dangerStr)',  // botones destructivos
  down:       'var(--c-down)',       // variaciones negativas (-40%)
  warn:       'var(--c-warn)',       // icono de "sesiones"
  purple:     'var(--c-purple)',     // adjuntos tipo imagen, avatares
  purpleTxt:  'var(--c-purpleTxt)',  // "evaluaciones realizadas"
  teal:       'var(--c-teal)',
};

/* ------------------------------------------------------------------
   2. VARIANTES DE TARJETA  (KPI y tiles de icono)
   bg = fondo · tile = círculo del icono · icon = trazo · border = borde
   ------------------------------------------------------------------ */
export const TONES = {
  green: { bg: 'var(--tone-green-bg)', tile: 'var(--tone-green-tile)', icon: 'var(--tone-green-icon)', border: 'var(--tone-green-border)' },
  blue:  { bg: 'var(--tone-blue-bg)',  tile: 'var(--tone-blue-tile)',  icon: 'var(--tone-blue-icon)',  border: 'var(--tone-blue-border)' },
  amber: { bg: 'var(--tone-amber-bg)', tile: 'var(--tone-amber-tile)', icon: 'var(--tone-amber-icon)', border: 'var(--tone-amber-border)' },
  rose:  { bg: 'var(--tone-rose-bg)',  tile: 'var(--tone-rose-tile)',  icon: 'var(--tone-rose-icon)',  border: 'var(--tone-rose-border)' },
  lilac: { bg: 'var(--tone-lilac-bg)', tile: 'var(--tone-lilac-tile)', icon: 'var(--tone-lilac-icon)', border: 'var(--tone-lilac-border)' },
  teal:  { bg: 'var(--tone-teal-bg)',  tile: 'var(--tone-teal-tile)',  icon: 'var(--tone-teal-icon)',  border: 'var(--tone-teal-border)' },
};

/* ------------------------------------------------------------------
   3. BADGES DE ESTADO
   ------------------------------------------------------------------ */
export const BADGE = {
  green: { bg: 'var(--badge-green-bg)', color: 'var(--badge-green-color)' },
  amber: { bg: 'var(--badge-amber-bg)', color: 'var(--badge-amber-color)' },
  blue:  { bg: 'var(--badge-blue-bg)',  color: 'var(--badge-blue-color)' },
  red:   { bg: 'var(--badge-red-bg)',   color: 'var(--badge-red-color)' },
  slate: { bg: 'var(--badge-slate-bg)', color: 'var(--badge-slate-color)' },
};

// Estado clínico del paciente. `dot` alimenta el punto y el interruptor.
export const STATUS = {
  'Activo':         { bg: 'var(--status-activo-bg)',      color: 'var(--status-activo-color)',      dot: 'var(--status-activo-dot)' },
  'En seguimiento': { bg: 'var(--status-seguimiento-bg)', color: 'var(--status-seguimiento-color)', dot: 'var(--status-seguimiento-dot)' },
  'Inactivo':       { bg: 'var(--status-inactivo-bg)',    color: 'var(--status-inactivo-color)',    dot: 'var(--status-inactivo-dot)' },
};

// Tipos de registro del historial clínico.
export const TONO_HIST = {
  'Evaluación':  { dot: 'var(--hist-evaluacion-dot)',  bg: 'var(--hist-evaluacion-bg)',  color: 'var(--hist-evaluacion-color)' },
  'Evolución':   { dot: 'var(--hist-evolucion-dot)',   bg: 'var(--hist-evolucion-bg)',   color: 'var(--hist-evolucion-color)' },
  'Indicación':  { dot: 'var(--hist-indicacion-dot)',  bg: 'var(--hist-indicacion-bg)',  color: 'var(--hist-indicacion-color)' },
  'Radiografía': { dot: 'var(--hist-radiografia-dot)', bg: 'var(--hist-radiografia-bg)', color: 'var(--hist-radiografia-color)' },
  'Estudio':     { dot: 'var(--hist-estudio-dot)',     bg: 'var(--hist-estudio-bg)',     color: 'var(--hist-estudio-color)' },
};

/* ------------------------------------------------------------------
   4. SIDEBAR
   Escala propia: es la única superficie oscura de la aplicación
   incluso en modo claro, así que no depende del modo oscuro global.
   ------------------------------------------------------------------ */
export const SIDEBAR = {
  bgTop:      'var(--sb-bgTop)',
  bgMid:      'var(--sb-bgMid)',
  bgBot:      'var(--sb-bgBot)',
  gradient:   'linear-gradient(180deg, var(--sb-bgTop) 0%, var(--sb-bgMid) 48%, var(--sb-bgBot) 100%)',
  divider:    'var(--sb-divider)',
  brandSub:   'var(--sb-brandSub)',
  brandRule:  'var(--sb-brandRule)',
  gold:       'var(--sb-gold)',
  itemText:   'var(--sb-itemText)',
  groupLabel: 'var(--sb-groupLabel)',
  activeFrom: 'var(--sb-activeFrom)',
  activeTo:   'var(--sb-activeTo)',
  activeText: 'var(--sb-activeText)',
  accent:     'var(--sb-accent)',  // barra vertical de hover
  badge:      'var(--sb-badge)',   // círculo del contador
};

/* ------------------------------------------------------------------
   5. AVATARES
   Pasteles rotativos por índice de fila: AVATARS[i % AVATARS.length]
   ------------------------------------------------------------------ */
export const AVATARS = [
  { bg: '#DCEAFB', color: '#1E5A8A' },
  { bg: '#DCF1E6', color: '#0E8154' },
  { bg: '#E8DFF8', color: '#6D4BB8' },
  { bg: '#D9F0F5', color: '#0E7A8A' },
  { bg: '#FCECD2', color: '#B07711' },
  { bg: '#FBDFE8', color: '#B03A63' },
];

// Avatares oscuros para listas sobre fondo blanco (solicitudes de acceso).
export const AVATARS_DARK = ['#0E3D2E', '#1E5A8A', '#0E7A6B', '#5B3FA8'];

/* ------------------------------------------------------------------
   6. FORMA
   ------------------------------------------------------------------ */
export const RADIUS = {
  card:   '16px',   // tarjetas y paneles
  modal:  '18px',
  tile:   '13px',   // tiles de icono cuadrados
  field:  '10px',   // inputs, selects, botones
  chip:   '9999px', // badges y píldoras
};

export const SHADOW = {
  card:   '0 1px 2px rgba(16,40,64,.04), 0 6px 18px rgba(16,40,64,.05)',
  hover:  '0 10px 26px rgba(16,40,64,.08)',
  modal:  '0 24px 60px rgba(16,40,64,.28)',
  pop:    '0 8px 24px rgba(16,40,64,.14)',
  button: '0 3px 10px rgba(11,93,59,.22)',
};

/* ------------------------------------------------------------------
   7. TIPOGRAFÍA
   Escala en píxeles. No usar tamaños fuera de esta lista.
   ------------------------------------------------------------------ */
export const TEXT = {
  micro:   '9.5px',  // etiquetas de filtro
  tiny:    '10.5px', // notas al pie, badges pequeños
  label:   '11px',   // cabeceras de tabla (uppercase)
  meta:    '11.5px', // CI, metadatos, ayudas
  small:   '12px',   // celdas secundarias
  body:    '12.5px', // texto de tabla y párrafos
  base:    '13px',   // nombres, botones
  medium:  '13.5px', // notas clínicas
  strong:  '14px',   // subtítulos
  h3:      '17px',   // títulos de modal
  metric:  '19px',   // cifras de métricas
  h2:      '20px',   // títulos de página
  h1:      '21px',   // saludo del hero
  kpi:     '30px',   // cifras grandes de KPI
};

export const WEIGHT = {
  medium: 500,
  semi:   600,
  bold:   700,
  black:  800,
};

/* ------------------------------------------------------------------
   8. CLASES COMPARTIDAS
   Pegar tal cual en className para no reescribir la misma combinación.
   ------------------------------------------------------------------ */
export const CARD =
  'rounded-[16px] border bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(16,40,64,.04),0_6px_18px_rgba(16,40,64,.05)]';

export const TH = 'px-3.5 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-[.09em]';
export const TD = 'px-3.5 py-2.5';

export const BTN =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-bold transition-colors';

export const INPUT =
  'w-full rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]';

/* ------------------------------------------------------------------
   9. GRÁFICOS
   ------------------------------------------------------------------ */
export const CHART = {
  serieA:     '#1E8E5A',  // pacientes activos
  serieB:     '#3B82F6',  // sesiones registradas
  areaA:      'rgba(30,142,90,.20)',
  grid:       'var(--chart-grid)',
  axisText:   'var(--chart-axisText)',
  dotStroke:  'var(--chart-dotStroke)',
};
