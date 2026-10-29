import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ruler, AlertTriangle, TrendingUp, Check, X, Activity, Edit3, ArrowRight, Lock } from 'lucide-react';
import ConfirmDialog from './ui/ConfirmDialog';

const ARTICULACIONES = ['rodilla', 'cadera'];

const ROM_FUNCIONAL = {
  cadera: [
    { actividad: 'Levantarse de una silla / usar el inodoro', grados: 90 },
    { actividad: 'Subir o bajar de la cama o el auto', grados: 100 },
    { actividad: 'Atarse los zapatos sentado', grados: 120 },
  ],
  rodilla: [
    { actividad: 'Subir o bajar escaleras', grados: 90 },
    { actividad: 'Levantarse de una silla', grados: 93 },
    { actividad: 'Función general buena en las AVD', grados: 110 },
    { actividad: 'Levantar un objeto del suelo', grados: 117 },
  ],
};

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const hoyISO = () => new Date().toISOString().slice(0, 10);

const construirForm = (patient, momento, evalExistente, articulacion, lado) => {
  const art = articulacion || evalExistente?.articulacion || patient.articulacion || 'rodilla';
  const lad = lado || evalExistente?.lado || patient.lado || 'derecho';
  return {
    momento: evalExistente?.momento || momento || 'inicial',
    fecha: evalExistente?.fecha || hoyISO(),
    articulacion: art,
    lado: lad,
    id_plan: evalExistente ? (evalExistente.idPlan ?? null) : (patient.routine?.id_plan ?? null),
    angulo_minimo: evalExistente?.anguloMinimo ?? '',
    angulo_maximo: evalExistente?.anguloMaximo ?? '',
    angulo_app: evalExistente?.anguloApp ?? '',
    id_sesion_referencia: evalExistente?.idSesionReferencia ?? '',
    dolor_eva: evalExistente?.dolorEva ?? 5,
    posicion_paciente: evalExistente?.posicionPaciente || '',
    instrumento: evalExistente?.instrumento || 'Goniómetro universal',
    observaciones: evalExistente?.observaciones || '',
  };
};

