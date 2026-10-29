import React, { useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  ChevronRight, ClipboardList, FileText, HeartPulse, TrendingUp,
  Users,
} from 'lucide-react';
import { C, TONES, BADGE, CHART, AVATARS_DARK } from '../theme';
import { HeroBanner as HeroPorRol } from './SuperadminViews';

const CARD = 'rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(16,40,64,.04),0_8px_24px_rgba(16,40,64,.05)]';
const TH = 'px-5 py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-[.08em]';
const TD = 'px-5 py-3';

// Guarda la foto en /public con este nombre. Si falta, el banner se ve
// igual pero sin imagen: no se rompe nada.
const HERO_IMG = '/doctor-fisioterapia.jpg';

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'US';

/* ==================================================================
   HERO DEL PROFESIONAL
   ================================================================== */
function HeroBanner({ currentUser }) {
  // El administrador tiene su propio banner (foto, frase y etiqueta).
  if (currentUser?.nombre_rol === 'superusuario') return <HeroPorRol currentUser={currentUser} />;

  const name = currentUser?.nombre_completo || currentUser?.nombre_usuario || 'Profesional COSSMIL';

  return (
    <section className={`relative overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
      <div
        className="absolute inset-y-0 right-0 hidden w-[62%] bg-cover bg-center lg:block"
        style={{ backgroundImage: `url('${HERO_IMG}')` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--c-white)_0%,var(--c-white)_36%,color-mix(in_srgb,var(--c-white)_94%,transparent)_46%,color-mix(in_srgb,var(--c-white)_62%,transparent)_60%,color-mix(in_srgb,var(--c-white)_18%,transparent)_76%,transparent_100%)]" />

      <div className="relative flex flex-wrap items-center gap-5 px-5 py-4">
        <div className="min-w-0 max-w-[430px] flex-1">
          <span className="block h-[3px] w-11 rounded-full" style={{ backgroundColor: C.green }} />

          <h1 className="mt-3 text-[24px] font-extrabold leading-[1.1] tracking-[-.02em] sm:text-[28px]" style={{ color: C.navy }}>
            Bienvenido,
            <br />
            <span className="text-[30px] sm:text-[36px]" style={{ color: C.green }}>{name}</span>
          </h1>

          <p className="mt-2 text-[12.5px] leading-[1.45]" style={{ color: C.body }}>
            Tu trabajo mejora la calidad de vida de nuestros pacientes.
          </p>

          <span
            className="mt-3 inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5"
            style={{ backgroundColor: C.mint, borderColor: TONES.green.tile }}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white dark:bg-slate-900">
              <ClipboardList className="h-[13px] w-[13px]" style={{ color: C.green }} strokeWidth={2.2} />
            </span>
            <span className="text-[11.5px] font-bold" style={{ color: C.navy }}>
              Departamento de Fisioterapia - COSSMIL
            </span>
          </span>
        </div>

        <div className="hidden max-w-[235px] shrink-0 xl:block">
          <p className="text-[12.5px] font-bold italic leading-[1.5]" style={{ color: C.navy }}>
            "La rehabilitación no es solo recuperar la función, es devolver la independencia"
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
            <span className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: down ? C.down : C.greenUp }}>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: C.mintTile }}>
            <Activity className="h-[17px] w-[17px]" style={{ color: C.green }} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: C.navy }}>Actividad de la plataforma</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: C.body }}>Usuarios y evaluaciones sincronizadas con Supabase</p>
          </div>
        </div>

        <div className="flex rounded-full p-0.5 text-[11.5px] font-bold" style={{ backgroundColor: C.fieldBg }}>
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
      </div>

      <div className="mt-4 flex flex-wrap gap-5 text-[11.5px] font-semibold" style={{ color: C.body }}>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART.serieA }} /> Pacientes activos
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART.serieB }} /> Sesiones registradas
        </span>
      </div>

      <div className="mt-2 w-full overflow-x-auto">
        <svg viewBox="0 0 720 240" className="h-[225px] w-full min-w-[480px]" role="img" aria-label="Actividad de los últimos 7 días">
          <defs>
            <linearGradient id="areaPacientesDoc" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={CHART.serieA} stopOpacity=".20" />
              <stop offset="100%" stopColor={CHART.serieA} stopOpacity="0" />
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
            fill="url(#areaPacientesDoc)"
          />
          <path d={toPath(SERIE_PACIENTES)} fill="none" stroke={CHART.serieA} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath(SERIE_SESIONES)} fill="none" stroke={CHART.serieB} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

          {SERIE_PACIENTES.map((v, i) => (
            <circle key={`p${i}`} cx={px(i, 7)} cy={py(v)} r="4" fill={CHART.serieA} stroke={CHART.dotStroke} strokeWidth="1.5" />
          ))}
          {SERIE_SESIONES.map((v, i) => (
            <circle key={`s${i}`} cx={px(i, 7)} cy={py(v)} r="4" fill={CHART.serieB} stroke={CHART.dotStroke} strokeWidth="1.5" />
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

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Users} label="Pacientes activos" value={`${activePercent}%`} note="+18% vs. mes anterior"
          bg={TONES.green.bg} tileBg={TONES.green.tile} iconColor={C.green} noteColor={C.greenUp} />
        <MiniStat icon={CalendarDays} label="Sesiones registradas" value={sessionCount} note="+15% vs. mes anterior"
          bg={TONES.blue.bg} tileBg={TONES.blue.tile} iconColor={TONES.blue.icon} noteColor={C.greenUp} />
        <MiniStat icon={ClipboardList} label="Evaluaciones realizadas" value={evaluations} note="+22% vs. mes anterior"
          bg={TONES.lilac.bg} tileBg={TONES.lilac.tile} iconColor={TONES.lilac.icon} noteColor={C.greenUp} />
        <MiniStat icon={TrendingUp} label="Mejora funcional" value="+62%" note="vs. inicio del tratamiento"
          bg={TONES.green.bg} tileBg={TONES.green.tile} iconColor={C.green} />
      </div>
    </article>
  );
}

/* ==================================================================
   SEGUIMIENTO PRIORITARIO  (lista lateral)
   ================================================================== */
const AVATAR_COLORS = AVATARS_DARK;

function PriorityList({ people, onViewPatientDetail, onViewChange }) {
  return (
    <article className={`flex flex-col ${CARD} p-5`} style={{ borderColor: C.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: C.mintTile }}>
            <HeartPulse className="h-[17px] w-[17px]" style={{ color: C.green }} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: C.navy }}>Seguimiento prioritario</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: C.body }}>{people.length} pacientes por revisar</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: C.mint, color: C.green }}>
          {people.length} activos
        </span>
      </div>

      <div className="mt-1 flex-1">
        {people.length === 0 ? (
          <p className="py-10 text-center text-[12.5px]" style={{ color: C.muted }}>
            No hay pacientes que requieran seguimiento.
          </p>
        ) : (
          people.map((person, i) => {
            const critical = person.painLevelCurrent >= 7;
            return (
              <div key={person.id ?? i} className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: C.border }}>
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {initials(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight" style={{ color: C.navy }}>{person.name}</p>
                  <p className="mt-0.5 truncate text-[11px]" style={{ color: C.body }}>
                    {person.diagnosis || 'Sin diagnóstico'}
                  </p>
                  <span
                    className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                    style={critical
                      ? { backgroundColor: BADGE.red.bg, color: BADGE.red.color }
                      : { backgroundColor: BADGE.amber.bg, color: BADGE.amber.color }}
                  >
                    {critical ? 'Dolor elevado' : 'Adherencia baja'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onViewPatientDetail(person.id)}
                  aria-label={`Ver ficha de ${person.name}`}
                  className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors hover:border-[var(--c-green)] hover:text-[var(--c-green)]"
                  style={{ borderColor: C.border, color: C.muted }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => onViewChange('pacientes')}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] py-3 text-[12.5px] font-bold transition-colors hover:brightness-95"
        style={{ backgroundColor: C.mint, color: C.green }}
      >
        <Users className="h-4 w-4" />
        Ver todos los pacientes
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
   DASHBOARD DEL PROFESIONAL
   ================================================================== */
export default function DashboardInicio({
  patients = [],
  citas = [],
  currentUser,
  onViewPatientDetail = () => {},
  onViewChange = () => {},
}) {
  const totalPatients = patients.length;
  const activePatients = patients.filter((p) => p.status === 'Activo').length;
  // Un solo criterio para "necesita seguimiento": lo usan tanto el contador
  // (KPI "Seguimiento" y el pill "N prioridades") como la tabla y la lista
  // lateral, para que nunca se contradigan entre sí.
  const pacientesEnSeguimiento = patients.filter((p) => p.complianceRate < 80 || p.painLevelCurrent >= 5);
  const pendingFollowUp = pacientesEnSeguimiento.length;
  const criticalPatients = pacientesEnSeguimiento;
  // La lista lateral es una tarjeta chica: se recorta a 4, pero solo con
  // pacientes que de verdad cumplen el criterio (nunca rellena con pacientes
  // sanos solo para completar el cupo).
  const priorityList = pacientesEnSeguimiento.slice(0, 4);
  const activePercent = totalPatients ? Math.round((activePatients / totalPatients) * 100) : 0;

  return (
    <main className="space-y-4 pb-6">
      <HeroBanner currentUser={currentUser} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          icon={Users} tone="green" title="Pacientes" subtitle="Registrados"
          value={totalPatients} delta="+12%" deltaLabel="vs. mes anterior"
          points="M 0 30 L 25 22 L 50 26 L 80 34 L 110 40 L 150 44 L 200 46"
          onClick={() => onViewChange('pacientes')}
        />
        <KpiCard
          icon={CalendarDays} tone="amber" title="Sesiones" subtitle="Programadas"
          value={citas.length} delta="+18%" deltaLabel="vs. semana anterior"
          points="M 0 40 L 28 34 L 52 40 L 80 30 L 110 38 L 140 32 L 170 40 L 200 44"
          onClick={() => onViewChange('sesiones')}
        />
        <KpiCard
          icon={AlertTriangle} tone="rose" title="Seguimiento" subtitle="Pendientes"
          value={pendingFollowUp} delta="-40%" deltaLabel="vs. semana anterior" trend="down"
          points="M 0 26 L 30 30 L 60 24 L 90 32 L 120 36 L 155 40 L 200 46"
          onClick={() => onViewChange('evolucion')}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
        <ActivityChart
          activePercent={activePercent}
          sessionCount={citas.length}
          evaluations={Math.max(0, totalPatients - pendingFollowUp)}
        />
        <PriorityList
          people={priorityList}
          onViewPatientDetail={onViewPatientDetail}
          onViewChange={onViewChange}
        />
      </section>

      {/* ============ Tabla de seguimiento ============ */}
      <section className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5"
          style={{ borderColor: C.border, backgroundColor: C.headBg }}
        >
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: C.navy }}>
              Pacientes que requieren seguimiento
            </h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: C.body }}>
              Adherencia baja o niveles de dolor elevados.
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: BADGE.red.bg, color: BADGE.red.color }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {pendingFollowUp} prioridades
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead style={{ backgroundColor: C.white, color: C.muted }}>
              <tr className="border-b" style={{ borderColor: C.border }}>
                <th className={TH}>Paciente</th>
                <th className={TH}>Diagnóstico</th>
                <th className={`${TH} text-center`}>Dolor</th>
                <th className={`${TH} text-center`}>Cumplimiento</th>
                <th className={`${TH} text-right`}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {criticalPatients.map((patient) => (
                <tr key={patient.id} className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60" style={{ borderColor: C.border }}>
                  <td className={TD}>
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10.5px] font-bold"
                        style={{ backgroundColor: C.mintTile, color: C.green }}
                      >
                        {initials(patient.name)}
                      </span>
                      <span className="text-[12.5px] font-bold" style={{ color: C.navy }}>{patient.name}</span>
                    </div>
                  </td>
                  <td className={`${TD} max-w-[260px] truncate text-[11.5px]`} style={{ color: C.body }}>
                    {patient.diagnosis}
                  </td>
                  <td className={`${TD} text-center`}>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={patient.painLevelCurrent >= 7
                        ? { backgroundColor: BADGE.red.bg, color: BADGE.red.color }
                        : { backgroundColor: BADGE.amber.bg, color: BADGE.amber.color }}
                    >
                      {patient.painLevelCurrent}/10
                    </span>
                  </td>
                  <td className={TD}>
                    <div className="mx-auto flex max-w-[130px] items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: C.grid }}>
                        <i
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, patient.complianceRate))}%`,
                            backgroundColor: patient.complianceRate < 70 ? C.dangerStr : C.warn,
                          }}
                        />
                      </span>
                      <b className="text-[11px]" style={{ color: C.body }}>{patient.complianceRate}%</b>
                    </div>
                  </td>
                  <td className={`${TD} text-right`}>
                    <button
                      type="button"
                      onClick={() => onViewPatientDetail(patient.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:brightness-110"
                      style={{ backgroundColor: C.green }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver ficha
                    </button>
                  </td>
                </tr>
              ))}
              {criticalPatients.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-[12.5px]" style={{ color: C.muted }}>
                    No hay pacientes que requieran seguimiento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <StatusBar />
    </main>
  );
}
