import React, { useMemo, useState } from 'react';
import { LogOut, Info, AlertTriangle, Check, X } from 'lucide-react';
import ConfirmDialog from './ui/ConfirmDialog';

const TIPOS_ALTA = [
  { value: 'alta_medica', label: 'Alta médica — cumplió los objetivos, no vuelve' },
  { value: 'alta_temporal', label: 'Alta temporal — está bien por ahora, vuelve a control' },
  { value: 'alta_voluntaria', label: 'Alta voluntaria — el paciente decide dejarlo' },
  { value: 'abandono', label: 'Abandono — dejó de venir' },
  { value: 'derivado', label: 'Derivado — pasa a otro servicio' },
];

const ESTADOS_FUNCIONALES = [
  { value: 'recuperado', label: 'Recuperado' },
  { value: 'funcional', label: 'Funcional' },
  { value: 'mejoria_parcial', label: 'Mejoría parcial' },
  { value: 'sin_cambios', label: 'Sin cambios' },
  { value: 'empeoro', label: 'Empeoró' },
];

const hoyISO = () => new Date().toISOString().slice(0, 10);

const construirForm = () => ({
  tipo_alta: 'alta_medica',
  estado_funcional: 'funcional',
  motivo: '',
  recomendaciones: '',
  requiere_control: false,
  fecha_control: '',
});

// Ventana flotante para cerrar el ciclo de tratamiento de un paciente
// (FASE 10). El ROM y el dolor NO se piden acá: los toma la base sola de la
// evaluación FINAL con goniómetro — por eso solo se muestran de referencia,
// nunca como campos editables.
export default function ModalAlta({ patient, onClose, onSave, onIrAEvaluacionFinal }) {
  const [form, setForm] = useState(construirForm);
  const [formInicial] = useState(construirForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [bloqueadoPorEvaluacion, setBloqueadoPorEvaluacion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmCierre, setConfirmCierre] = useState(false);

  const sucio = useMemo(() => JSON.stringify(form) !== JSON.stringify(formInicial), [form, formInicial]);

  const solicitarCierre = () => {
    if (guardando) return;
    if (sucio) { setConfirmCierre(true); return; }
    onClose();
  };

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') solicitarCierre(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucio, guardando]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Última evaluación FINAL con goniómetro: es lo único que va a sostener el
  // alta (ella decide el ROM y el dolor). Es solo de referencia acá.
  const evalFinal = [...(patient.evaluaciones || [])]
    .filter((e) => e.momento === 'final')
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null;

  const enviar = async (forzar) => {
    setError(null);
    setGuardando(true);
    try {
      await onSave(patient.db_id, { ...form, forzar });
      onClose();
    } catch (err) {
      if (err.faltaEvaluacionFinal) {
        setBloqueadoPorEvaluacion(true);
        setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.motivo.trim()) e.motivo = 'El motivo es obligatorio.';
    if (form.requiere_control && !form.fecha_control) e.fecha_control = 'Indica la fecha de control.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    setBloqueadoPorEvaluacion(false);
    if (!validate()) return;
    enviar(false);
  };

  const irAEvaluacionFinal = () => {
    onIrAEvaluacionFinal(patient.id);
  };

  const darDeAltaIgualmente = () => enviar(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => { if (e.target === e.currentTarget) solicitarCierre(); }}
    >
      <div className="animate-slide-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Encabezado */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-800">
              <LogOut className="h-5 w-5" />
            </span>
            <div>
              <h2 className="m-0 text-sm font-extrabold text-slate-800 dark:text-slate-200">Dar de alta — {patient.name}</h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">{patient.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={solicitarCierre}
            className="cursor-pointer rounded-lg p-1 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="space-y-2 rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-[12.5px] text-red-700 dark:text-red-300">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
              {bloqueadoPorEvaluacion && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={irAEvaluacionFinal}
                    className="cursor-pointer rounded-lg bg-green-700 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-green-800"
                  >
                    Registrar evaluación final
                  </button>
                  <button
                    type="button"
                    onClick={darDeAltaIgualmente}
                    disabled={guardando}
                    className="cursor-pointer rounded-lg border border-red-300 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11.5px] font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60"
                  >
                    Dar de alta igualmente
                  </button>
                </div>
              )}
            </div>
          )}

          {evalFinal ? (
            <div className="flex items-start gap-2 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-[12.5px] font-semibold text-blue-700 dark:text-blue-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Evaluación final del {evalFinal.fecha}: ROM {evalFinal.romGoniometro}°
                {evalFinal.dolorEva != null ? `, dolor ${evalFinal.dolorEva}/10` : ''}.
                El alta toma estos valores sola, no hace falta repetirlos.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este paciente no tiene evaluación final con goniómetro. La base va a rechazar el alta a
                menos que sea un abandono o una derivación (se puede forzar).
              </span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Tipo de alta *</label>
            <select
              value={form.tipo_alta}
              onChange={set('tipo_alta')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {TIPOS_ALTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Estado funcional *</label>
            <select
              value={form.estado_funcional}
              onChange={set('estado_funcional')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {ESTADOS_FUNCIONALES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Motivo *</label>
            <textarea
              rows="2"
              value={form.motivo}
              onChange={set('motivo')}
              placeholder="Ej. Cumplió los objetivos del plan: recuperó el rango útil y camina sin dolor."
              className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.motivo ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'}`}
            />
            {errors.motivo && <span className="block text-[10.5px] font-semibold text-red-500">{errors.motivo}</span>}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Recomendaciones (opcional)</label>
            <textarea
              rows="2"
              value={form.recomendaciones}
              onChange={set('recomendaciones')}
              placeholder="Ejercicios de mantenimiento, cuidados, señales de alarma..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.requiere_control} onChange={set('requiere_control')} className="h-4 w-4 accent-green-700" />
              ¿Requiere control?
            </label>
            {form.requiere_control && (
              <div className="mt-2 space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Fecha de control *</label>
                <input
                  type="date"
                  value={form.fecha_control}
                  min={hoyISO()}
                  onChange={set('fecha_control')}
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.fecha_control ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'}`}
                />
                {errors.fecha_control && <span className="block text-[10.5px] font-semibold text-red-500">{errors.fecha_control}</span>}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={solicitarCierre}
              disabled={guardando}
              className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-700 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {guardando ? 'Guardando...' : 'Dar de alta'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmCierre}
        title="Datos sin guardar"
        message="Hay datos sin guardar. ¿Cerrar de todas formas?"
        tone="amber"
        confirmLabel="Cerrar sin guardar"
        cancelLabel="Seguir editando"
        onConfirm={onClose}
        onCancel={() => setConfirmCierre(false)}
      />
    </div>
  );
}