export default function ModalEvaluacion({ patient, momentoInicial, evaluacionExistente, onClose, onSave }) {
  const mismoPlan = (e, targetPlan) => (e.idPlan ?? null) === (targetPlan ?? null);

  const planActivo = evaluacionExistente ? evaluacionExistente.idPlan : (patient.routine?.id_plan ?? null);
  const articulacionDefecto = evaluacionExistente?.articulacion || patient.articulacion || 'rodilla';
  const ladoDefecto = evaluacionExistente?.lado || 'derecho';

  const inicialExistenteGlobal = (patient.evaluaciones || []).find(
    (e) => e.momento === 'inicial' && mismoPlan(e, planActivo)
  );

  const articulacionFinal = inicialExistenteGlobal?.articulacion || articulacionDefecto;
  const ladoFinal = inicialExistenteGlobal?.lado || ladoDefecto;

  const momentoCalculado = momentoInicial === 'final' && !inicialExistenteGlobal
    ? 'inicial'
    : (momentoInicial || (inicialExistenteGlobal ? 'final' : 'inicial'));

  const [editando, setEditando] = useState(evaluacionExistente || null);
  const [form, setForm] = useState(() =>
    construirForm(
      patient,
      momentoCalculado,
      evaluacionExistente,
      momentoCalculado === 'final' ? articulacionFinal : articulacionDefecto,
      momentoCalculado === 'final' ? ladoFinal : ladoDefecto
    )
  );
  const [formInicial, setFormInicial] = useState(() =>
    construirForm(
      patient,
      momentoCalculado,
      evaluacionExistente,
      momentoCalculado === 'final' ? articulacionFinal : articulacionDefecto,
      momentoCalculado === 'final' ? ladoFinal : ladoDefecto
    )
  );
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmCierre, setConfirmCierre] = useState(false);

  const sucio = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(formInicial),
    [form, formInicial]
  );

  const solicitarCierre = () => {
    if (guardando) return;
    if (sucio) { setConfirmCierre(true); return; }
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') solicitarCierre(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [sucio, guardando]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Evaluación inicial vinculada al plan, articulación y lado activos
  const inicialExistente = useMemo(() => {
    return (patient.evaluaciones || []).find(
      (e) => e.momento === 'inicial' && e.articulacion === form.articulacion && e.lado === form.lado
        && e.id !== editando?.id && mismoPlan(e, form.id_plan)
    );
  }, [patient.evaluaciones, form.articulacion, form.lado, form.id_plan, editando]);

  const finalExistente = useMemo(() => {
    return (patient.evaluaciones || []).find(
      (e) => e.momento === 'final' && e.articulacion === form.articulacion && e.lado === form.lado
        && e.id !== editando?.id && mismoPlan(e, form.id_plan)
    );
  }, [patient.evaluaciones, form.articulacion, form.lado, form.id_plan, editando]);

  const handleArticulacionChange = (art) => {
    const init = (patient.evaluaciones || []).find(
      (e) => e.momento === 'inicial' && e.articulacion === art && e.lado === form.lado && mismoPlan(e, form.id_plan)
    );
    const nuevoMomento = (!init && form.momento === 'final') ? 'inicial' : form.momento;
    setForm((f) => ({ ...f, articulacion: art, momento: nuevoMomento }));
  };

  const handleLadoChange = (lado) => {
    const init = (patient.evaluaciones || []).find(
      (e) => e.momento === 'inicial' && e.articulacion === form.articulacion && e.lado === lado && mismoPlan(e, form.id_plan)
    );
    const nuevoMomento = (!init && form.momento === 'final') ? 'inicial' : form.momento;
    setForm((f) => ({ ...f, lado, momento: nuevoMomento }));
  };

  const irAInicial = () => {
    if (inicialExistente) {
      setEditando(inicialExistente);
      const nuevoF = construirForm(patient, 'inicial', inicialExistente, form.articulacion, form.lado);
      setForm(nuevoF);
      setFormInicial(nuevoF);
    } else {
      setEditando(null);
      const nuevoF = construirForm(patient, 'inicial', null, form.articulacion, form.lado);
      setForm(nuevoF);
      setFormInicial(nuevoF);
    }
    setError(null);
    setErrors({});
  };

  const irAFinal = () => {
    const art = inicialExistente ? inicialExistente.articulacion : form.articulacion;
    const lad = inicialExistente ? inicialExistente.lado : form.lado;

    if (finalExistente) {
      setEditando(finalExistente);
      const nuevoF = construirForm(patient, 'final', finalExistente, art, lad);
      setForm(nuevoF);
      setFormInicial(nuevoF);
    } else {
      setEditando(null);
      const nuevoF = construirForm(patient, 'final', null, art, lad);
      setForm(nuevoF);
      setFormInicial(nuevoF);
    }
    setError(null);
    setErrors({});
  };

  const min = form.angulo_minimo === '' ? null : Number(form.angulo_minimo);
  const max = form.angulo_maximo === '' ? null : Number(form.angulo_maximo);
  const recorrido = min != null && max != null ? max - min : null;

  const inicialRom = inicialExistente
    ? (inicialExistente.romGoniometro ?? (inicialExistente.anguloMaximo - inicialExistente.anguloMinimo))
    : null;

  const ganancia = form.momento === 'final' && inicialRom != null && recorrido != null
    ? recorrido - inicialRom
    : null;
  const gananciaPct = ganancia != null && inicialRom
    ? Math.round((ganancia / inicialRom) * 1000) / 10
    : null;

  const metasArticulacion = ROM_FUNCIONAL[form.articulacion] || [];
  const metasAlcanzadas = max != null ? metasArticulacion.filter((m) => max >= m.grados) : [];
  const metasPendientes = max != null ? metasArticulacion.filter((m) => max < m.grados) : [];
  const proximaMeta = metasPendientes[0] || null;

  const validate = () => {
    const e = {};
    if (form.angulo_minimo === '' || form.angulo_minimo === null) e.angulo_minimo = 'Obligatorio.';
    if (form.angulo_maximo === '' || form.angulo_maximo === null) e.angulo_maximo = 'Obligatorio.';
    if (min != null && max != null && max < min) e.angulo_maximo = 'No puede ser menor que el mínimo.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const duplicado = ['inicial', 'final'].includes(form.momento)
    ? (patient.evaluaciones || []).find(
        (e) => e.momento === form.momento && e.articulacion === form.articulacion
          && e.lado === form.lado && e.id !== editando?.id && mismoPlan(e, form.id_plan)
      )
    : null;

  const bloqueadaSinInicial = form.momento === 'final' && !inicialExistente && !editando;

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (duplicado || bloqueadaSinInicial) return;
    if (!validate()) return;

    setError(null);
    setGuardando(true);
    try {
      await onSave(patient.db_id, form, editando?.id || null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-150 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) solicitarCierre(); }}
    >
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl transition-all ${form.momento === 'final' && inicialExistente ? 'max-w-4xl' : 'max-w-2xl'}`}>

        {/* Encabezado */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <Ruler className="h-5 w-5" />
            </span>
            <div>
              <h2 className="m-0 text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {editando
                  ? `Editar evaluación ${form.momento}`
                  : `Registrar evaluación ${form.momento === 'final' ? 'final' : 'inicial'}`
                } — {patient.name}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                {patient.id} · {capitalizar(form.articulacion)} · Grado K-L {patient.gradoArtrosis}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={solicitarCierre}
            className="cursor-pointer rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6 text-slate-700 dark:text-slate-200">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {bloqueadaSinInicial && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No se puede registrar la final sin la inicial de esta articulación y lado. Registra primero la inicial.
            </div>
          )}

          {/* ARTICULACIÓN Y LADO: Selects en Inicial | Labels Estáticos Resaltados en Final */}
          {form.momento === 'inicial' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Articulación</label>
                <select
                  value={form.articulacion}
                  onChange={(e) => handleArticulacionChange(e.target.value)}
                  className="w-full rounded-lg border border-emerald-400 dark:border-emerald-500/80 bg-emerald-50 dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 ring-1 ring-emerald-200 dark:ring-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ARTICULACIONES.map((a) => <option key={a} value={a}>{capitalizar(a)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Lado</label>
                <select
                  value={form.lado}
                  onChange={(e) => handleLadoChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="derecho">Derecho</option>
                  <option value="izquierdo">Izquierdo</option>
                  <option value="bilateral">Bilateral</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Articulación en tratamiento
                </label>
                <div className="flex items-center justify-between rounded-lg border border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{capitalizar(form.articulacion)}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500/80 uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30">
                    Fijado por inicial
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Lado en tratamiento
                </label>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{capitalizar(form.lado)}</span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-200 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                    Fijado
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VISTA COMPARATIVA (Evaluación Final) */}
          {form.momento === 'final' && inicialExistente ? (
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Comparativa de Evolución de Tratamiento
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Columna Izquierda: Medición Inicial */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Medición Inicial</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{inicialExistente.fecha}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold block">Mínimo</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{inicialExistente.anguloMinimo}°</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold block">Máximo</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{inicialExistente.anguloMaximo}°</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <span>Recorrido inicial (ROM):</span>
                    <span className="font-bold">{inicialRom}°</span>
                  </div>

                  <div className="flex justify-between items-center px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <span>Dolor EVA inicial:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{inicialExistente.dolorEva}/10</span>
                  </div>

                  {inicialExistente.posicionPaciente && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      Posición: {inicialExistente.posicionPaciente}
                    </p>
                  )}
                </div>

                {/* Columna Derecha: Medición Final */}
                <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-slate-800/70 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      Medición Final {editando ? '(Editando)' : '(Hoy)'}
                    </span>
                    <input
                      type="date"
                      value={form.fecha}
                      max={hoyISO()}
                      onChange={set('fecha')}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Mínimo *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-90"
                        max="270"
                        value={form.angulo_minimo}
                        onChange={set('angulo_minimo')}
                        placeholder="Ej. -12"
                        className={`w-full rounded-lg border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 ${errors.angulo_minimo ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Máximo *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-90"
                        max="270"
                        value={form.angulo_maximo}
                        onChange={set('angulo_maximo')}
                        placeholder="Ej. 120"
                        className={`w-full rounded-lg border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 ${errors.angulo_maximo ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Nuevo recorrido:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{recorrido != null ? `${recorrido}°` : '—'}</span>
                  </div>

                  {ganancia != null && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 text-xs">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Ganancia:
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{ganancia}° {gananciaPct != null ? `(${gananciaPct}%)` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* VISTA INDIVIDUAL (Evaluación Inicial) */
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {editando ? 'Editando Evaluación Inicial' : 'Registro de Evaluación Inicial (Línea Base)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Fecha:</label>
                  <input
                    type="date"
                    value={form.fecha}
                    max={hoyISO()}
                    onChange={set('fecha')}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Ángulo mínimo (goniómetro) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="-90"
                    max="270"
                    value={form.angulo_minimo}
                    onChange={set('angulo_minimo')}
                    placeholder="Ej. -12"
                    className={`w-full rounded-lg border bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 ${errors.angulo_minimo ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.angulo_minimo && <span className="block text-[10.5px] font-semibold text-red-600 dark:text-red-400">{errors.angulo_minimo}</span>}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Ángulo máximo (goniómetro) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="-90"
                    max="270"
                    value={form.angulo_maximo}
                    onChange={set('angulo_maximo')}
                    placeholder="Ej. 120"
                    className={`w-full rounded-lg border bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 ${errors.angulo_maximo ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.angulo_maximo && <span className="block text-[10.5px] font-semibold text-red-600 dark:text-red-400">{errors.angulo_maximo}</span>}
                </div>
              </div>

              {recorrido != null && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  Recorrido calculado: {recorrido}°
                </div>
              )}
            </>
          )}

          {/* Actividades ROM funcional */}
          {max != null && metasArticulacion.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Con {max}° de flexión de {form.articulacion}:
              </p>
              {metasAlcanzadas.length === 0 ? (
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Aún no alcanza las actividades funcionales de referencia.
                </p>
              ) : (
                <ul className="space-y-1">
                  {metasAlcanzadas.map((m) => (
                    <li key={m.actividad} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" /> {m.actividad}
                    </li>
                  ))}
                </ul>
              )}
              {proximaMeta && (
                <p className="text-[11.5px] text-amber-600 dark:text-amber-400">
                  Faltan {Math.round((proximaMeta.grados - max) * 10) / 10}° para: {proximaMeta.actividad}
                </p>
              )}
            </div>
          )}

          {/* Dolor EVA */}
          <div className="space-y-1">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <span>{form.momento === 'final' ? 'Dolor EVA al alta' : 'Dolor EVA inicial'}</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">{form.dolor_eva}/10</span>
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={form.dolor_eva}
              onChange={set('dolor_eva')}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Posición e Instrumento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Posición del paciente</label>
              <input
                type="text"
                value={form.posicion_paciente}
                onChange={set('posicion_paciente')}
                placeholder="Ej. Decúbito supino, cadera a 0°"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Instrumento</label>
              <input
                type="text"
                value={form.instrumento}
                onChange={set('instrumento')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Observaciones</label>
            <textarea
              rows="2"
              value={form.observaciones}
              onChange={set('observaciones')}
              placeholder="Notas clínicas de esta medición..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* BARRA INFERIOR DE ACCIONES */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700/80 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={solicitarCierre}
                disabled={guardando}
                className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              {form.momento === 'final' ? (
                <button
                  type="button"
                  onClick={irAInicial}
                  disabled={guardando}
                  className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {inicialExistente ? 'Editar evaluación inicial' : 'Registrar evaluación inicial'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={irAFinal}
                  disabled={guardando || !inicialExistente}
                  title={!inicialExistente ? 'Debe existir una evaluación inicial para pasar a la final' : ''}
                  className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{finalExistente ? 'Editar evaluación final' : 'Registrar evaluación final'}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={guardando || Boolean(duplicado) || bloqueadaSinInicial}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {guardando
                ? 'Guardando...'
                : (editando ? 'Guardar cambios' : `Registrar evaluación ${form.momento}`)}
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}