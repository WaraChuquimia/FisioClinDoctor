import React, { useState, useEffect } from 'react';
import * as api from '../lib/api';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  CheckCircle2, ChevronRight, ClipboardList, ShieldCheck, Stethoscope,
  TrendingUp, Users
} from 'lucide-react';

/* ==================================================================
   PALETA  (extraída del mockup)
   ================================================================== */
const C = {
  navy:      '#123C68',   // títulos y cifras
  body:      '#6E8AA6',   // párrafos
  muted:     '#93A6B9',   // meta, placeholders
  green:     '#0E8154',   // acento principal
  greenSoft: '#2FA36B',   // kickers
  greenDark: '#0B5D3B',   // hover de botones
  greenUp:   '#16A06A',   // deltas positivos
  red:       '#E15241',   // deltas negativos
  border:    '#E9EFF5',   // bordes de card
  grid:      '#EEF3F7',   // rejilla del gráfico
  fieldBg:   '#F6F9FC',   // inputs
  fieldBd:   '#DCE7F0',
  headBg:    '#F7FAFD',   // cabecera de tablas
  mint:      '#E7F6EE',
  mintTile:  '#DCF1E6',
};

// Fondo / tile / icono / borde de cada variante de tarjeta.
const TONES = {
  green: { bg: '#EAF7F0', tile: '#CDEBDB', icon: '#0E8154', border: '#D8EFE4' },
  blue:  { bg: '#EFF5FD', tile: '#D3E4F7', icon: '#1E5A8A', border: '#DEEAF8' },
  amber: { bg: '#FEF7EA', tile: '#FBE7C0', icon: '#C98A16', border: '#F8EAD2' },
  rose:  { bg: '#FDEEEE', tile: '#FAD7D5', icon: '#D64545', border: '#F8DEDD' },
};

const BADGE_TONES = {
  green: { bg: '#DCFCE7', color: '#15803D' },
  amber: { bg: '#FEF3C7', color: '#B45309' },
  blue:  { bg: '#DBEAFE', color: '#1D4ED8' },
  red:   { bg: '#FEE2E2', color: '#B91C1C' },
  slate: { bg: '#EEF3F7', color: '#5B7FA8' },
};

/* Clases compartidas para que todas las vistas se vean igual. */
const CARD = 'rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(16,40,64,.04),0_8px_24px_rgba(16,40,64,.05)]';

/* ==================================================================
   HERO POR ROL
   Guarda las dos fotos en /public con estos nombres. Si falta alguna,
   el banner se ve igual pero sin imagen: no se rompe nada.
   ================================================================== */
const HERO = {
  admin: {
    img: './administrativo.jpg',
    fallbackName: 'Administrador COSSMIL',
    subtitle: 'Gestiona pacientes, profesionales y el seguimiento de tratamientos de rehabilitación.',
    badge: 'Administración Institucional - COSSMIL',
    badgeIcon: ShieldCheck,
    quote: '"Mejores procesos, para una mejor atención a nuestros pacientes"',
  },
  clinico: {
    img: '/doctor-fisioterapia.jpg',
    fallbackName: 'Profesional COSSMIL',
    subtitle: 'Tu trabajo mejora la calidad de vida de nuestros pacientes.',
    badge: 'Departamento de Fisioterapia - COSSMIL',
    badgeIcon: ClipboardList,
    quote: '"La rehabilitación no es solo recuperar la función, es devolver la independencia"',
  },
};

const firstNames = (name) => (name || 'U').split(' ').slice(-2).map(x => x[0]).join('').toUpperCase();

/* ==================================================================
   PRIMITIVAS
   ================================================================== */
const Badge = ({ children, tone = 'green' }) => {
  const t = BADGE_TONES[tone] || BADGE_TONES.green;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
      style={{ backgroundColor: t.bg, color: t.color }}
    >
      {children}
    </span>
  );
};

