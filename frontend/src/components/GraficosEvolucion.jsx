import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Award, Bone, CalendarDays, CheckSquare,
  HeartPulse, LineChart, RotateCcw, ShieldCheck, Users,
  TrendingUp
} from 'lucide-react';
import { C } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const promedio = (valores) => valores.length
  ? valores.reduce((total, valor) => total + valor, 0) / valores.length
  : null;
const mesClave = (fecha) => `${fecha.getFullYear()}-${fecha.getMonth()}`;
const normalizar = (valor) => String(valor ?? '').toLowerCase().replace(/_/g, ' ').trim();
const mesFiltro = (cantidad, hoy = new Date()) => new Date(hoy.getFullYear(), hoy.getMonth() - cantidad + 1, 1);
const esSesionMedida = (sesion) => Number(sesion.repeticiones) > 0
  && sesion.porcentajeCorrectas != null
  && Number.isFinite(Number(sesion.porcentajeCorrectas));
const esCompletada = (sesion) => sesion.completado || normalizar(sesion.status) === 'completada';
const fechaSesion = (sesion) => sesion.fechaHora ? new Date(sesion.fechaHora) : null;
const valorNumero = (valor) => {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

// -----------------------------------------------------------------------------
// Componentes UI Optimizados para Tema Oscuro
// -----------------------------------------------------------------------------

function Filtro({ label, value, onChange, children }) {
  return (
    <label className="min-w-[140px] flex-1">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      >
        {children}
      </select>
    </label>
  );
}

function Indicador({ icon: Icon, label, value, detalle, color, tone = 'blue' }) {
  const tones = {
    blue: 'border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900/90 text-blue-600 dark:text-blue-400',
    emerald: 'border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-900/90 text-emerald-600 dark:text-emerald-400',
    purple: 'border-purple-200 dark:border-purple-500/30 bg-white dark:bg-slate-900/90 text-purple-600 dark:text-purple-400',
    amber: 'border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900/90 text-amber-600 dark:text-amber-400',
  };

  return (
    <article className={`min-w-0 rounded-2xl border p-4 shadow-lg shadow-slate-200/60 dark:shadow-black/20 ${tones[tone] || tones.blue}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <strong className="mt-2 block truncate text-2xl font-black text-slate-900 dark:text-slate-100">{value}</strong>
      <span className="mt-1 block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{detalle}</span>
    </article>
  );
}

// Gráfico Dual Unificado (ROM en ° y Dolor en EVA)
function UnifiedTrendChart({ labels, romValues, dolorValues, modo = 'ambas' }) {
  const width = 640;
  const height = 210;
  const left = 45;
  const right = 605;
  const top = 25;
  const bottom = 165;

  const validRom = romValues.filter((v) => v != null);
  const validDolor = dolorValues.filter((v) => v != null);

  const x = (idx) => labels.length < 2 ? (left + right) / 2 : left + idx * ((right - left) / (labels.length - 1));
  
  // Escala izquierda ROM (0 a 140°)
  const yRom = (val) => bottom - (val / 140) * (bottom - top);
  // Escala derecha EVA (0 a 10)
  const yDolor = (val) => bottom - (val / 10) * (bottom - top);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full overflow-visible">
        {/* Ejes y líneas de fondo */}
        {[0, 35, 70, 105, 140].map((val, idx) => {
          const yPos = yRom(val);
          const evaVal = Math.round((val / 140) * 10);
          return (
            <g key={idx}>
              <line x1={left} x2={right} y1={yPos} y2={yPos} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 3" />
              <text x={left - 8} y={yPos + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontWeight="bold">
                {val}°
              </text>
              <text x={right + 8} y={yPos + 3} textAnchor="start" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontWeight="bold">
                {evaVal}
              </text>
            </g>
          );
        })}

        {/* Eje X (Meses) */}
        {labels.map((lbl, idx) => (
          <text key={idx} x={x(idx)} y={bottom + 22} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" fontSize="10" fontWeight="bold">
            {lbl}
          </text>
        ))}

        {/* Serie 1: ROM Articular (Línea Cyan Sólida) */}
        {(modo === 'ambas' || modo === 'rom') && validRom.length > 0 && (
          <g>
            {labels.map((_, idx) => {
              const current = romValues[idx];
              const next = romValues[idx + 1];
              if (current == null || next == null) return null;
              return (
                <line
                  key={`l-rom-${idx}`}
                  x1={x(idx)} y1={yRom(current)}
                  x2={x(idx + 1)} y2={yRom(next)}
                  stroke="#06b6d4" strokeWidth="3" strokeLinecap="round"
                />
              );
            })}
            {romValues.map((val, idx) => val == null ? null : (
              <g key={`p-rom-${idx}`}>
                <circle cx={x(idx)} cy={yRom(val)} r="4.5" fill="#06b6d4" className="stroke-white dark:stroke-[#083344]" strokeWidth="2" />
                <text x={x(idx)} y={yRom(val) - 9} textAnchor="middle" className="fill-cyan-600 dark:fill-cyan-300" fontSize="10" fontWeight="bold">
                  {val}°
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Serie 2: Dolor EVA (Línea Violeta Punteada) */}
        {(modo === 'ambas' || modo === 'dolor') && validDolor.length > 0 && (
          <g>
            {labels.map((_, idx) => {
              const current = dolorValues[idx];
              const next = dolorValues[idx + 1];
              if (current == null || next == null) return null;
              return (
                <line
                  key={`l-dol-${idx}`}
                  x1={x(idx)} y1={yDolor(current)}
                  x2={x(idx + 1)} y2={yDolor(next)}
                  stroke="#a855f7" strokeWidth="2.5" strokeDasharray="4 2" strokeLinecap="round"
                />
              );
            })}
            {dolorValues.map((val, idx) => val == null ? null : (
              <g key={`p-dol-${idx}`}>
                <circle cx={x(idx)} cy={yDolor(val)} r="4.5" fill="#a855f7" className="stroke-white dark:stroke-[#3b0764]" strokeWidth="2" />
                <text x={x(idx)} y={yDolor(val) + 16} textAnchor="middle" className="fill-purple-700 dark:fill-purple-300" fontSize="10" fontWeight="bold">
                  {val}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function DonutConcentric({ segments, center, subcenter }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let running = 0;
  const background = total
    ? `conic-gradient(${segments.map((segment) => {
        const start = (running / total) * 100;
        running += segment.value;
        return `${segment.color} ${start}%${(running / total) * 100}%`;
      }).join(', ')})`
    : C.grid;

  return (
    <div className="flex items-center gap-4 py-1">
      <div
        className="grid h-28 w-28 shrink-0 place-items-center rounded-full shadow-inner"
        style={{ background }}
      >
        <div className="grid h-20 w-20 content-center rounded-full bg-white dark:bg-slate-900 text-center border border-slate-200 dark:border-slate-800">
          <strong className="text-base font-black text-slate-900 dark:text-slate-100">{center}</strong>
          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-500">{subcenter}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 truncate text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate">{segment.label}</span>
            </span>
            <strong className="font-bold text-slate-700 dark:text-slate-200 ml-2">{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Componente Principal
// -----------------------------------------------------------------------------

export default function GraficosEvolucion({
  patients = [],
  profesionales = { todos: [] },
  enVivo = false,
  ultimaActualizacion = null,
  errorActualizacion = '',
}) {
  const [periodo, setPeriodo] = useState('6');
  const [articulacion, setArticulacion] = useState('todas');
  const [grado, setGrado] = useState('todos');
  const [profesional, setProfesional] = useState('todos');
  const [estado, setEstado] = useState('en tratamiento');
  const [modoGrafico, setModoGrafico] = useState('ambas'); // 'ambas' | 'rom' | 'dolor'

  const base = useMemo(() => {
    const limite = mesFiltro(Number(periodo));
    const articulaciones = [...new Set(patients.map((p) => normalizar(p.articulacion)).filter(Boolean))].sort();
    const grados = [...new Set(patients.map((p) => String(p.gradoArtrosis ?? '')).filter(Boolean))].sort();
    const profesionalesVisibles = profesionales?.todos || [];
    
    const filtrados = patients.filter((patient) => (
      (articulacion === 'todas' || normalizar(patient.articulacion) === articulacion)
      && (grado === 'todos' || String(patient.gradoArtrosis ?? '') === grado)
      && (profesional === 'todos'
        || String(patient.idMedicoTratante ?? '') === profesional
        || String(patient.idFisioterapeuta ?? '') === profesional)
      && (estado === 'todos' || normalizar(patient.estadoTratamiento) === estado)
    ));

    const sesiones = filtrados.flatMap((patient) => (patient.sessions || [])
      .map((session) => ({ ...session, patient }))
      .filter((session) => {
        const fecha = fechaSesion(session);
        return fecha && !Number.isNaN(fecha.getTime()) && fecha >= limite;
      }));

    const meses = [];
    const hoy = new Date();
    for (let index = Number(periodo) - 1; index >= 0; index -= 1) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - index, 1);
      meses.push({ clave: mesClave(fecha), label: MESES[fecha.getMonth()], sesiones: [] });
    }
    const porMes = new Map(meses.map((item) => [item.clave, item]));
    sesiones.forEach((session) => {
      const bucket = porMes.get(mesClave(fechaSesion(session)));
      if (bucket) bucket.sesiones.push(session);
    });

    const tendenciaAdherencia = meses.map((month) => {
      const measured = month.sesiones.filter(esSesionMedida);
      return measured.length ? Math.round(promedio(measured.map((s) => Number(s.porcentajeCorrectas)))) : null;
    });

    const tendenciaRom = meses.map((month) => {
      const values = month.sesiones.map((s) => valorNumero(s.romMaximo ?? s.anguloPromedio)).filter((v) => v != null && v > 0);
      return values.length ? Math.round(promedio(values)) : null;
    });

    const tendenciaDolor = meses.map((month) => {
      const values = month.sesiones.flatMap((s) => [valorNumero(s.dolorAntes), valorNumero(s.dolorDespues)])
        .filter((v) => v != null);
      return values.length ? Number(promedio(values).toFixed(1)) : null;
    });

    const sesionesMedidas = sesiones.filter(esSesionMedida);
    const repeticiones = sesiones.reduce((total, s) => total + (Number(s.repeticiones) || 0), 0);
    const repeticionesCorrectas = sesiones.reduce((total, s) => {
      const repeticionesSesion = Number(s.repeticiones) || 0;
      const correctasRegistradas = Number(s.repeticionesCorrectas) || 0;
      const porcentajeSesion = valorNumero(s.porcentajeCorrectas);
      const correctasEstimadas = porcentajeSesion == null ? 0 : Math.round(repeticionesSesion * porcentajeSesion / 100);
      return total + Math.min(repeticionesSesion, correctasRegistradas || correctasEstimadas);
    }, 0);

    const porcentajeCorrectas = repeticiones
      ? Math.round((repeticionesCorrectas / repeticiones) * 100)
      : (sesionesMedidas.length ? Math.round(promedio(sesionesMedidas.map((s) => Number(s.porcentajeCorrectas)))) : null);

    const porArticulacion = new Map();
    filtrados.forEach((patient) => {
      const nombre = patient.articulacion || 'Sin especificar';
      if (!porArticulacion.has(nombre)) porArticulacion.set(nombre, { label: nombre, patients: 0, improved: 0, measured: 0 });
      const group = porArticulacion.get(nombre);
      group.patients += 1;
      
      const prePost = (patient.evaluacionesPrePost || []).filter((entry) => {
        const fechaFinal = entry.fechaFinal ? new Date(entry.fechaFinal) : null;
        return entry.romInicial != null && entry.romFinal != null
          && fechaFinal && !Number.isNaN(fechaFinal.getTime()) && fechaFinal >= limite
          && (articulacion === 'todas' || normalizar(entry.articulacion) === articulacion);
      });
      const patientSessions = sesiones
        .filter((s) => s.patient.db_id === patient.db_id)
        .sort((a, b) => fechaSesion(a) - fechaSesion(b));
      const firstRom = patientSessions.find((s) => valorNumero(s.romMaximo) != null);
      const lastRom = [...patientSessions].reverse().find((s) => valorNumero(s.romMaximo) != null);
      const romImproved = prePost.some((entry) => Number(entry.gananciaRom) > 0)
        || (firstRom && lastRom && Number(lastRom.romMaximo) > Number(firstRom.romMaximo));
      const painImproved = patientSessions.some((s) => (
        valorNumero(s.dolorAntes) != null && valorNumero(s.dolorDespues) != null
        && Number(s.dolorAntes) > Number(s.dolorDespues)
      ));
      if (firstRom || prePost.length || patientSessions.some((s) => valorNumero(s.dolorAntes) != null)) {
        group.measured += 1;
        if (romImproved || painImproved) group.improved += 1;
      }
    });

    const treatmentCounts = {
      en_tratamiento: filtrados.filter((p) => normalizar(p.estadoTratamiento) === 'en tratamiento' && p.status === 'Activo').length,
      alta: filtrados.filter((p) => normalizar(p.estadoTratamiento) === 'alta').length,
      seguimiento: filtrados.filter((p) => normalizar(p.estadoTratamiento) === 'abandono' || normalizar(p.estadoTratamiento) === 'abandonado').length,
    };

    const painDeltas = sesiones.map((s) => {
      const before = valorNumero(s.dolorAntes);
      const after = valorNumero(s.dolorDespues);
      return before == null || after == null ? null : before - after;
    }).filter((v) => v != null);

    const favorables = [...porArticulacion.values()].reduce((total, g) => total + g.improved, 0);
    const mejorables = [...porArticulacion.values()].reduce((total, g) => total + g.measured, 0);
    const articulacionCounts = [...porArticulacion.values()].sort((a, b) => b.patients - a.patients);

    return {
      filtrados, sesiones, meses, tendenciaAdherencia, tendenciaRom, tendenciaDolor,
      sesionesCompletadas: sesiones.filter(esCompletada).length,
      adherencia: promedio(sesionesMedidas.map((s) => Number(s.porcentajeCorrectas))),
      reduccionDolor: promedio(painDeltas),
      favorables, mejorables, articulacionCounts, treatmentCounts,
      porcentajeCorrectas,
      repeticionesIncorrectas: Math.max(0, repeticiones - repeticionesCorrectas),
      repeticionesCorrectas,
      repeticiones,
      articulaciones, grados, profesionalesVisibles,
      pacientesActivos: filtrados.filter((p) => p.status === 'Activo').length,
    };
  }, [patients, periodo, articulacion, grado, profesional, estado, profesionales]);

  const articulacionesOptions = useMemo(() => [...new Set(patients.map((p) => normalizar(p.articulacion)).filter(Boolean))].sort(), [patients]);
  const gradosOptions = useMemo(() => [...new Set(patients.map((p) => String(p.gradoArtrosis ?? '')).filter(Boolean))].sort(), [patients]);
  const hora = ultimaActualizacion?.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-4 pb-5 animate-slide-in text-slate-900 dark:text-slate-100">

      {/* 1. Encabezado */}
      <EncabezadoModulo
        icon={LineChart}
        title="Evolución clínica"
        subtitle="Indicadores de recuperación, adherencia y seguimiento del departamento de fisioterapia."
      >
        <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span className={`h-2.5 w-2.5 rounded-full ${errorActualizacion ? 'bg-red-500' : enVivo ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
          <span>{errorActualizacion ? 'Error al actualizar' : enVivo ? 'En vivo' : 'Reconectando'}</span>
          {hora && <span className="hidden sm:inline">· Actualizado: {hora}</span>}
        </div>
      </EncabezadoModulo>

      {/* 2. Barra de Filtros */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 shadow-lg shadow-slate-200/60 dark:shadow-black/20">
        <Filtro label="Periodo" value={periodo} onChange={setPeriodo}>
          <option value="1">Último mes</option>
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </Filtro>
        <Filtro label="Articulación" value={articulacion} onChange={setArticulacion}>
          <option value="todas">Todas</option>
          {articulacionesOptions.map((item) => (
            <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
          ))}
        </Filtro>
        <Filtro label="Grado artrosis" value={grado} onChange={setGrado}>
          <option value="todos">Todos</option>
          {gradosOptions.map((item) => <option key={item} value={item}>Grado {item}</option>)}
        </Filtro>
        <Filtro label="Profesional" value={profesional} onChange={setProfesional}>
          <option value="todos">Todos</option>
          {base.profesionalesVisibles.map((item) => (
            <option key={item.id_medico} value={item.id_medico}>{item.nombre_completo || item.name}</option>
          ))}
        </Filtro>
        <Filtro label="Estado tratamiento" value={estado} onChange={setEstado}>
          <option value="en tratamiento">En tratamiento</option>
          <option value="todos">Todos</option>
          <option value="alta">Alta</option>
          <option value="abandono">Abandono</option>
        </Filtro>
        <button
          type="button"
          onClick={() => { setPeriodo('6'); setArticulacion('todas'); setGrado('todos'); setProfesional('todos'); setEstado('en tratamiento'); }}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Limpiar
        </button>
      </section>

      {/* 3. Indicadores Clave (Corregido el Fondo Blanco en Tema Oscuro) */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Indicador
          icon={Users}
          label="Pacientes activos"
          value={base.pacientesActivos}
          detalle="En la selección actual"
          color="#3b82f6"
          tone="blue"
        />
        <Indicador
          icon={CalendarDays}
          label="Sesiones realizadas"
          value={base.sesionesCompletadas}
          detalle="Completadas en el periodo"
          color="#10b981"
          tone="emerald"
        />
        <Indicador
          icon={CheckSquare}
          label="Adherencia promedio"
          value={base.adherencia == null ? 'Sin datos' : `${Math.round(base.adherencia)}%`}
          detalle="Repeticiones correctas"
          color="#3b82f6"
          tone="blue"
        />
        <Indicador
          icon={HeartPulse}
          label="Reducción del dolor"
          value={base.reduccionDolor == null ? 'Sin datos' : `${base.reduccionDolor > 0 ? '-' : '+'}${Math.abs(base.reduccionDolor).toFixed(1)} pts`}
          detalle="Escala EVA por sesión"
          color="#a855f7"
          tone="purple"
        />
        <Indicador
          icon={Award}
          label="Evolución favorable"
          value={base.mejorables ? `${base.favorables} (${Math.round((base.favorables / base.mejorables) * 100)}%)` : 'Sin datos'}
          detalle={`${base.mejorables} pacientes con mediciones`}
          color="#10b981"
          tone="emerald"
        />
      </div>

      {/* 4. SECTOR CENTRAL: Gráfico Dual Unificado (ROM vs Dolor EVA) y Panel de Calidad */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_1fr]">
        
        {/* Panel Izquierdo: Gráfico Unificado */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between shadow-lg shadow-slate-200/60 dark:shadow-black/20">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Evolución Biomecánica y Sintomática
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Amplitud articular (ROM máx.) contrastada con la reducción del dolor (EVA).
              </p>
            </div>

            {/* Pestañas de modo */}
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setModoGrafico('ambas')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  modoGrafico === 'ambas' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Ambas
              </button>
              <button
                type="button"
                onClick={() => setModoGrafico('rom')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  modoGrafico === 'rom' ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                ROM (°)
              </button>
              <button
                type="button"
                onClick={() => setModoGrafico('dolor')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  modoGrafico === 'dolor' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Dolor (EVA)
              </button>
            </div>
          </div>

          <div className="mt-3">
            <UnifiedTrendChart
              labels={base.meses.map((m) => m.label)}
              romValues={base.tendenciaRom}
              dolorValues={base.tendenciaDolor}
              modo={modoGrafico}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                <span className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400" /> ROM máximo (°)
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold">
                <span className="h-2 w-2 rounded-full bg-purple-500 dark:bg-purple-400" /> Dolor promedio (EVA)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-500 font-medium">
              Eje izquierdo: Ángulo (0° - 140°) · Eje derecho: Escala EVA (0 - 10)
            </span>
          </div>
        </div>

        {/* Panel Derecho: Calidad de Ejecución (IA) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between shadow-lg shadow-slate-200/60 dark:shadow-black/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Calidad de ejecución</h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Repeticiones validadas por IA durante las sesiones del periodo.
            </p>
          </div>

          <div className="py-2">
            <DonutConcentric
              center={base.porcentajeCorrectas == null ? '—' : `${base.porcentajeCorrectas}%`}
              subcenter={`${base.sesiones.length} ses`}
              segments={[
                { label: 'Correctas', value: base.repeticionesCorrectas, color: '#10b981' },
                { label: 'Por corregir', value: base.repeticionesIncorrectas, color: '#f59e0b' },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Total repeticiones:</span>
              <b className="text-slate-800 dark:text-slate-200">{base.repeticiones}</b>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${base.porcentajeCorrectas || 0}%` }}
              />
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-500 italic">
              Supervisadas en tiempo real con la aplicacion movil.
            </p>
          </div>
        </div>

      </div>

      {/* 5. SECTOR INFERIOR: Resultado Terapéutico por Articulación y Estado de Pacientes */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        
        {/* Resultado por Articulación */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-lg shadow-slate-200/60 dark:shadow-black/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Resultado terapéutico por articulación</h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
            Pacientes con mediciones que mostraron mejoría en ROM o disminución del dolor.
          </p>

          {base.articulacionCounts.length ? (
            <div className="space-y-3.5">
              {base.articulacionCounts.map((item, index) => {
                const porcentaje = item.measured ? Math.round((item.improved / item.measured) * 100) : null;
                const color = COLORES[index % COLORES.length];
                return (
                  <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/30 p-3">
                    <div className="mb-1.5 flex justify-between gap-2 text-xs">
                      <span className="capitalize font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Bone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
                        {item.label} · <span className="text-slate-500 dark:text-slate-500 font-normal">{item.patients} pacientes</span>
                      </span>
                      <strong className="font-extrabold" style={{ color }}>
                        {porcentaje == null ? 'Sin mediciones' : `${porcentaje}% (${item.improved}/${item.measured})`}
                      </strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${porcentaje || 0}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-500">No hay pacientes con estos filtros.</p>
          )}
        </div>

        {/* Estado de Pacientes */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between shadow-lg shadow-slate-200/60 dark:shadow-black/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Distribución de pacientes</h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Situación del tratamiento dentro de la cohorte actual.
            </p>
          </div>

          <div className="py-2">
            <DonutConcentric
              center={base.filtrados.length}
              subcenter="pacientes"
              segments={[
                { label: 'En tratamiento', value: base.treatmentCounts.en_tratamiento, color: '#10b981' },
                { label: 'Alta médica', value: base.treatmentCounts.alta, color: '#3b82f6' },
                { label: 'Reevaluación', value: base.treatmentCounts.seguimiento, color: '#f59e0b' },
                {
                  label: 'Otros',
                  value: Math.max(0, base.filtrados.length - Object.values(base.treatmentCounts).reduce((sum, v) => sum + v, 0)),
                  color: '#ef4444'
                },
              ]}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
            <span>Total evaluados: <b>{base.filtrados.length}</b></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{base.treatmentCounts.en_tratamiento} activos</span>
          </div>
        </div>

      </div>

      {/* 6. Banner de Recomendación Clínica */}
      <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Seguimiento clínico sugerido</p>
            {base.filtrados.length === 0 ? (
              <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">No hay pacientes que coincidan con los filtros seleccionados.</p>
            ) : (
              <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
                {base.filtrados.filter((p) => p.status === 'Activo' && Number(p.complianceRate) < 60).length} pacientes activos presentan adherencia menor al 60%.
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
          {base.filtrados.length} pacientes · {base.sesiones.length} sesiones en periodo
        </span>
      </div>

    </div>
  );
}