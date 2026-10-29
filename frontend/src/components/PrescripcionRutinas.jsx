import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Dumbbell, Trash2, Plus, Info, X, Save, User, FileText,
  CalendarDays, NotebookPen, Search, ChevronRight, ListOrdered,
  AlertCircle, Stethoscope,
} from 'lucide-react';
import { C, TONES, STATUS, CARD, BTN } from '../theme';
import { IconRodilla, IconCadera } from './ModuloPacientes';

const MAX_INDICACIONES = 500;

const JOINT_ICON = { Rodilla: IconRodilla, Cadera: IconCadera };

// `patient.articulacion` viene de la BD en minúscula (enum `articulacion`);
// JOINT_ICON usa etiquetas con mayúscula inicial.
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'US';

/* Suma de días en calendario local, sin pasar por UTC en ningún punto:
   así el resultado no depende de que dos conversiones de zona se cancelen. */
const sumarDias = (iso, dias) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const fin = new Date(y, m - 1, d + (parseInt(dias, 10) || 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${fin.getFullYear()}-${p(fin.getMonth() + 1)}-${p(fin.getDate())}`;
};

const hoyISO = () => {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

/* ==================================================================
   CAMPO CON ICONO
   ================================================================== */
function Campo({ icon: Icon, label, required, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-1.5">
        <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: C.muted }} strokeWidth={1.9} />
        <span className="text-[12px] font-semibold" style={{ color: C.body }}>
          {label}{required && <span style={{ color: C.green }}> *</span>}
        </span>
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-right text-[11px]" style={{ color: C.muted }}>{hint}</span>}
    </label>
  );
}

const campoBase = {
  height: 40,
  borderRadius: 10,
  backgroundColor: '#FFFFFF',
  borderColor: C.fieldBd,
  color: C.navy,
};

const inputCls =
  'w-full border px-3 text-[13px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]';

/* ==================================================================
   FICHA DEL PACIENTE SELECCIONADO
   ================================================================== */
function FichaPaciente({ patient }) {
  const joint = capitalizar(patient.articulacion);
  const JointIcon = (joint && JOINT_ICON[joint]) || Stethoscope;
  const tone = STATUS[patient.status] || STATUS.Inactivo;

  return (
    <div className="rounded-[14px] p-3.5" style={{ backgroundColor: C.fieldBg }}>
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white"
          style={{ backgroundColor: '#0E5A3E' }}
        >
          {initials(patient.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight" style={{ color: C.navy }}>
            {patient.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]" style={{ color: C.muted }}>
            <span>C.I.: {patient.ci}</span>
            <span style={{ color: C.faded }}>|</span>
            <span>{patient.age} años</span>
            {patient.gender && (
              <>
                <span style={{ color: C.faded }}>|</span>
                <span>{patient.gender}</span>
              </>
            )}
          </p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: C.faded }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[11px] bg-white dark:bg-slate-900 px-3 py-2">
        <JointIcon className="h-[18px] w-[18px] shrink-0" style={{ color: C.joint }} />
        <span className="text-[12.5px] font-semibold" style={{ color: C.navy }}>{patient.diagnosis}</span>
        <span className="text-[12px]" style={{ color: C.muted }}>Diagnóstico principal</span>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[12px] font-bold"
          style={{ backgroundColor: tone.bg, color: tone.color }}
        >
          <ClipboardCheck className="h-[14px] w-[14px]" strokeWidth={2.2} />
          {patient.status === 'Activo' ? 'En tratamiento' : patient.status}
        </span>
      </div>
    </div>
  );
}

/* ==================================================================
   ESTADO VACÍO DEL CONSTRUCTOR
   ================================================================== */
function ConstructorVacio() {
  return (
    <div
      className="rounded-[16px] border border-dashed px-6 py-10 text-center"
      style={{ borderColor: '#CBDCEA', backgroundColor: '#FCFEFF' }}
    >
      <svg viewBox="0 0 220 130" className="mx-auto h-[132px] w-full max-w-[300px]" role="img" aria-label="Rutina sin ejercicios">
        {/* Formas de fondo */}
        <circle cx="72" cy="58" r="40" fill="#EAF1F8" />
        <circle cx="148" cy="66" r="34" fill="#EFF5FA" />
        <circle cx="108" cy="96" r="26" fill="#F2F7FB" />

        {/* Tablilla */}
        <rect x="52" y="34" width="46" height="58" rx="7" fill="#FFFFFF" stroke="#D5E3EF" strokeWidth="2" />
        <rect x="66" y="28" width="18" height="11" rx="3.5" fill="#DCE8F2" />
        <path d="M61 52h28M61 62h28M61 72h18" stroke="#CBDCEA" strokeWidth="3" strokeLinecap="round" />

        {/* Rodilla estilizada */}
        <g transform="translate(128 38) scale(2.3)" fill="none" stroke="#B7CCDE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.1 2.3v3.8c-2.1.7-3.3 2.4-2.9 4.1.4 1.6 2.2 2.4 3.6 1.7.7-.3.9-.9 1.3-.9s.6.6 1.3.9c1.4.7 3.2-.1 3.6-1.7.4-1.7-.8-3.4-2.9-4.1V2.3z" />
          <path d="M9.2 13.7c1.4-.7 3.5-.7 4.8 0l-.4 7.4c0 .5-.4.9-.9.9h-2.2c-.5 0-.9-.4-.9-.9z" />
          <path d="M15.5 14c.8.1 1.2.8 1.1 1.6l-.4 5.6c0 .4-.3.8-.8.8s-.8-.4-.8-.8l-.2-5.5c0-.9.3-1.7 1.1-1.7z" />
        </g>

        {/* Insignia de "agregar" */}
        <circle cx="150" cy="30" r="15" fill={C.green} />
        <path d="M150 23v14M143 30h14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <h4 className="mt-3 text-[19px] font-extrabold tracking-[-.01em]" style={{ color: C.navy }}>
        No hay ejercicios agregados
      </h4>
      <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] leading-relaxed" style={{ color: C.body }}>
        Comience agregando ejercicios desde el catálogo para crear la rutina de rehabilitación del paciente.
      </p>
    </div>
  );
}

/* ==================================================================
   PRESCRIPCIÓN DE RUTINAS
   ================================================================== */
export default function PrescripcionRutinas({
  patients = [],
  exercises = [],
  preSelectedPatientId,
  routineToEdit,
  onSaveRoutine,
  onCancel,
}) {
  const [selectedPatientId, setSelectedPatientId] = useState(preSelectedPatientId || '');
  const [routineName, setRoutineName] = useState(routineToEdit?.name || 'Rutina Terapéutica de Recuperación');
  // La BD solo guarda semanas completas (`duracion_estimada_semanas`). Pedir
  // "días" y convertir se redondeaba a la semana más cercana: cambiar de 21 a
  // 18 días caía en las mismas 3 semanas y el cambio parecía no guardarse.
  const [weeks, setWeeks] = useState(routineToEdit?.weeks || Math.ceil((routineToEdit?.duration || 14) / 7));
  const [startDate, setStartDate] = useState(routineToEdit?.startDate || hoyISO());
  const [instructions, setInstructions] = useState(routineToEdit?.instructions || '');
  const [prescribedExercises, setPrescribedExercises] = useState(
    () => (routineToEdit?.exercises || []).map((e) => ({
      id: e.id, name: e.name, series: e.series, reps: e.reps, freq: e.freq, instructions: e.instructions || '',
    }))
  );
  const [error, setError] = useState('');

  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [selectedJointFilter, setSelectedJointFilter] = useState('Todos');

  useEffect(() => {
    if (preSelectedPatientId) setSelectedPatientId(preSelectedPatientId);
  }, [preSelectedPatientId]);

  // La fecha fin siempre se deriva: nunca se edita a mano.
  const endDate = sumarDias(startDate, (parseInt(weeks, 10) || 0) * 7);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const handleAddExerciseFromCatalog = (ex) => {
    if (prescribedExercises.some((p) => p.id === ex.id)) {
      setError(`“${ex.name}” ya está en la rutina.`);
      return;
    }
    setError('');
    setPrescribedExercises((prev) => [
      ...prev,
      { id: ex.id, name: ex.name, series: 3, reps: '12', freq: 'Diario', instructions: ex.instructions || '' },
    ]);
    setShowCatalogDrawer(false);
  };

  // Se reemplaza el objeto, no se muta: mutarlo deja a React sin cambio que detectar.
  const handleUpdateExerciseField = (index, field, value) => {
    setPrescribedExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  };

  const handleRemoveExercise = (index) => {
    setPrescribedExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPatientId) { setError('Seleccione el paciente que recibirá la rutina.'); return; }
    if (prescribedExercises.length === 0) { setError('Agregue al menos un ejercicio del catálogo.'); return; }
    setError('');
    const semanas = parseInt(weeks, 10) || 2;
    onSaveRoutine(selectedPatientId, {
      id_plan: routineToEdit?.id_plan,
      name: routineName,
      weeks: semanas,
      duration: semanas * 7,
      startDate,
      endDate,
      instructions,
      exercises: prescribedExercises,
    });
  };

  const filteredCatalog = useMemo(() => {
    const q = searchCatalogQuery.toLowerCase();
    return exercises.filter((ex) => {
      const nombre = (ex.name || '').toLowerCase();
      const categoria = (ex.category || '').toLowerCase();
      const joint = ex.joint || '';
      return (nombre.includes(q) || categoria.includes(q)) &&
        (selectedJointFilter === 'Todos' || joint.includes(selectedJointFilter));
    });
  }, [exercises, searchCatalogQuery, selectedJointFilter]);

  // `joint` puede venir vacío de la BD: filtramos antes de partir la cadena.
  const joints = useMemo(
    () => ['Todos', ...new Set(exercises.map((ex) => (ex.joint || '').split(' / ')[0]).filter(Boolean))],
    [exercises]
  );

  return (
    <div className="space-y-4 pb-6">
      {/* ===================== Cabecera ===================== */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[15px]" style={{ backgroundColor: C.mintTile }}>
            <ClipboardCheck className="h-6 w-6" style={{ color: C.green }} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[21px] font-extrabold leading-tight tracking-[-.02em]" style={{ color: C.navy }}>
              {routineToEdit ? 'Editar Rutina Prescrita' : 'Prescripción de Rutinas'}
            </h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: C.body }}>
              {routineToEdit
                ? 'Corrija los datos o los ejercicios de esta rutina ya prescrita.'
                : 'Cree y asigne planes de entrenamiento kinesiológicos personalizados.'}
            </p>
          </div>
        </div>

      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">

        {/* ================= Columna izquierda ================= */}
        <div className={`${CARD} space-y-4 p-4`} style={{ borderColor: C.border }}>
          {selectedPatient ? (
            <FichaPaciente patient={selectedPatient} />
          ) : (
            <div className="flex items-center gap-2.5 rounded-[14px] p-3.5" style={{ backgroundColor: C.fieldBg }}>
              <User className="h-5 w-5 shrink-0" style={{ color: C.muted }} />
              <p className="text-[12.5px]" style={{ color: C.body }}>
                Seleccione un paciente para ver su ficha clínica.
              </p>
            </div>
          )}

          <h3 className="text-[15px] font-bold" style={{ color: C.navy }}>Datos de la prescripción</h3>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Campo icon={User} label="Paciente receptor" required>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                disabled={Boolean(routineToEdit)}
                className={`${inputCls} font-medium ${routineToEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                style={routineToEdit ? { ...campoBase, backgroundColor: C.fieldBg, color: C.body } : campoBase}
                required
              >
                <option value="" disabled>-- Seleccione un paciente --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()} ({p.id})</option>
                ))}
              </select>
            </Campo>

            <Campo icon={FileText} label="Nombre del plan" required>
              <input
                type="text"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Ej. Fortalecimiento lumbar core"
                className={inputCls}
                style={campoBase}
                required
              />
            </Campo>

            <Campo icon={selectedPatient ? (JOINT_ICON[capitalizar(selectedPatient.articulacion)] || Stethoscope) : Stethoscope} label="Diagnóstico / Articulación" required>
              <input
                type="text"
                value={selectedPatient?.diagnosis || ''}
                readOnly
                placeholder="Se toma del expediente"
                className={`${inputCls} cursor-not-allowed`}
                style={{ ...campoBase, backgroundColor: C.fieldBg, color: C.body }}
              />
            </Campo>

            <Campo icon={CalendarDays} label="Duración (semanas)" required>
              <input
                type="number"
                min="1"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className={inputCls}
                style={campoBase}
                required
              />
            </Campo>

            <Campo icon={CalendarDays} label="Fecha de inicio" required>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
                style={campoBase}
                required
              />
            </Campo>

            <Campo icon={CalendarDays} label="Fecha fin" required>
              <input
                type="date"
                value={endDate}
                readOnly
                title="Se calcula con la fecha de inicio y la duración"
                className={`${inputCls} cursor-not-allowed`}
                style={{ ...campoBase, backgroundColor: C.fieldBg, color: C.body }}
              />
            </Campo>

            <div className="sm:col-span-2">
              <Campo
                icon={NotebookPen}
                label="Indicaciones generales / Recomendaciones"
                hint={`${instructions.length}/${MAX_INDICACIONES}`}
              >
                <textarea
                  value={instructions}
                  maxLength={MAX_INDICACIONES}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ej.: Evitar impacto directo, realizar con respiración rítmica, aplicar frío después del ejercicio..."
                  rows="4"
                  className={`${inputCls} resize-y py-2.5`}
                  style={{ ...campoBase, height: 'auto', minHeight: 96 }}
                />
              </Campo>
            </div>
          </div>
        </div>

        {/* ================= Columna derecha ================= */}
        <div className={`${CARD} space-y-4 p-4`} style={{ borderColor: C.border }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ backgroundColor: '#0E5A3E' }}>
                <Dumbbell className="h-5 w-5 text-white" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-[16px] font-bold leading-tight" style={{ color: C.navy }}>Constructor de rutina</h3>
                <p className="mt-0.5 text-[12.5px]" style={{ color: C.body }}>
                  Agregue los ejercicios desde el catálogo para crear la rutina del paciente.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCatalogDrawer(true)}
              className={`${BTN} shrink-0 px-4 py-2.5 text-white`}
              style={{ backgroundColor: C.greenDeep }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Agregar ejercicio del catálogo
            </button>
          </div>

          {prescribedExercises.length === 0 ? (
            <ConstructorVacio />
          ) : (
            <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {prescribedExercises.map((ex, index) => (
                <div key={ex.id} className="relative rounded-[14px] p-3.5" style={{ backgroundColor: C.fieldBg }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveExercise(index)}
                    title="Quitar de la rutina"
                    aria-label={`Quitar ${ex.name}`}
                    className="absolute right-2.5 top-2.5 grid h-7 w-7 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-rose-50"
                    style={{ color: C.muted }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex gap-3">
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[12px] font-bold"
                      style={{ backgroundColor: C.mintTile, color: C.green }}
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="pr-8">
                        <h4 className="truncate text-[13.5px] font-bold" style={{ color: C.navy }}>{ex.name}</h4>
                        <span className="text-[11px]" style={{ color: C.muted }}>Código de catálogo: {ex.id}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <Campo icon={ListOrdered} label="Series">
                          <input
                            type="number" min="1" value={ex.series}
                            onChange={(e) => handleUpdateExerciseField(index, 'series', e.target.value)}
                            className={inputCls} style={{ ...campoBase, height: 36 }}
                          />
                        </Campo>
                        <Campo icon={ClipboardCheck} label="Repeticiones / duración">
                          <input
                            type="text" value={ex.reps} placeholder="Ej. 12, 15, 30s"
                            onChange={(e) => handleUpdateExerciseField(index, 'reps', e.target.value)}
                            className={inputCls} style={{ ...campoBase, height: 36 }}
                          />
                        </Campo>
                        <Campo icon={CalendarDays} label="Frecuencia">
                          <select
                            value={ex.freq}
                            onChange={(e) => handleUpdateExerciseField(index, 'freq', e.target.value)}
                            className={`${inputCls} cursor-pointer font-medium`} style={{ ...campoBase, height: 36 }}
                          >
                            {['Diario', '2 veces al día', '3 veces al día', 'Día por medio', '3 veces por semana']
                              .map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </Campo>
                      </div>

                      <Campo icon={NotebookPen} label="Instrucciones específicas">
                        <input
                          type="text" value={ex.instructions}
                          placeholder="Ej. Realizar lento, aplicar resistencia de banda amarilla..."
                          onChange={(e) => handleUpdateExerciseField(index, 'instructions', e.target.value)}
                          className={inputCls} style={{ ...campoBase, height: 36 }}
                        />
                      </Campo>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p
              className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
              style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-3.5" style={{ borderColor: C.border }}>
            <button
              type="button"
              onClick={onCancel}
              className={`${BTN} border px-6 py-2.5`}
              style={{ borderColor: C.fieldBd, color: C.body }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`${BTN} px-7 py-2.5 text-white`}
              style={{ backgroundColor: C.greenDeep }}
            >
              <Save className="h-4 w-4" /> {routineToEdit ? 'Guardar cambios' : 'Guardar Rutina'}
            </button>
          </div>
        </div>
      </form>

      {/* ===================== Cajón del catálogo ===================== */}
      {showCatalogDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCatalogDrawer(false); }}
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-slate-900 shadow-2xl">
            <div
              className="flex shrink-0 items-center gap-2.5 px-4 py-3.5"
              style={{ backgroundColor: C.headBg }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px]" style={{ backgroundColor: C.mintTile }}>
                <Dumbbell className="h-[18px] w-[18px]" style={{ color: C.green }} strokeWidth={2} />
              </span>
              <h3 className="text-[15px] font-bold" style={{ color: C.navy }}>Catálogo de ejercicios</h3>
              <button
                type="button"
                onClick={() => setShowCatalogDrawer(false)}
                aria-label="Cerrar catálogo"
                className="ml-auto grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] border bg-white dark:bg-slate-900 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: C.border, color: C.muted }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="shrink-0 space-y-2.5 px-4 pb-3" style={{ backgroundColor: C.headBg }}>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Buscar ejercicio..."
                  className={`${inputCls} pl-9`}
                  style={{ ...campoBase, height: 38 }}
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: C.muted }}>Articulación</span>
                <select
                  value={selectedJointFilter}
                  onChange={(e) => setSelectedJointFilter(e.target.value)}
                  className={`${inputCls} cursor-pointer font-semibold`}
                  style={{ ...campoBase, height: 34 }}
                >
                  {joints.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
              {filteredCatalog.length === 0 ? (
                <p className="py-12 text-center text-[12.5px]" style={{ color: C.muted }}>
                  No hay ejercicios que coincidan.
                </p>
              ) : (
                filteredCatalog.map((ex) => {
                  const yaEsta = prescribedExercises.some((p) => p.id === ex.id);
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between gap-3 rounded-[12px] p-3"
                      style={{ backgroundColor: C.fieldBg }}
                    >
                      <div className="min-w-0">
                        <h4 className="truncate text-[13px] font-bold" style={{ color: C.navy }}>{ex.name}</h4>
                        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: C.muted }}>
                          Categoría: <strong style={{ color: C.body }}>{ex.category}</strong>
                        </p>
                        {ex.joint && (
                          <span
                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ backgroundColor: TONES.blue.tile, color: TONES.blue.icon }}
                          >
                            {ex.joint}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddExerciseFromCatalog(ex)}
                        disabled={yaEsta}
                        className={`${BTN} shrink-0 px-3 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45`}
                        style={{ backgroundColor: C.green }}
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> {yaEsta ? 'Agregado' : 'Agregar'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div
              className="flex shrink-0 items-center gap-2 px-4 py-3 text-[11.5px]"
              style={{ backgroundColor: C.headBg, color: C.body }}
            >
              <Info className="h-4 w-4 shrink-0" style={{ color: C.green }} />
              <span>Los ejercicios agregados se configuran en el constructor.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