function CardHead({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: C.mintTile }}>
          <Icon className="h-[17px] w-[17px]" style={{ color: C.green }} strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold leading-tight" style={{ color: C.navy }}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11.5px]" style={{ color: C.body }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ==================================================================
   HERO
   ================================================================== */
export function HeroBanner({ currentUser }) {
  // El rol decide foto, saludo, etiqueta y frase. Cualquier rol que no sea
  // superusuario entra al panel clínico.
  const isSuper = currentUser?.nombre_rol === 'superusuario';
  const cfg = isSuper ? HERO.admin : HERO.clinico;
  const BadgeIcon = cfg.badgeIcon;
  const name = currentUser?.nombre_completo || currentUser?.nombre_usuario || cfg.fallbackName;

  return (
    <section className={`relative overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
      {/* Foto de la mitad derecha, disuelta hacia la izquierda */}
      <div
        className="absolute inset-y-0 right-0 hidden w-[62%] bg-cover bg-center lg:block"
        style={{ backgroundImage: `url('${cfg.img}')` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_36%,rgba(255,255,255,.94)_46%,rgba(255,255,255,.62)_60%,rgba(255,255,255,.18)_76%,rgba(255,255,255,0)_100%)]" />

      <div className="relative flex flex-wrap items-center gap-5 px-5 py-4">
        <div className="min-w-0 max-w-[430px] flex-1">
          <span className="block h-[3px] w-11 rounded-full" style={{ backgroundColor: C.green }} />

          <h1 className="mt-2.5 text-[21px] font-extrabold leading-[1.15] tracking-[-.02em]" style={{ color: C.navy }}>
            Bienvenido, <span style={{ color: C.green }}>{name}</span>
          </h1>

          <p className="mt-1 text-[12.5px] leading-[1.45]" style={{ color: C.body }}>
            {cfg.subtitle}
          </p>

          <span
            className="mt-3 inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5"
            style={{ backgroundColor: C.mint, borderColor: '#CDEBDB' }}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white dark:bg-slate-900">
              <BadgeIcon className="h-[13px] w-[13px]" style={{ color: C.green }} strokeWidth={2.2} />
            </span>
            <span className="text-[11.5px] font-bold" style={{ color: C.navy }}>{cfg.badge}</span>
          </span>
        </div>

        <div className="hidden max-w-[235px] shrink-0 xl:block">
          <p className="text-[12.5px] font-bold italic leading-[1.5]" style={{ color: C.navy }}>
            {cfg.quote}
          </p>
          <span className="mt-2 block h-[3px] w-11 rounded-full" style={{ backgroundColor: C.green }} />
        </div>
      </div>
    </section>
  );
}

/* ==================================================================
   TARJETAS KPI
   ================================================================== */
function Sparkline({ id, color, points }) {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 w-full"
      viewBox="0 0 200 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${points} L 200 56 L 0 56 Z`} fill={`url(#${id})`} />
      <path d={points} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity=".5" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({ icon: Icon, title, subtitle, value, delta, deltaLabel, trend = 'up', tone, points, onClick }) {
  const t = TONES[tone];
  const down = trend === 'down';

  return (
    <article
      className="relative min-h-[158px] overflow-hidden rounded-[18px] border transition-shadow hover:shadow-[0_10px_26px_rgba(16,40,64,.08)]"
      style={{ backgroundColor: t.bg, borderColor: t.border }}
    >
      <Sparkline id={`spark-${tone}`} color={t.icon} points={points} />

      <div className="relative p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ backgroundColor: t.tile }}>
            <Icon className="h-[22px] w-[22px]" style={{ color: t.icon }} strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight" style={{ color: C.navy }}>{title}</span>
            <span className="mt-0.5 block text-[11.5px] font-medium" style={{ color: C.body }}>{subtitle}</span>
          </span>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <strong className="text-[30px] font-extrabold leading-none tracking-[-.02em]" style={{ color: C.navy }}>
            {value}
          </strong>
          <span className="mb-0.5">
            <span className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: down ? C.red : C.greenUp }}>
              {down ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
              {delta}
            </span>
            <span className="mt-0.5 block text-[10.5px]" style={{ color: C.muted }}>{deltaLabel}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        aria-label={`Ver ${title}`}
        className="absolute bottom-3 right-3 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(16,40,64,.12)] transition-transform hover:scale-105"
        style={{ color: t.icon }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

/* ==================================================================
   GRÁFICO DE ACTIVIDAD
   ================================================================== */
const DAYS = ['19 Ago', '20 Ago', '21 Ago', '22 Ago', '23 Ago', '24 Ago', '25 Ago'];
const SERIE_PACIENTES = [33, 38, 53, 56, 68, 80, 93];
const SERIE_SESIONES = [13, 18, 30, 26, 32, 32, 41];

// Área de dibujo dentro del viewBox 0 0 720 240.
const PLOT = { left: 40, right: 686, top: 16, bottom: 196 };
const px = (i, n) => PLOT.left + (i * (PLOT.right - PLOT.left)) / (n - 1);
const py = (v) => PLOT.bottom - (v / 100) * (PLOT.bottom - PLOT.top);
const toPath = (values) => values.map((v, i) => `${i ? 'L' : 'M'} ${px(i, values.length)} ${py(v)}`).join(' ');

function MiniStat({ icon: Icon, label, value, note, bg, tileBg, iconColor, noteColor }) {
  return (
    <div className="rounded-[12px] p-3" style={{ backgroundColor: bg }}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px]" style={{ backgroundColor: tileBg }}>
          <Icon className="h-[15px] w-[15px]" style={{ color: iconColor }} strokeWidth={2.1} />
        </span>
        <span className="text-[10.5px] font-semibold leading-tight" style={{ color: C.body }}>{label}</span>
      </div>
      <strong className="mt-2 block text-[18px] font-extrabold leading-none" style={{ color: C.navy }}>{value}</strong>
      <span className="mt-1 block text-[10px] font-semibold" style={{ color: noteColor || C.muted }}>{note}</span>
    </div>
  );
}

function ActivityChart({ activePercent, sessionCount, evaluations }) {
  const [range, setRange] = useState('7');

  return (
    <article className={`${CARD} p-5`} style={{ borderColor: C.border }}>
      <CardHead
        icon={Activity}
        title="Actividad de la plataforma"
        subtitle="Usuarios y evaluaciones sincronizadas con Supabase"
        right={
          <div className="flex rounded-full p-0.5 text-[11.5px] font-bold" style={{ backgroundColor: '#F1F6FA' }}>
            {[['7', '7 días'], ['30', '30 días']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className="cursor-pointer rounded-full px-3.5 py-1.5 transition-colors"
                style={range === key ? { backgroundColor: C.green, color: '#FFFFFF' } : { color: C.muted }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-5 text-[11.5px] font-semibold" style={{ color: C.body }}>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1E8E5A' }} /> Pacientes activos
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} /> Sesiones registradas
        </span>
      </div>

      {/* Gráfico */}
      <div className="mt-2 w-full overflow-x-auto">
        <svg viewBox="0 0 720 240" className="h-[225px] w-full min-w-[480px]" role="img" aria-label="Actividad de los últimos 7 días">
          <defs>
            <linearGradient id="areaPacientes" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1E8E5A" stopOpacity=".20" />
              <stop offset="100%" stopColor="#1E8E5A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 20, 40, 60, 80, 100].map((v) => (
            <g key={v}>
              <line x1={PLOT.left} y1={py(v)} x2={PLOT.right} y2={py(v)} stroke={C.grid} strokeWidth="1" />
              <text x={PLOT.left - 9} y={py(v) + 3.5} textAnchor="end" fill={C.muted} fontSize="10" fontWeight="500">{v}</text>
              <line x1={PLOT.right + 8} y1={py(v)} x2={PLOT.right + 13} y2={py(v)} stroke={C.muted} strokeWidth="1.3" />
              <line x1={PLOT.right + 8} y1={py(v) - 18} x2={PLOT.right + 13} y2={py(v) - 18} stroke={C.grid} strokeWidth="1.3" />
            </g>
          ))}

          <path
            d={`${toPath(SERIE_PACIENTES)} L ${PLOT.right} ${PLOT.bottom} L ${PLOT.left} ${PLOT.bottom} Z`}
            fill="url(#areaPacientes)"
          />
          <path d={toPath(SERIE_PACIENTES)} fill="none" stroke="#1E8E5A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath(SERIE_SESIONES)} fill="none" stroke="#3B82F6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

          {SERIE_PACIENTES.map((v, i) => (
            <circle key={`p${i}`} cx={px(i, 7)} cy={py(v)} r="4" fill="#1E8E5A" stroke="#FFFFFF" strokeWidth="1.5" />
          ))}
          {SERIE_SESIONES.map((v, i) => (
            <circle key={`s${i}`} cx={px(i, 7)} cy={py(v)} r="4" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1.5" />
          ))}

          {DAYS.map((label, i) => (
            <text
              key={label}
              x={px(i, 7)}
              y={PLOT.bottom + 25}
              textAnchor={i === 0 ? 'start' : i === DAYS.length - 1 ? 'end' : 'middle'}
              fill={C.muted}
              fontSize="10.5"
              fontWeight="500"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      {/* Mini indicadores */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Users} label="Pacientes activos" value={`${activePercent}%`} note="+18% vs. mes anterior"
          bg="#EAF7F0" tileBg="#CDEBDB" iconColor={C.green} noteColor={C.greenUp} />
        <MiniStat icon={CalendarDays} label="Sesiones registradas" value={sessionCount} note="+15% vs. mes anterior"
          bg="#EFF5FD" tileBg="#D3E4F7" iconColor="#1E5A8A" noteColor={C.greenUp} />
        <MiniStat icon={ClipboardList} label="Evaluaciones realizadas" value={evaluations} note="+22% vs. mes anterior"
          bg="#F4F0FC" tileBg="#E3D9F7" iconColor="#7C5CBF" noteColor={C.greenUp} />
        <MiniStat icon={TrendingUp} label="Mejora funcional" value="+62%" note="vs. inicio del tratamiento"
          bg="#EAF7F0" tileBg="#CDEBDB" iconColor={C.green} />
      </div>
    </article>
  );
}

/* ==================================================================
   SOLICITUDES DE ACCESO
   ================================================================== */
const AVATAR_COLORS = ['#0E3D2E', '#1E5A8A', '#0E7A6B', '#5B3FA8'];

function AccessRequests({ requests, onViewChange }) {
  const pending = requests.filter((r) => r.status === 'Pendiente');
  const list = requests.slice(0, 4);

  return (
    <article className={`flex flex-col ${CARD} p-5`} style={{ borderColor: C.border }}>
      <CardHead
        icon={ClipboardList}
        title="Solicitudes de acceso"
        subtitle={`${pending.length} pendientes de revisión`}
        right={
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: C.mint, color: C.green }}>
            {requests.length} nuevas
          </span>
        }
      />

      <div className="mt-1 flex-1">
        {list.length === 0 ? (
          <p className="py-10 text-center text-[12.5px]" style={{ color: C.muted }}>
            No hay solicitudes pendientes.
          </p>
        ) : (
          list.map((r, i) => (
            <div key={r.id ?? i} className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: C.border }}>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {firstNames(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold leading-tight" style={{ color: C.navy }}>{r.name}</p>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: C.body }}>
                  {r.specialty} · {r.time || r.date}
                </p>
                <span className="mt-1 inline-block">
                  <Badge tone={r.status === 'Pendiente' ? 'amber' : r.status === 'Rechazada' ? 'red' : 'green'}>
                    {r.status}
                  </Badge>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onViewChange('solicitudes')}
                aria-label={`Revisar solicitud de ${r.name}`}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors hover:border-[#0E8154] hover:text-[#0E8154]"
                style={{ borderColor: C.border, color: C.muted }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => onViewChange('solicitudes')}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] py-3 text-[12.5px] font-bold transition-colors hover:brightness-95"
        style={{ backgroundColor: C.mint, color: C.green }}
      >
        <CheckCircle2 className="h-4 w-4" />
        Ver todas las solicitudes
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

/* ==================================================================
   BARRA DE ESTADO
   ================================================================== */
function StatusBar() {
  const now = new Date();
  const stamp = `${now.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })} - ${now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]" style={{ color: C.muted }}>
      <span className="flex items-center gap-2">
        <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: C.greenUp }} />
        Sistema operativo
        <span style={{ color: C.border }}>|</span>
        Última sincronización: {stamp}
      </span>
      <span>COSSMIL Medical&nbsp;&nbsp;v1.0</span>
    </div>
  );
}

/* ==================================================================
   DASHBOARD
   ================================================================== */
function Dashboard({ onViewChange, requests, currentUser, patients = [], citas = [], usuarios = [] }) {
  // Cifras reales: salen de lo que RLS deja ver a esta sesión. Para el
  // superusuario eso es todo el sistema; para nadie más, este panel no se abre.
  const patientCount = patients.length;
  const doctorCount = usuarios.filter((u) => u.id_medico).length;
  const sessionCount = patients.reduce((acc, p) => acc + (p.sessions ? p.sessions.length : 0), 0);
  const citasProximas = citas.filter((c) => ['programada', 'confirmada'].includes(c.estado)).length;
  const pendientes = requests.filter((r) => r.status === 'Pendiente').length;
  const activos = patients.filter((p) => p.status === 'Activo').length;
  const activePercent = patientCount ? Math.round((activos / patientCount) * 100) : 0;

  return (
    <div className="space-y-4 pb-6">
      <HeroBanner currentUser={currentUser} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users} tone="green" title="Pacientes" subtitle="Registrados"
          value={patientCount} delta="+12%" deltaLabel="vs. mes anterior"
          points="M 0 30 L 25 22 L 50 26 L 80 34 L 110 40 L 150 44 L 200 46"
          onClick={() => onViewChange('pacientes')}
        />
        <KpiCard
          icon={Stethoscope} tone="blue" title="Médicos" subtitle="Profesionales"
          value={doctorCount} delta="+7%" deltaLabel="vs. mes anterior"
          points="M 0 44 L 30 40 L 55 26 L 85 20 L 115 30 L 150 40 L 200 46"
          onClick={() => onViewChange('medicos')}
        />
        <KpiCard
          icon={CalendarDays} tone="amber" title="Sesiones" subtitle="Programadas"
          value={citasProximas || sessionCount} delta="+18%" deltaLabel="vs. semana anterior"
          points="M 0 40 L 28 34 L 52 40 L 80 30 L 110 38 L 140 32 L 170 40 L 200 44"
          onClick={() => onViewChange('sesiones')}
        />
        <KpiCard
          icon={AlertTriangle} tone="rose" title="Solicitudes" subtitle="Pendientes"
          value={pendientes} delta="-40%" deltaLabel="vs. semana anterior" trend="down"
          points="M 0 26 L 30 30 L 60 24 L 90 32 L 120 36 L 155 40 L 200 46"
          onClick={() => onViewChange('solicitudes')}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
        <ActivityChart activePercent={activePercent} sessionCount={sessionCount} evaluations={patientCount * 4} />
        <AccessRequests requests={requests} onViewChange={onViewChange} />
      </section>

      <StatusBar />
    </div>
  );
}


/* ==================================================================
   ROUTER DE VISTAS
   App.jsx solo renderiza este componente con view="superadmin" (ver el
   case 'superadmin' en el switch de renderView), así que las demás ramas
   que solía tener este router (solicitudes/pacientes/médicos con datos de
   ejemplo y un "aprobar" que no llegaba a la base) nunca se ejecutaban: se
   quitaron. Las vistas reales de pacientes/solicitudes/médicos ya viven en
   ModuloPacientes y GestionUsuarios (esta última también absorbió, dentro
   de "Usuarios y permisos", lo que antes era la pantalla aparte de
   "Solicitudes de acceso").
   ================================================================== */
export default function SuperadminViews({ patients, currentUser, citas = [], onShowNotification, onViewChange }) {
  const [requests, setRequests] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [sols, us] = await Promise.all([api.cargarSolicitudes(), api.cargarUsuarios()]);
        setRequests((sols || []).map((r) => ({
          id: r.id_solicitud,
          name: r.nombre_completo,
          ci: r.cedula_profesional,
          email: r.email,
          role: r.tipo_profesional === 'medico_fisiatra' ? 'Médico fisiatra' : 'Fisioterapeuta',
          specialty: r.tipo_profesional,
          date: new Date(r.fecha_solicitud).toLocaleString('es-BO'),
          time: r.antiguedad || '',
          status: r.estado === 'pendiente' ? 'Pendiente' : r.estado === 'aprobada' ? 'Aprobada' : 'Rechazada',
        })));
        setUsuarios(us || []);
      } catch (err) {
        onShowNotification?.(err.message, 'error');
      }
    })();
  }, [onShowNotification]);

  return (
    <Dashboard
      onViewChange={onViewChange}
      requests={requests}
      currentUser={currentUser}
      patients={patients}
      citas={citas}
      usuarios={usuarios}
    />
  );
}
