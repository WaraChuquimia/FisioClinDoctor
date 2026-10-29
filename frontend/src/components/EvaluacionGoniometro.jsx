import React, { useEffect, useState, useMemo } from 'react';
import { Users, AlertTriangle, Ruler, LogOut } from 'lucide-react';
import * as api from '../lib/api';
import { TIPO_ALTA_LABEL } from '../lib/mappers';
import { C, CARD, TD } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import Tabla from './ui/Tabla';
import Paginacion from './ui/Paginacion';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// "Terminado" = no tiene plan activo, o el plan activo ya pasó su fecha
// estimada de fin. Mismo criterio que TabEvaluaciones en ModuloPacientes.jsx.
function estadoEvaluacion(patient) {
  const evaluaciones = patient.evaluaciones || [];
  const tieneInicial = evaluaciones.some((e) => e.momento === 'inicial');
  const tieneFinal = evaluaciones.some((e) => e.momento === 'final');
  const planActivo = patient.routine?.estado === 'activo';
  const planVencido = Boolean(patient.routine?.endDate) && patient.routine.endDate < hoyISO();

  if (!tieneInicial) return { label: 'Sin evaluación inicial', tono: 'gris' };
  if (!tieneFinal && (!planActivo || planVencido)) return { label: 'Falta evaluación final', tono: 'ambar' };
  if (!tieneFinal) return { label: 'En tratamiento', tono: 'azul' };
  return { label: 'Completo', tono: 'verde' };
}

const TONOS = {
  gris:  { bg: '#EEF3F7', color: '#64748B' },
  ambar: { bg: '#FEF3C7', color: '#92400E' },
  azul:  { bg: '#DBEAFE', color: '#1D4ED8' },
  verde: { bg: '#DCFCE7', color: '#15803D' },
};

const tabCls = (activo) =>
  `px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
    activo ? 'border-green-700 text-green-700' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
  }`;

// Módulo de la FASE 8: la pantalla del goniómetro.
//   · Pacientes -> efectividad: goniómetro inicial vs final (¿sirvió?)
//   · Altas     -> quién terminó tratamiento y cuánto ganó
export default function EvaluacionGoniometro({ patients, onViewPatient }) {
  const [tab, setTab] = useState('pacientes');
  const [altas, setAltas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab !== 'altas') return;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        setAltas(await api.cargarAltas());
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [tab]);

  return (
    <div className="space-y-3 pb-4 animate-slide-in">
      <EncabezadoModulo
        icon={Ruler}
        title="Evaluaciones"
        subtitle="Efectividad del tratamiento con goniómetro, antes y después."
      />

      <div className="flex items-center gap-2 border-b" style={{ borderColor: C.border }}>
        <button type="button" onClick={() => setTab('pacientes')} className={tabCls(tab === 'pacientes')}>
          <Users className="w-4 h-4" /> Pacientes
        </button>
        <button type="button" onClick={() => setTab('altas')} className={tabCls(tab === 'altas')}>
          <LogOut className="w-4 h-4" /> Altas
        </button>
      </div>

      {tab === 'pacientes' && <PacientesTab patients={patients} onViewPatient={onViewPatient} />}
      {tab === 'altas' && (
        <AltasTab filas={altas} cargando={cargando} error={error} onViewPatient={onViewPatient} />
      )}
    </div>
  );
}

