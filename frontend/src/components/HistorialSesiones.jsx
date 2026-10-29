import React, { useState, useMemo } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2,
  LayoutGrid, List, Flame, Calendar, Dumbbell
} from 'lucide-react';
import { C, CARD, TD } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import FilterDropdown from './ui/FilterDropdown';
import PacienteCombobox from './ui/PacienteCombobox';
import Tabla from './ui/Tabla';
import Paginacion from './ui/Paginacion';
import ModalResumenSesion from './ui/ModalResumenSesion';

const RESULTADO_FILTRO = {
  Correctas: 'correcto', Parciales: 'parcial', Incorrectas: 'incorrecto', Pendientes: 'pendiente',
};

const RESULTADO = {
  correcto: ['Correcta', 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', CheckCircle2],
  parcial: ['Parcial', 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', Activity],
  incorrecto: ['Incorrecta', 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30', AlertTriangle],
  pendiente: ['Pendiente', 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700', Activity],
};

const PALETA_EJERCICIOS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function HistorialSesiones({ patients = [], onViewPatientDetail }) {
  const [busqueda, setBusqueda] = useState('');
  const [pacienteFiltro, setPacienteFiltro] = useState('Todos');
  const [resultado, setResultado] = useState('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24); // 24 llena filas completas de 4 o 6 columnas
  const [vistaModo, setVistaModo] = useState('tarjetas');
  const [sesionSeleccionada, setSesionSeleccionada] = useState(null);

  const opcionesResultado = ['Todos', ...Object.keys(RESULTADO_FILTRO)];

  const listaPacientes = useMemo(() => {
    return (patients || []).map((p) => ({
      db_id: p.db_id,
      id: p.id,
      name: p.name,
      sessions: p.sessions || [],
    }));
  }, [patients]);

  const sesiones = useMemo(() => {
    const filas = [];
    for (const p of patients || []) {
      if (pacienteFiltro !== 'Todos' && p.name !== pacienteFiltro) continue;
      for (const s of p.sessions || []) {
        if (resultado !== 'Todos' && s.resultado !== RESULTADO_FILTRO[resultado]) continue;
        filas.push({ ...s, paciente: p.name, codigo: p.id, db_id: p.db_id });
      }
    }
    return filas.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [patients, pacienteFiltro, resultado]);

  const sesionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return sesiones;
    return sesiones.filter((s) =>
      [s.paciente, s.codigo, s.ejercicio].filter(Boolean).some((x) => x.toLowerCase().includes(q))
    );
  }, [sesiones, busqueda]);

  const totalPages = Math.max(1, Math.ceil(sesionesFiltradas.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = sesionesFiltradas.slice(from, from + pageSize);

  const resetFiltros = () => {
    setBusqueda('');
    setPacienteFiltro('Todos');
    setResultado('Todos');
    setPage(1);
  };

  // Cálculos estadísticos y desglose por ejercicio para el Donut Chart
  const metricas = useMemo(() => {
    let reps = 0;
    let ok = 0;
    const mapaEjercicios = {};

    sesionesFiltradas.forEach((s) => {
      const r = Number(s.repeticiones || 0);
      const c = Number(s.repeticionesCorrectas || 0);
      reps += r;
      ok += c;

      // Nombre limpio del ejercicio
      const ejKey = (s.ejercicio || 'Otros').replace(/_/g, ' ');

      if (!mapaEjercicios[ejKey]) {
        mapaEjercicios[ejKey] = { reps: 0, sesiones: 0 };
      }
      mapaEjercicios[ejKey].reps += r;
      mapaEjercicios[ejKey].sesiones += 1;
    });

    const totalSesiones = sesionesFiltradas.length;

    // Se incluyen TODOS los ejercicios presentes en las sesiones
    const desgloseEjercicios = Object.entries(mapaEjercicios)
      .map(([nombre, data], idx) => {
        // Si hay reps globales, calculamos pct por reps; si no, por cantidad de sesiones
        const valorPrincipal = reps > 0 ? data.reps : data.sesiones;
        const totalBase = reps > 0 ? reps : totalSesiones;
        const pct = totalBase > 0 ? Math.round((valorPrincipal / totalBase) * 100) : 0;

        return {
          nombre,
          reps: data.reps,
          sesiones: data.sesiones,
          valorMostrar: reps > 0 ? `${data.reps} reps` : `${data.sesiones} ses`,
          color: PALETA_EJERCICIOS[idx % PALETA_EJERCICIOS.length],
          pct: Math.max(pct, 5), // Mínimo 5% para que siempre sea visible en el anillo
          pctReal: pct,
        };
      })
      .sort((a, b) => b.sesiones - a.sesiones);

    const pctGlobal = reps > 0 ? Math.round((ok / reps) * 100) : 0;

    return {
      sesiones: totalSesiones,
      reps,
      ok,
      pct: pctGlobal,
      desgloseEjercicios,
    };
  }, [sesionesFiltradas]);

  const esFiltroIndividual = pacienteFiltro !== 'Todos';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-3 pb-3 animate-slide-in overflow-hidden">
      
      {/* 1. Encabezado */}
      <div className="shrink-0 flex items-center justify-between">
        <EncabezadoModulo
          icon={Activity}
          title="Sesiones y repeticiones"
          subtitle="Monitoreo de ejecuciones y precisión con visión artificial."
        />

        {/* Toggle Vista */}
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setVistaModo('tarjetas')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
              vistaModo === 'tarjetas'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Tarjetas</span>
          </button>
          <button
            type="button"
            onClick={() => setVistaModo('tabla')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
              vistaModo === 'tabla'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Tabla</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas KPI Contextuales con Gráficos Integrados */}
      <div className="grid shrink-0 gap-3 sm:grid-cols-5">
        
        {/* KPI 1: Sesiones (1 Columna) */}
        <div className={`col-span-1 px-4 py-3 flex flex-col justify-between ${CARD}`} style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {esFiltroIndividual ? 'Sesiones paciente' : 'Sesiones (Global)'}
            </span>
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{metricas.sesiones}</p>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-500 mt-1 block truncate" title={esFiltroIndividual ? pacienteFiltro : 'Total de todos los usuarios'}>
              {esFiltroIndividual ? pacienteFiltro : 'Total global'}
            </span>
          </div>
        </div>

        {/* KPI 2: Ejercicios y Repeticiones (2 Columnas completas) */}
        <div className={`col-span-2 px-4 py-3 flex items-center justify-between gap-4 ${CARD}`} style={{ borderColor: C.border }}>
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {esFiltroIndividual ? 'Ejercicios paciente' : 'Ejercicios realizados'}
              </span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {metricas.reps > 0 ? `${metricas.reps} reps` : `${metricas.desgloseEjercicios.length} tipos`}
              </span>
            </div>

            {/* Cuadrícula interna de 2 columnas para mostrar todos los ejercicios de las tarjetas */}
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 max-h-16 overflow-y-auto pr-1 custom-scroll">
              {metricas.desgloseEjercicios.length === 0 ? (
                <span className="col-span-2 text-[11px] text-slate-500 dark:text-slate-500 italic">Sin actividad registrada</span>
              ) : (
                metricas.desgloseEjercicios.map((ej) => (
                  <div key={ej.nombre} className="flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-950/30 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5 truncate mr-1" title={ej.nombre}>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ej.color }} />
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate capitalize">{ej.nombre}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      {ej.valorMostrar}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gráfico Donut representativo de todos los ejercicios */}
          <div className="h-16 w-16 shrink-0 relative flex items-center justify-center">
            {metricas.desgloseEjercicios.length === 0 ? (
              <Dumbbell className="h-7 w-7 text-slate-300 dark:text-slate-700" />
            ) : (
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {metricas.desgloseEjercicios.map((ej, index, arr) => {
                  let acumuladoPrevio = 0;
                  for (let i = 0; i < index; i++) {
                    acumuladoPrevio += arr[i].pctReal;
                  }
                  return (
                    <circle
                      key={ej.nombre}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke={ej.color}
                      strokeWidth="3.8"
                      strokeDasharray={`${ej.pctReal || 10} ${100 - (ej.pctReal || 10)}`}
                      strokeDashoffset={-acumuladoPrevio}
                    />
                  );
                })}
              </svg>
            )}
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 leading-none">
                {metricas.desgloseEjercicios.length}
              </span>
              <span className="text-[7.5px] uppercase font-bold text-slate-500 dark:text-slate-500">
                Ejs
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Repeticiones Correctas (1 Columna) */}
        <div className={`col-span-1 px-4 py-3 flex flex-col justify-between ${CARD}`} style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {esFiltroIndividual ? 'Correctas paciente' : 'Correctas (Total)'}
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{metricas.ok}</p>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-500 mt-1 block truncate">
              {metricas.reps > 0 ? `${metricas.ok} de ${metricas.reps} validadas` : 'Sin registros'}
            </span>
          </div>
        </div>

        {/* KPI 4: Porcentaje de Aciertos (1 Columna) */}
        <div className={`col-span-1 px-4 py-3 flex items-center justify-between gap-2 ${CARD}`} style={{ borderColor: C.border }}>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 block truncate">
              {esFiltroIndividual ? '% Acierto paciente' : '% Acierto global'}
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 leading-none">{metricas.pct}%</p>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-500 mt-1 block truncate">
              Tasa cumplimiento
            </span>
          </div>

          <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="transparent" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="transparent"
                stroke={metricas.pct >= 70 ? '#10b981' : metricas.pct >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="3.5"
                strokeDasharray={`${metricas.pct} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-slate-600 dark:text-slate-300">{metricas.pct}%</span>
          </div>
        </div>

      </div>

      {/* 3. Filtros */}
      <div className="shrink-0">
        <BarraFiltros
          searchValue={busqueda}
          onSearchChange={(v) => { setBusqueda(v); setPage(1); }}
          searchPlaceholder="Buscar por paciente, código o ejercicio..."
          onLimpiar={resetFiltros}
        >
          <PacienteCombobox
            pacientes={listaPacientes}
            value={pacienteFiltro}
            onChange={(v) => { setPacienteFiltro(v); setPage(1); }}
          />

          <FilterDropdown
            icon={CheckCircle2}
            label="Resultado"
            value={resultado}
            options={opcionesResultado}
            onChange={(v) => { setResultado(v); setPage(1); }}
          />
        </BarraFiltros>
      </div>

      {/* 4. Contenedor Principal: Tarjetas Steam o Tabla */}
      <div className={`flex flex-1 flex-col overflow-hidden min-h-0 ${CARD}`} style={{ borderColor: C.border }}>
        
        {vistaModo === 'tarjetas' ? (
          /* MODO TARJETAS */
          <div className="flex-1 overflow-y-auto p-4 custom-scroll">
            {pageRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                No hay sesiones disponibles con los filtros actuales.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {pageRows.map((s) => {
                  const pct = Math.min(100, Math.max(0, Number(s.porcentajeCorrectas || 0)));
                  const badgeColor = pct >= 80 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-500/30'
                                   : pct >= 50 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-500/30'
                                   : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-500/30';
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSesionSeleccionada(s)}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-3 hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-emerald-950/30 transition-all duration-300 cursor-pointer h-44"
                    >
                      <div>
                        <div className="h-16 w-full rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-950 flex flex-col justify-end p-2 border border-slate-200 dark:border-slate-800 group-hover:from-emerald-50 dark:group-hover:from-emerald-950/40 group-hover:to-white dark:group-hover:to-slate-900 transition-all">
                          <span className="text-[11px] font-extrabold capitalize text-slate-700 dark:text-slate-200 truncate block">
                            {(s.ejercicio || 'Sesión').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3 text-slate-400 dark:text-slate-500" /> {s.date}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                            {s.paciente}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-500 block">
                            {s.codigo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {pct}% aciertos
                        </span>
                        {s.dolorDespues != null && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <Flame className="h-3 w-3 text-amber-500" /> {s.dolorDespues}/10
                          </span>
                        )}
                      </div>

                      {/* HOVER OVERLAY */}
                      <div className="absolute inset-0 z-10 flex flex-col justify-between bg-white/97 dark:bg-slate-950/95 p-3 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                        <div>
                          <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 truncate">
                            {s.paciente}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                            {(s.ejercicio || 'Sesión').replace(/_/g, ' ')}
                          </p>

                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-500 dark:text-slate-400">Precisión</span>
                              <span className="text-slate-800 dark:text-slate-200">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-300 flex justify-between">
                            <span>Repeticiones:</span>
                            <b className="text-emerald-600 dark:text-emerald-400">{s.repeticionesCorrectas || 0}/{s.repeticiones || 0}</b>
                          </div>
                        </div>

                        <div className="w-full text-center py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/20">
                          Clic para ver dashboard
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* MODO TABLA RESUMIDA */
          <div className="flex-1 overflow-y-auto">
            <Tabla
              minWidth="800px"
              columnas={[
                { label: 'Paciente' }, { label: 'Fecha' }, { label: 'Ejercicio' },
                { label: 'Repeticiones' }, { label: '% Acierto' }, { label: 'Resultado' },
              ]}
              anchos={['w-[200px]', 'w-[120px]', '', 'w-[140px]', 'w-[140px]', 'w-[110px]']}
              filas={pageRows}
              pageSize={pageSize}
              mensajeVacio="No hay sesiones con esos filtros."
              renderFila={(s) => {
                const [label, tono, Icon] = RESULTADO[s.resultado] || RESULTADO.pendiente;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSesionSeleccionada(s)}
                    className="border-b transition-colors last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                    style={{ borderColor: C.border }}
                  >
                    <td className={TD}>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400">{s.paciente}</span>
                      <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-500">{s.codigo}</span>
                    </td>
                    <td className={`${TD} text-xs text-slate-500 dark:text-slate-400`}>{s.date}</td>
                    <td className={`${TD} text-xs font-semibold capitalize text-slate-600 dark:text-slate-300`}>
                      {(s.ejercicio || '—').replace(/_/g, ' ')}
                    </td>
                    <td className={`${TD} text-xs text-slate-600 dark:text-slate-300`}>
                      <b>{s.repeticionesCorrectas ?? 0}</b> de {s.repeticiones ?? 0}
                    </td>
                    <td className={TD}>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{s.porcentajeCorrectas ?? 0}%</span>
                    </td>
                    <td className={TD}>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tono}`}>
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                    </td>
                  </tr>
                );
              }}
            />
          </div>
        )}

        {/* 5. Paginación fija */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/60">
          <Paginacion
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            total={sesionesFiltradas.length}
            from={from}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            etiqueta="sesiones"
          />
        </div>
      </div>

      {/* 6. Modal Dashboard Detallado */}
      {sesionSeleccionada && (
        <ModalResumenSesion
          sesion={sesionSeleccionada}
          onClose={() => setSesionSeleccionada(null)}
          onViewPatientDetail={onViewPatientDetail}
        />
      )}
    </div>
  );
}