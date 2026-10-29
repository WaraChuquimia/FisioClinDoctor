import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Activity, Calendar, Clock, TrendingUp, AlertTriangle, 
  CheckCircle2, ArrowUpRight, Flame, Award
} from 'lucide-react';

const seriesDeNotas = (notas) =>
  (notas || '').split(' · ').filter((p) => /^Serie \d+:/.test(p));

const parteDeNotas = (notas, prefijo) =>
  (notas || '').split(' · ').find((p) => p.startsWith(prefijo))?.slice(prefijo.length).trim() || null;

export default function ModalResumenSesion({ sesion, onClose, onViewPatientDetail }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!sesion) return null;

  const pct = Math.min(100, Math.max(0, Number(sesion.porcentajeCorrectas || 0)));
  const radio = 38;
  const circunferencia = 2 * Math.PI * radio;
  const offset = circunferencia - (pct / 100) * circunferencia;

  const colorDonut = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const series = seriesDeNotas(sesion.notes);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-bold text-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{sesion.paciente}</h3>
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                  {sesion.codigo}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="capitalize font-semibold text-slate-600 dark:text-slate-300">
                  {(sesion.ejercicio || 'Sesión').replace(/_/g, ' ')}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="h-3 w-3 text-slate-400 dark:text-slate-500" /> {sesion.date} {sesion.time}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dashboard Body */}
        <div className="space-y-4 overflow-y-auto p-5 text-slate-700 dark:text-slate-200 max-h-[75vh]">
          {/* Panel Superior: Gráfico Donut de Efectividad + Resumen de Repeticiones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Gráfico circular Donut */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Efectividad Global
              </span>
              <div className="relative flex items-center justify-center w-24 h-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radio}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="9"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radio}
                    stroke={colorDonut}
                    strokeWidth="9"
                    strokeDasharray={circunferencia}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100">{pct}%</span>
                  <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Aciertos</span>
                </div>
              </div>
            </div>

            {/* Tarjeta Repeticiones */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Repeticiones
                </span>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {sesion.repeticionesCorrectas ?? 0} <span className="text-sm font-semibold text-slate-500 dark:text-slate-500">/ {sesion.repeticiones ?? 0}</span>
                </p>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {parteDeNotas(sesion.notes, 'Avance:') || 'Ejecución registrada por cámara MediaPipe'}
              </div>
            </div>

            {/* Tarjeta Dolor EVA */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Dolor EVA
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 dark:text-slate-500 block">Antes</span>
                    <span className="text-lg font-bold text-slate-600 dark:text-slate-300">{sesion.dolorAntes ?? '—'}/10</span>
                  </div>
                  <TrendingUp className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 dark:text-slate-500 block">Después</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{sesion.dolorDespues ?? '—'}/10</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, ((sesion.dolorDespues || 0) / 10) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Rango articular y métricas biomecánicas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Ángulo Promedio</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">{sesion.anguloPromedio ?? '—'}°</span>
              </div>
              <Clock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">ROM Máximo Alcanzado</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{sesion.romMaximo ?? '—'}°</span>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
            </div>
          </div>

          {/* Desglose de Series detectadas */}
          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Desglose Clínico de Series
            </span>
            {series.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-500 italic">No hay notas de series desglosadas para esta sesión.</p>
            ) : (
              <div className="space-y-1.5">
                {series.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{s}</span>
                    <span className="flex items-center gap-1 font-bold text-[11px]">
                      {/Bien hecha/.test(s) ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Óptima</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Ajustable</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cerrar detalle
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewPatientDetail?.(sesion.codigo);
            }}
            className="flex items-center gap-1.5 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950"
          >
            <span>Ir al expediente completo</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}