function PacientesTab({ patients, onViewPatient }) {
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return patients || [];
    return (patients || []).filter((p) => [p.name, p.id].filter(Boolean).some((x) => x.toLowerCase().includes(q)));
  }, [patients, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = filtrados.slice(from, from + pageSize);

  return (
    <div className="space-y-3">
      <BarraFiltros
        searchValue={busqueda}
        onSearchChange={(v) => { setBusqueda(v); setPage(1); }}
        searchPlaceholder="Buscar por paciente o código..."
        onLimpiar={() => { setBusqueda(''); setPage(1); }}
      />

      <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <Tabla
          minWidth="820px"
          columnas={[
            { label: 'Paciente' }, { label: 'Articulación' }, { label: 'Estado' },
            { label: 'ROM inicial → final' }, { label: 'Ganancia' }, { label: '' },
          ]}
          anchos={['', 'w-[130px]', 'w-[170px]', 'w-[160px]', 'w-[110px]', 'w-[110px]']}
          filas={pageRows}
          pageSize={pageSize}
          mensajeVacio="No se encontraron pacientes."
          renderFila={(p) => {
            const estado = estadoEvaluacion(p);
            const tono = TONOS[estado.tono];
            const pp = (p.evaluacionesPrePost || [])[0];
            return (
              <tr key={p.id} className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60" style={{ borderColor: C.border }}>
                <td className={TD}>
                  <div className="text-[13px] font-bold" style={{ color: C.navy }}>{p.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>{p.id}</div>
                </td>
                <td className={`${TD} text-[12.5px]`} style={{ color: C.body }}>{capitalizar(p.articulacion)}</td>
                <td className={TD}>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap"
                    style={{ backgroundColor: tono.bg, color: tono.color }}
                  >
                    {estado.tono === 'ambar' && <AlertTriangle className="h-3 w-3" />}
                    {estado.label}
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap text-[12px]`} style={{ color: C.muted }}>
                  {pp ? `${pp.romInicial}° → ${pp.romFinal ?? '—'}°` : '—'}
                </td>
                <td className={`${TD} font-bold text-[12.5px]`} style={{ color: C.green }}>
                  {pp?.gananciaRom != null ? `+${pp.gananciaRom}°` : '—'}
                </td>
                <td className={TD}>
                  <button
                    type="button"
                    onClick={() => onViewPatient(p.id)}
                    className="cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ borderColor: C.border, color: C.navy }}
                  >
                    Ver ficha
                  </button>
                </td>
              </tr>
            );
          }}
        />

        <Paginacion
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          total={filtrados.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta="pacientes"
        />
      </div>
    </div>
  );
}

// Panel de altas (FASE 10): quién terminó, cuánto ganó, y sobre todo quién
// tiene un control vencido — esos son los pacientes a los que hay que llamar.
function AltasTab({ filas, cargando, error, onViewPatient }) {
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const vencidos = filas.filter((a) => a.controlVencido).length;

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((a) => [a.nombreCompleto, a.codigoAnonimo].filter(Boolean).some((x) => x.toLowerCase().includes(q)));
  }, [filas, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = filtradas.slice(from, from + pageSize);

  return (
    <div className="space-y-3">
      {vencidos > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {vencidos} paciente{vencidos === 1 ? '' : 's'} con control vencido — hay que llamarlo{vencidos === 1 ? '' : 's'}.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">{error}</div>
      )}

      <BarraFiltros
        searchValue={busqueda}
        onSearchChange={(v) => { setBusqueda(v); setPage(1); }}
        searchPlaceholder="Buscar por paciente o código..."
        onLimpiar={() => { setBusqueda(''); setPage(1); }}
      />

      <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <Tabla
          minWidth="880px"
          columnas={[
            { label: 'Paciente' }, { label: 'Tipo de alta' }, { label: 'Fecha' },
            { label: 'ROM inicial → final' }, { label: 'Ganancia' }, { label: 'Menos dolor' },
            { label: 'Control' }, { label: '' },
          ]}
          anchos={['', 'w-[130px]', 'w-[100px]', 'w-[150px]', 'w-[100px]', 'w-[100px]', 'w-[160px]', 'w-[110px]']}
          filas={pageRows}
          pageSize={pageSize}
          cargando={cargando}
          mensajeVacio="Todavía no se dio de alta a ningún paciente."
          renderFila={(a) => (
            <tr key={a.id} className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60" style={{ borderColor: C.border }}>
              <td className={TD}>
                <div className="text-[13px] font-bold" style={{ color: C.navy }}>{a.nombreCompleto}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{a.codigoAnonimo}</div>
              </td>
              <td className={`${TD} text-[12.5px]`} style={{ color: C.body }}>{TIPO_ALTA_LABEL[a.tipoAlta] || a.tipoAlta}</td>
              <td className={`${TD} whitespace-nowrap text-[12px]`} style={{ color: C.muted }}>{a.fechaAlta}</td>
              <td className={`${TD} whitespace-nowrap text-[12px]`} style={{ color: C.muted }}>
                {a.romInicial != null ? `${a.romInicial}° → ${a.romFinal ?? '—'}°` : '—'}
              </td>
              <td className={`${TD} font-bold text-[12.5px]`} style={{ color: C.green }}>
                {a.gananciaRom != null ? `+${a.gananciaRom}°` : '—'}
              </td>
              <td className={`${TD} text-[12px]`} style={{ color: C.muted }}>{a.reduccionDolor ?? '—'}</td>
              <td className={TD}>
                {!a.requiereControl ? (
                  <span style={{ color: C.faded }}>—</span>
                ) : a.controlVencido ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" /> Vencido: {a.fechaControlSugerida}
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-[10.5px]" style={{ color: C.muted }}>{a.fechaControlSugerida}</span>
                )}
              </td>
              <td className={TD}>
                <button
                  type="button"
                  onClick={() => onViewPatient(a.codigoAnonimo)}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ borderColor: C.border, color: C.navy }}
                >
                  Ver ficha
                </button>
              </td>
            </tr>
          )}
        />

        <Paginacion
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          total={filtradas.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta="altas"
        />
      </div>
    </div>
  );
}
