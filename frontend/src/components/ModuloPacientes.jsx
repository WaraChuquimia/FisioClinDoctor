import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus, Phone, Mail, CheckCircle2, ChevronRight,
  TrendingDown, TrendingUp, Clipboard, AlertCircle, AlertTriangle,
  Users, Calendar, FileText, Activity, X, Pencil, Check, Plus,
  ClipboardList, HeartPulse, Upload, Image as ImageIcon, Ruler, LogOut, RotateCcw,
  ArrowDownAZ, ArrowUpAZ, Trash2, Pill,
} from 'lucide-react';
import * as api from '../lib/api';
import { ESTADO_TRATAMIENTO_LABEL, TIPO_ALTA_LABEL, ESTADO_FUNCIONAL_LABEL } from '../lib/mappers';
import VisorAdjunto from './VisorAdjunto';
import { C, CARD, TH, TD, BTN, STATUS, AVATARS, TONES, TONO_HIST as TONO_HIST_BASE } from '../theme';
import FilterDropdown from './ui/FilterDropdown';
import Paginacion from './ui/Paginacion';
import EstadoVacio from './ui/EstadoVacio';
import Badge from './ui/Badge';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import Tabla from './ui/Tabla';
import ConfirmDialog from './ui/ConfirmDialog';

/* ==================================================================
   ICONOS ANATÓMICOS
   ================================================================== */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// Fémur con cóndilos + meseta tibial y peroné.
export function IconRodilla(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M10.1 2.3v3.8c-2.1.7-3.3 2.4-2.9 4.1.4 1.6 2.2 2.4 3.6 1.7.7-.3.9-.9 1.3-.9s.6.6 1.3.9c1.4.7 3.2-.1 3.6-1.7.4-1.7-.8-3.4-2.9-4.1V2.3z" />
      <path d="M9.2 13.7c1.4-.7 3.5-.7 4.8 0l-.4 7.4c0 .5-.4.9-.9.9h-2.2c-.5 0-.9-.4-.9-.9z" />
      <path d="M15.5 14c.8.1 1.2.8 1.1 1.6l-.4 5.6c0 .4-.3.8-.8.8s-.8-.4-.8-.8l-.2-5.5c0-.9.3-1.7 1.1-1.7z" />
      <path d="M10.6 8.6h.1M13.4 8.6h.1" />
    </svg>
  );
}

// Arco acetabular + cabeza y diáfisis femoral.
export function IconCadera(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M9.6 2.6c3.3-.6 6.4 1.4 7 4.4.6 3-1.2 5.6-4 6.4-.8.2-1.5-.2-1.7-.9-.2-.7.2-1.4.9-1.6 1.4-.4 2.3-1.7 2-3.2-.3-1.5-1.9-2.5-3.6-2.2-.7.1-1.4-.3-1.5-1-.1-.9-.1-1.7.9-1.9z" />
      <path d="M8.3 8.6c1.2 0 2 .9 2 2.1l-.2 10.4c0 .5-.4.9-.9.9H7.7c-.5 0-.9-.4-.9-.9l-.1-10.4c0-1.2.5-2.1 1.6-2.1z" />
      <path d="M11.9 6.3h.1M12.6 9.1h.1" />
    </svg>
  );
}

const JOINT_ICON = { Rodilla: IconRodilla, Cadera: IconCadera };

/* ==================================================================
   DATOS DERIVADOS
   ================================================================== */
// `estado_tratamiento` (FASE 10) es distinto del interruptor Activo/Inactivo
// de arriba: ese es manual, este lo pone sola la base al dar de alta o
// reabrir. Verde/azul/celeste/gris son los 4 que pide el plan; derivado se
// distingue con morado para no confundirlo con abandono.
const ESTADO_ALTA_TONE = {
  en_tratamiento: { bg: 'var(--alta-entratamiento-bg)', color: 'var(--alta-entratamiento-color)' },
  de_alta:        { bg: 'var(--alta-dealta-bg)',        color: 'var(--alta-dealta-color)' },
  alta_temporal:  { bg: 'var(--alta-temporal-bg)',      color: 'var(--alta-temporal-color)' },
  suspendido:     { bg: 'var(--alta-suspendido-bg)',    color: 'var(--alta-suspendido-color)' },
  abandono:       { bg: 'var(--alta-suspendido-bg)',    color: 'var(--alta-suspendido-color)' },
  derivado:       { bg: 'var(--alta-derivado-bg)',      color: 'var(--alta-derivado-color)' },
};

function EstadoTratamientoBadge({ estado }) {
  const clave = estado || 'en_tratamiento';
  const tone = ESTADO_ALTA_TONE[clave] || ESTADO_ALTA_TONE.en_tratamiento;
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[.03em]"
      style={{ backgroundColor: tone.bg, color: tone.color }}
    >
      {ESTADO_TRATAMIENTO_LABEL[clave] || 'En tratamiento'}
    </span>
  );
}

// Coincide con las 4 opciones que ofrece ModalNuevoPaciente al registrar.
const ARTICULACIONES = ['Rodilla', 'Cadera'];
const TIPOS_HISTORIAL = ['Evaluación', 'Evolución', 'Indicación'];

// `patient.articulacion` viene tal cual de la BD, en minúscula (enum
// `articulacion`); acá solo se le da forma de etiqueta para mostrarla.
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'US';

// La última sesión es la primera completada; si no hay, la más reciente que exista.
const ultimaSesionDe = (patient) => {
  const list = patient.sessions || [];
  return list.find((s) => s.status === 'Completada') || list[0] || null;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

/* ==================================================================
   DESPLEGABLE DE FILTRO
   ================================================================== */
/* ==================================================================
   INTERRUPTOR DE ESTADO
   Solo alterna Activo/Inactivo: no borra nada.
   ================================================================== */
function StatusToggle({ status, onToggle }) {
  const active = status !== 'Inactivo';
  const tone = STATUS[status] || STATUS.Inactivo;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(active ? 'Inactivo' : 'Activo'); }}
      title={active ? 'Desactivar paciente' : 'Activar paciente'}
      aria-pressed={active}
      className="inline-flex cursor-pointer items-center gap-2"
    >
      <span
        className="relative h-[21px] w-[38px] shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: active ? tone.dot : C.faded }}
      >
        <span
          className="absolute top-[2.5px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-all"
          style={{ left: active ? 19.5 : 2.5 }}
        />
      </span>
      {/* Ancho reservado: "Activo" e "Inactivo" no mueven la columna. */}
      <span className="w-[92px] text-left text-[12.5px] font-bold" style={{ color: tone.color }}>{status}</span>
    </button>
  );
}

/* ==================================================================
   PRIMITIVAS DE MODAL
   Exportadas para que el modal de "Registrar paciente" use exactamente
   las mismas piezas y los dos se vean igual.
   ================================================================== */
export function ModalShell({ icon: Icon, kicker, title, subtitle, badge, onClose, children, footer, wide }) {
  // Bloquea el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes cossmilModal {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cossmil-modal { animation: cossmilModal .18s ease-out; }
        @media (prefers-reduced-motion: reduce) { .cossmil-modal { animation: none; } }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        className={`cossmil-modal flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[18px] bg-white dark:bg-slate-900 shadow-[0_24px_60px_rgba(16,40,64,.28)] ${
          wide ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        {/* Cabecera */}
        <div
          className="flex shrink-0 items-center gap-3 px-5 py-3.5"
          style={{ backgroundColor: C.headBg }}
        >
          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={{ backgroundColor: C.mintTile }}>
              <Icon className="h-5 w-5" style={{ color: C.green }} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            {kicker && (
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: C.green }}>{kicker}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[17px] font-extrabold leading-tight" style={{ color: C.navy }}>{title}</h2>
              {badge && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: C.mint, color: C.green }}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 truncate text-[12.5px]" style={{ color: C.body }}>{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-auto grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] border bg-white dark:bg-slate-900 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: C.border, color: C.muted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}

        {footer && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-3"
            style={{ backgroundColor: C.headBg }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput({ as = 'input', ...props }) {
  const Tag = as;
  return (
    <Tag
      {...props}
      className="w-full rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--c-green)]"
      style={{ borderColor: C.fieldBd, color: C.navy }}
    />
  );
}

// Campo en modo lectura: misma caja, sin borde de edición.
function ReadField({ label, value }) {
  return (
    <div className="rounded-[10px] p-2.5" style={{ backgroundColor: C.fieldBg }}>
      <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>{label}</span>
      <p className="mt-0.5 text-[13px] font-bold" style={{ color: C.navy }}>{value || '—'}</p>
    </div>
  );
}

/* ==================================================================
   PESTAÑA: RESUMEN  (editable)
   ================================================================== */
function TabResumen({ patient, onUpdatePatient, onSendNotification }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifText, setNotifText] = useState('');

  const startEdit = () => {
    setDraft({
      name: patient.name || '',
      age: patient.age ?? '',
      gender: patient.gender || '',
      ci: patient.ci || '',
      phone: patient.phone || '',
      email: patient.email || '',
      diagnosis: patient.diagnosis || '',
      articulacion: capitalizar(patient.articulacion) || 'Rodilla',
      admissionDate: patient.admissionDate || '',
    });
    setEditing(true);
  };

  const save = (e) => {
    e.preventDefault();
    onUpdatePatient(patient.id, {
      ...draft,
      age: Number(draft.age) || draft.age,
      articulacion: draft.articulacion.toLowerCase(),
    });
    setEditing(false);
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const joint = capitalizar(patient.articulacion);
  const JointIcon = joint ? JOINT_ICON[joint] : null;

  // Cada "Evaluación" del historial clínico es un punto de diagnóstico
  // (así se guarda tipo_entrada = 'diagnostico' en la base). Si hay más de
  // una, es porque el cuadro evolucionó o apareció en otra articulación
  // (ej. rodilla primero, cadera después por sobrecarga) — se muestra la
  // progresión acá para que siempre quede claro cuál es la actual.
  // Se suman los "Reingreso" (`fn_reabrir_tratamiento` los escribe solos en
  // el historial) para que se vea en qué fecha volvió y qué es nuevo desde
  // ese reingreso, en vez de que el diagnóstico nuevo aparezca de la nada.
  // `patient.history` ya llega ordenado del más reciente al más antiguo.
  const diagnosticos = (patient.history || []).filter((h) => h.type === 'Evaluación' || h.type === 'Reingreso');
  const diagnosticoActualId = diagnosticos.find((d) => d.type === 'Evaluación')?.id;

  const sendNotif = (e) => {
    e.preventDefault();
    if (!notifTitle || !notifText) return;
    if (onSendNotification) onSendNotification(patient.id, notifTitle, notifText);
    setNotifTitle('');
    setNotifText('');
  };

  return (
    <div className="space-y-4">
      {/* -------- Datos de filiación -------- */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
            Datos de filiación
          </h4>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className={`${BTN} border px-2.5 py-1`}
              style={{ borderColor: C.border, color: C.green }}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              <Field label="Nombre completo"><TextInput value={draft.name} onChange={set('name')} required /></Field>
              <Field label="Edad"><TextInput type="number" min="0" max="120" value={draft.age} onChange={set('age')} /></Field>
              <Field label="Género">
                <select
                  value={draft.gender}
                  onChange={set('gender')}
                  className="w-full cursor-pointer rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-green)]"
                  style={{ borderColor: C.fieldBd, color: C.navy }}
                >
                  {['', 'Masculino', 'Femenino'].map((g) => <option key={g} value={g}>{g || 'Sin especificar'}</option>)}
                </select>
              </Field>
              <Field label="Carnet de identidad"><TextInput value={draft.ci} onChange={set('ci')} /></Field>
              <Field label="Teléfono"><TextInput value={draft.phone} onChange={set('phone')} /></Field>
              <Field label="Correo"><TextInput type="email" value={draft.email} onChange={set('email')} /></Field>
              <Field label="Fecha de admisión"><TextInput value={draft.admissionDate} onChange={set('admissionDate')} /></Field>
              <Field label="Articulación">
                <select
                  value={draft.articulacion}
                  onChange={set('articulacion')}
                  className="w-full cursor-pointer rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-green)]"
                  style={{ borderColor: C.fieldBd, color: C.navy }}
                >
                  {ARTICULACIONES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Diagnóstico">
              <TextInput as="textarea" rows="2" value={draft.diagnosis} onChange={set('diagnosis')} />
            </Field>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className={`${BTN} border px-3 py-1.5`}
                style={{ borderColor: C.fieldBd, color: C.body }}
              >
                Cancelar
              </button>
              <button type="submit" className={`${BTN} px-3 py-1.5 text-white`} style={{ backgroundColor: C.green }}>
                <Check className="h-4 w-4" /> Guardar cambios
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <ReadField label="Edad" value={patient.age ? `${patient.age} años` : ''} />
              <ReadField label="Género" value={patient.gender} />
              <ReadField label="Carnet de identidad" value={patient.ci} />
              <ReadField label="Fecha de admisión" value={patient.admissionDate} />
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <div className="rounded-[10px] p-2.5" style={{ backgroundColor: C.fieldBg }}>
                <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>
                  Diagnóstico
                </span>
                <p className="mt-0.5 text-[13px] font-bold" style={{ color: C.navy }}>{patient.diagnosis || '—'}</p>
              </div>
              <div className="rounded-[10px] p-2.5" style={{ backgroundColor: C.fieldBg }}>
                <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>
                  Articulación
                </span>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: C.navy }}>
                  {JointIcon && <JointIcon className="h-[18px] w-[18px]" style={{ color: C.joint }} />}
                  {joint || '—'}
                </p>
              </div>
            </div>

            <div
              className="flex flex-col gap-1.5 rounded-[10px] p-2.5 text-[13px]"
              style={{ backgroundColor: C.fieldBg }}
            >
              <span className="flex items-center gap-2 font-medium" style={{ color: C.navy }}>
                <Phone className="h-[14px] w-[14px]" style={{ color: C.green }} /> {patient.phone || '—'}
              </span>
              {patient.email && (
                <span className="flex items-center gap-2 font-medium" style={{ color: C.navy }}>
                  <Mail className="h-[14px] w-[14px]" style={{ color: C.green }} /> {patient.email}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* -------- Progresión del diagnóstico -------- */}
      {diagnosticos.length > 1 && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
            Progresión del diagnóstico
          </h4>
          <div className="space-y-1.5">
            {diagnosticos.map((d) => {
              // El reingreso es el punto de corte: todo lo que vino después
              // (nuevo diagnóstico, articulación) es del episodio nuevo. No
              // cuenta como "diagnóstico actual" en sí mismo, por eso tiene
              // su propia fila en vez de pelear por el badge "Actual".
              if (d.type === 'Reingreso') {
                const tono = TONO_HIST.Reingreso;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[10px] border border-dashed p-2.5 text-[12.5px]"
                    style={{ backgroundColor: tono.bg, borderColor: tono.dot }}
                  >
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.04em]"
                      style={{ backgroundColor: tono.dot, color: '#fff' }}
                    >
                      <RotateCcw className="h-3 w-3" /> Reingreso
                    </span>
                    <span className="font-bold" style={{ color: C.navy }}>{d.date}</span>
                    <span style={{ color: tono.color }}>{d.note || 'El paciente volvió a tratamiento.'}</span>
                  </div>
                );
              }

              const esActual = d.id === diagnosticoActualId;
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[10px] p-2.5 text-[12.5px]"
                  style={{ backgroundColor: esActual ? TONES.green.bg : C.fieldBg }}
                >
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.04em]"
                    style={esActual
                      ? { backgroundColor: C.mint, color: C.green }
                      : { backgroundColor: C.fieldBd, color: C.muted }}
                  >
                    {esActual ? 'Actual · En tratamiento' : 'Antecedente'}
                  </span>
                  <span className="font-bold" style={{ color: C.navy }}>{d.date}</span>
                  <span style={{ color: C.body }}>{d.note || d.title}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* -------- Métricas -------- */}
      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
          Métricas de recuperación
        </h4>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ['Asistencia', `${patient.sessionsCompleted ?? 0}/${patient.sessionsTotal ?? 0}`, 'Sesiones', TONES.blue.bg, TONES.blue.icon],
            ['Cumplimiento', `${patient.complianceRate ?? 0}%`, 'De ejercicios', TONES.green.bg, C.green],
            ['Nivel de dolor', `${patient.painLevelCurrent ?? 0}/10`, `Inicial: ${patient.painLevelInitial ?? 0}/10`, TONES.rose.bg, C.danger],
          ].map(([label, value, note, bg, color]) => (
            <div key={label} className="rounded-[10px] p-2.5 text-center" style={{ backgroundColor: bg }}>
              <span className="block text-[10px] font-bold uppercase tracking-[.06em]" style={{ color: C.body }}>{label}</span>
              <span className="mt-1 block text-[19px] font-extrabold leading-none" style={{ color }}>{value}</span>
              <span className="mt-1 block text-[10px]" style={{ color: C.muted }}>{note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* -------- Aviso al paciente -------- */}
      <section className="space-y-2.5 rounded-[12px] p-3.5" style={{ backgroundColor: C.mintForm }}>
        <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: TONES.green.tile }}>
          <AlertCircle className="h-4 w-4" style={{ color: C.green }} />
          <h4 className="text-[12px] font-bold uppercase tracking-[.06em]" style={{ color: C.green }}>
            Enviar alerta o nota al paciente
          </h4>
        </div>
        <form onSubmit={sendNotif} className="space-y-2">
          <Field label="Título del mensaje">
            <TextInput value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Ej. Ajuste de series de ejercicios" required />
          </Field>
          <Field label="Mensaje / indicaciones">
            <TextInput as="textarea" rows="2" value={notifText} onChange={(e) => setNotifText(e.target.value)} placeholder="Escriba las indicaciones de control..." required />
          </Field>
          <button type="submit" className={`${BTN} px-3 py-1.5 text-white`} style={{ backgroundColor: C.green }}>
            <CheckCircle2 className="h-4 w-4" /> Enviar notificación
          </button>
        </form>
      </section>
    </div>
  );
}

/* ==================================================================
   PESTAÑA: HISTORIAL CLÍNICO  (editable)
   ================================================================== */
// FASE 10: la evaluación con goniómetro y el alta se escriben solas en el
// historial (triggers de la base) — estilo propio para que no se confundan
// con un "Control" cualquiera. Se extiende el tono compartido de theme.js en
// vez de duplicarlo.
const TONO_HIST = {
  ...TONO_HIST_BASE,
  'Evaluación inicial': { dot: 'var(--hist-evalinicial-dot)', bg: 'var(--hist-evalinicial-bg)', color: 'var(--hist-evalinicial-color)' },
  'Evaluación final':   { dot: 'var(--hist-evalfinal-dot)',   bg: 'var(--hist-evalfinal-bg)',   color: 'var(--hist-evalfinal-color)' },
  'Alta médica':        { dot: 'var(--hist-altamedica-dot)',  bg: 'var(--hist-altamedica-bg)',  color: 'var(--hist-altamedica-color)' },
  'Reingreso':          { dot: 'var(--hist-reingreso-dot)',   bg: 'var(--hist-reingreso-bg)',   color: 'var(--hist-reingreso-color)' },
};

// Tipos que el doctor puede cargar a mano desde "Nuevo registro". Los que
// escribe sola la base (evaluaciones, alta, reingreso) no entran acá: no
// tienen un campo de tipo editable, así que ofrecerlos en el <select> solo
// invita a que una edición les cambie el tipo por error.
const TIPOS_SISTEMA = new Set(['Evaluación inicial', 'Evaluación final', 'Alta médica', 'Reingreso']);

const MAX_ADJUNTO_MB = 15;
const ACEPTA = 'image/*,application/pdf';

const esImagen = (f) => (f.type || '').startsWith('image/');
const pesoLegible = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* -------- Miniatura de un adjunto ya guardado -------- */
// Pide su propio enlace temporal para la miniatura (el depósito es privado).
// Si falla, no rompe la lista: cae al ícono genérico — el motivo real del
// fallo se ve igual al abrir el visor, que es donde de verdad importa.
function AttachmentThumb({ adjunto }) {
  const [urlMini, setUrlMini] = useState(null);
  const [fallo, setFallo] = useState(false);
  const imagen = (adjunto.type || '').startsWith('image/');

  useEffect(() => {
    if (!imagen) return undefined;
    let vivo = true;
    api.urlAdjunto(adjunto)
      .then((u) => { if (vivo) setUrlMini(u); })
      .catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, [adjunto.id, adjunto.path]);

  if (imagen && urlMini && !fallo) {
    return (
      <img
        src={urlMini}
        alt={adjunto.name}
        className="h-8 w-8 shrink-0 rounded-[6px] object-cover"
      />
    );
  }
  return imagen
    ? <ImageIcon className="h-[16px] w-[16px] shrink-0" style={{ color: C.purple }} strokeWidth={2} />
    : <FileText className="h-[16px] w-[16px] shrink-0" style={{ color: C.danger }} strokeWidth={2} />;
}

/* -------- Adjuntos ya guardados (vienen de la BD) -------- */
// `items` son los de ESTA nota; `todos` son TODOS los del paciente (para las
// flechas de siguiente/anterior del visor, que navegan por paciente, no por
// nota). Abrir ya no usa pestaña nueva — el navegador solía bloquearla — sino
// el visor de adentro del sistema.
function AttachmentList({ items, todos, idPaciente, onShowNotification, onCambiado }) {
  const [visorIndice, setVisorIndice] = useState(null);

  if (!items || items.length === 0) return null;

  const abrir = (a) => {
    const i = todos.findIndex((x) => x.id === a.id);
    setVisorIndice(i >= 0 ? i : 0);
  };

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((a, i) => (
          <button
            key={a.id ?? i}
            type="button"
            onClick={() => abrir(a)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-white dark:bg-slate-800 py-1 pl-1 pr-2 text-[11.5px] font-semibold transition-colors hover:brightness-95"
            style={{ color: C.navy }}
          >
            <AttachmentThumb adjunto={a} />
            <span className="max-w-[160px] truncate">{a.name}</span>
          </button>
        ))}
      </div>

      {visorIndice !== null && (
        <VisorAdjunto
          adjuntos={todos}
          indiceInicial={visorIndice}
          idPaciente={idPaciente}
          onClose={() => setVisorIndice(null)}
          onShowNotification={onShowNotification}
          onCambiado={onCambiado}
        />
      )}
    </>
  );
}

/* -------- Miniatura de un archivo que TODAVÍA no se subió -------- */
// Para notar de un vistazo si se eligió la radiografía equivocada, antes de
// guardar — no después, cuando ya está en el historial.
function PendingThumb({ file }) {
  const [urlLocal, setUrlLocal] = useState(null);

  useEffect(() => {
    if (!esImagen(file)) return undefined;
    const url = URL.createObjectURL(file);
    setUrlLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (urlLocal) {
    return <img src={urlLocal} alt={file.name} className="h-8 w-8 shrink-0 rounded-[6px] object-cover" />;
  }
  return esImagen(file)
    ? <ImageIcon className="h-[15px] w-[15px] shrink-0" style={{ color: C.purple }} strokeWidth={2} />
    : <FileText className="h-[15px] w-[15px] shrink-0" style={{ color: C.danger }} strokeWidth={2} />;
}

/* -------- Selector de archivos para una entrada nueva -------- */
function AttachmentPicker({ files, setFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const admitir = (lista) => {
    const entrantes = Array.from(lista || []);
    const pesados = entrantes.filter((f) => f.size > MAX_ADJUNTO_MB * 1048576);
    const validos = entrantes.filter((f) => f.size <= MAX_ADJUNTO_MB * 1048576);
    setError(pesados.length ? `${pesados.length} archivo(s) superan ${MAX_ADJUNTO_MB} MB y no se adjuntaron.` : '');
    if (validos.length) setFiles((prev) => [...prev, ...validos]);
  };

  const quitar = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>
        Adjuntos — radiografías, estudios, fotos o PDF
      </span>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); admitir(e.dataTransfer.files); }}
        className="mt-1 rounded-[10px] border border-dashed px-3 py-3 text-center transition-colors"
        style={{ borderColor: dragging ? C.green : C.fieldBd, backgroundColor: dragging ? C.mintForm : C.white }}
      >
        <Upload className="mx-auto h-5 w-5" style={{ color: C.muted }} strokeWidth={2} />
        <p className="mt-1 text-[12px]" style={{ color: C.body }}>
          Arrastra los archivos aquí o{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer font-bold underline"
            style={{ color: C.green }}
          >
            selecciónalos
          </button>
        </p>
        <p className="mt-0.5 text-[10.5px]" style={{ color: C.faded }}>
          Imágenes y PDF · hasta {MAX_ADJUNTO_MB} MB cada uno
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACEPTA}
          multiple
          className="hidden"
          onChange={(e) => { admitir(e.target.files); e.target.value = ''; }}
        />
      </div>

      {error && <p className="mt-1 text-[11px] font-semibold" style={{ color: C.danger }}>{error}</p>}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-[8px] px-2 py-1.5"
              style={{ backgroundColor: C.white }}
            >
              <PendingThumb file={f} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" style={{ color: C.navy }}>{f.name}</span>
              <span className="shrink-0 text-[10.5px]" style={{ color: C.muted }}>{pesoLegible(f.size)}</span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar ${f.name}`}
                title="Quitar de esta carga"
                className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-[5px] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                style={{ color: C.muted }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ==================================================================
   HISTORIA CLÍNICA GENERAL  (ficha de ingreso, formato papel — se llena
   una vez por paciente; aparte de las notas de seguimiento de abajo)
   ================================================================== */
const INFORMANTES_HCG = [
  { value: 'paciente', label: 'Paciente' },
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'otro', label: 'Otro' },
];

const formularioVacioHCG = {
  informante: 'paciente',
  confiable: true,
  motivoConsulta: '',
  enfermedadActual: '',
  antecedentesPatologicos: '',
  tratamientoActual: '',
  habitos: '',
  habitosHigienicos: '',
  examenFisico: '',
};

const formularioDesdeHCG = (h) =>
  h
    ? {
        informante: h.informante || 'paciente',
        confiable: h.confiable !== false,
        motivoConsulta: h.motivoConsulta || '',
        enfermedadActual: h.enfermedadActual || '',
        antecedentesPatologicos: h.antecedentesPatologicos || '',
        tratamientoActual: h.tratamientoActual || '',
        habitos: h.habitos || '',
        habitosHigienicos: h.habitosHigienicos || '',
        examenFisico: h.examenFisico || '',
      }
    : formularioVacioHCG;

function SeccionHistoriaGeneral({ patient, onGuardarHistoriaGeneral }) {
  const historia = patient.historiaGeneral;
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(() => formularioDesdeHCG(historia));

  // Cambió el paciente seleccionado: arrancar de nuevo con sus datos (o
  // vacío si todavía no tiene ficha), y cerrar cualquier edición abierta.
  useEffect(() => {
    setForm(formularioDesdeHCG(patient.historiaGeneral));
    setEditando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.motivoConsulta.trim()) return;
    onGuardarHistoriaGeneral(patient.id, form);
    setEditando(false);
  };

  const campo = (label, key, rows = 3) => (
    <Field label={label}>
      <TextInput
        as="textarea"
        rows={String(rows)}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </Field>
  );

  if (!editando) {
    return (
      <div className="rounded-[12px] p-3.5" style={{ backgroundColor: C.mintForm }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
              <FileText className="h-3.5 w-3.5" /> Historia clínica general
            </h4>
            {historia ? (
              <>
                <p className="mt-1.5 text-[13.5px] font-bold" style={{ color: C.navy }}>
                  {historia.motivoConsulta}
                </p>
                {historia.enfermedadActual && (
                  <p className="mt-1 line-clamp-2 text-[12.5px]" style={{ color: C.body }}>
                    {historia.enfermedadActual}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-[12.5px]" style={{ color: C.body }}>
                Todavía no se completó la ficha de ingreso de este paciente.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className={`${BTN} shrink-0 border px-3 py-1.5 text-[12.5px]`}
            style={{ borderColor: C.fieldBd, color: C.navy }}
          >
            {historia ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {historia ? 'Editar' : 'Completar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-[12px] p-3.5" style={{ backgroundColor: C.mintForm }}>
      <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
        <FileText className="h-3.5 w-3.5" /> Historia clínica general
      </h4>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Anamnesis — quién da la información">
          <select
            value={form.informante}
            onChange={(e) => setForm((f) => ({ ...f, informante: e.target.value }))}
            className="w-full cursor-pointer rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-green)]"
            style={{ borderColor: C.fieldBd, color: C.navy }}
          >
            {INFORMANTES_HCG.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <label className="flex cursor-pointer select-none items-center gap-2 self-end pb-2 text-[12.5px] font-semibold" style={{ color: C.navy }}>
          <input
            type="checkbox"
            checked={form.confiable}
            onChange={(e) => setForm((f) => ({ ...f, confiable: e.target.checked }))}
            className="h-4 w-4 cursor-pointer accent-[var(--c-green)]"
          />
          Datos confiables
        </label>
      </div>

      <Field label="Motivo de consulta">
        <TextInput
          value={form.motivoConsulta}
          onChange={(e) => setForm((f) => ({ ...f, motivoConsulta: e.target.value }))}
          placeholder="Ej. Dolor abdominal"
          required
        />
      </Field>

      {campo('Historia de la enfermedad actual (inicio, evolución y estado actual)', 'enfermedadActual', 4)}
      {campo('Antecedentes patológicos (enfermedades previas, cirugías)', 'antecedentesPatologicos', 3)}
      {campo('Tratamiento actual (indicación médica / automedicación)', 'tratamientoActual', 3)}
      {campo('Hábitos (alimenticios, alcohólicos, tabáquicos y otros)', 'habitos', 2)}
      {campo('Hábitos higiénicos (micción, diuresis y catarsis)', 'habitosHigienicos', 2)}
      {campo('Examen físico', 'examenFisico', 3)}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => { setForm(formularioDesdeHCG(historia)); setEditando(false); }}
          className={`${BTN} border px-3 py-1.5`}
          style={{ borderColor: C.fieldBd, color: C.body }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!form.motivoConsulta.trim()}
          className={`${BTN} px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50`}
          style={{ backgroundColor: C.green }}
        >
          <Check className="h-4 w-4" /> Guardar
        </button>
      </div>
    </form>
  );
}

function TabHistorial({ patient, onAddHistoryEntry, onUpdateHistoryEntry, onGuardarHistoriaGeneral, onShowNotification, onRecargar }) {
  const [adding, setAdding] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({ date: hoyISO(), type: 'Evolución', note: '' });
  const [files, setFiles] = useState([]);

  const history = patient.history || [];

  // Las flechas del visor navegan por TODOS los adjuntos del paciente, no
  // solo los de la nota donde se hizo clic — más recientes primero, igual
  // que llegan de la base.
  const todosLosAdjuntos = useMemo(
    () => history.flatMap((h) => h.files || []),
    [history],
  );

  const limpiar = () => {
    setForm({ date: hoyISO(), type: 'Evolución', note: '' });
    setFiles([]);
  };

  // La nota puede ir vacía si el registro es solo un adjunto (una placa, por ejemplo).
  const vacio = !form.note.trim() && files.length === 0;

  const submitNew = (e) => {
    e.preventDefault();
    if (vacio) return;
    onAddHistoryEntry(patient.id, { ...form, note: form.note.trim(), files });
    limpiar();
    setAdding(false);
  };

  const submitEdit = (e, index) => {
    e.preventDefault();
    if (vacio) return;
    // `index` es la posición en el array; la base necesita el id_historial real.
    onUpdateHistoryEntry(patient.id, history[index].id, { ...form, note: form.note.trim(), files });
    setFiles([]);
    setEditIndex(null);
  };

  const startEdit = (hist, index) => {
    setForm({ date: hist.date || hoyISO(), type: hist.type || 'Evolución', note: hist.note || '' });
    setFiles([]);
    setAdding(false);
    setEditIndex(index);
  };

  const formFields = (onSubmit, onCancel) => (
    <form onSubmit={onSubmit} className="space-y-2.5 rounded-[12px] p-3" style={{ backgroundColor: C.mintForm }}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fecha">
          <TextInput type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
        </Field>
        <Field label="Tipo de registro">
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full cursor-pointer rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-green)]"
            style={{ borderColor: C.fieldBd, color: C.navy }}
          >
            {TIPOS_HISTORIAL.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Nota clínica">
        <TextInput
          as="textarea"
          rows="3"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="Observaciones, indicaciones o hallazgos..."
        />
      </Field>

      <AttachmentPicker files={files} setFiles={setFiles} />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${BTN} border px-3 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={vacio}
          className={`${BTN} px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50`}
          style={{ backgroundColor: C.green }}
        >
          <Check className="h-4 w-4" /> Guardar
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3">
      <SeccionHistoriaGeneral patient={patient} onGuardarHistoriaGeneral={onGuardarHistoriaGeneral} />

      <div className="flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: C.border }}>
        <h4 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
          Historial clínico ({history.length})
        </h4>
        {!adding && editIndex === null && (
          <button
            type="button"
            onClick={() => { limpiar(); setAdding(true); }}
            className={`${BTN} px-3 py-1.5 text-white`}
            style={{ backgroundColor: C.green }}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo registro
          </button>
        )}
      </div>

      {adding && formFields(submitNew, () => { limpiar(); setAdding(false); })}

      {history.length === 0 && !adding ? (
        <EstadoVacio
          icon={ClipboardList}
          title="Sin registros en el historial"
          hint="Agrega notas clínicas y adjunta radiografías, estudios, fotos o PDF del paciente."
        />
      ) : (
        <div className="relative ml-2 space-y-4 border-l py-2 pl-4" style={{ borderColor: C.border }}>
          {history.map((hist, index) => {
            const tone = TONO_HIST[hist.type] || TONO_HIST['Indicación'];

            if (editIndex === index) {
              return <div key={index}>{formFields((e) => submitEdit(e, index), () => { setFiles([]); setEditIndex(null); })}</div>;
            }

            const esSistema = TIPOS_SISTEMA.has(hist.type);
            const IconoTipo = hist.type === 'Reingreso' ? RotateCcw : hist.type === 'Alta médica' ? LogOut : null;

            return (
              <div key={index} className="relative">
                <span
                  className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-900"
                  style={{ backgroundColor: tone.dot }}
                />
                <div
                  className="rounded-[12px] p-3"
                  style={esSistema
                    ? { backgroundColor: tone.bg, border: `1px solid ${tone.dot}40` }
                    : { backgroundColor: C.fieldBg }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold" style={{ color: C.muted }}>{hist.date}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.05em]"
                        style={{ backgroundColor: esSistema ? 'transparent' : tone.bg, color: tone.color }}
                      >
                        {IconoTipo && <IconoTipo className="h-3 w-3" />}
                        {hist.type}
                      </span>
                      {!esSistema && (
                        <button
                          type="button"
                          onClick={() => startEdit(hist, index)}
                          aria-label="Editar registro"
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-[6px] transition-colors hover:bg-white dark:hover:bg-white/10"
                          style={{ color: C.muted }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {hist.note && (
                    <p className="text-[13.5px] leading-relaxed" style={{ color: C.body }}>{hist.note}</p>
                  )}
                  <AttachmentList
                    items={hist.files}
                    todos={todosLosAdjuntos}
                    idPaciente={patient.db_id}
                    onShowNotification={onShowNotification}
                    onCambiado={onRecargar}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================================================================
   PESTAÑA: EVOLUCIÓN  (lectura de BD)
   ================================================================== */
function TabEvolucion({ patient }) {
  const data = patient.evolutionData || [];

  if (data.length === 0) {
    return (
      <EstadoVacio
        icon={HeartPulse}
        title="Sin mediciones de evolución"
        hint="La gráfica se arma con las evaluaciones registradas para este paciente en la base de datos."
      />
    );
  }

  const x = (i) => 30 + i * (250 / Math.max(1, data.length - 1));
  const yPain = (v) => 130 - v * 11;
  const romVal = (d) => (typeof d.ROM === 'number' ? d.ROM : parseInt(d.ROM, 10) || 50);
  const yRom = (v) => 130 - (v / 150) * 110;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12.5px] font-semibold">
        <span className="flex items-center gap-2" style={{ color: C.blueLine }}>
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: C.blueLine }} /> Dolor (EVA)
        </span>
        <span className="flex items-center gap-2" style={{ color: C.green }}>
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: C.green }} /> Rango de movimiento (ROM)
        </span>
      </div>

      <div className="rounded-[12px] p-2" style={{ backgroundColor: C.fieldBg }}>
        <svg viewBox="0 0 300 150" className="h-48 w-full" role="img" aria-label="Evolución del paciente">
          {[20, 60, 100].map((y) => (
            <line key={y} x1="30" y1={y} x2="280" y2={y} stroke={C.grid} strokeDasharray="3" />
          ))}
          <line x1="30" y1="130" x2="280" y2="130" stroke={C.fieldBd} />

          <path
            d={data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yPain(d.pain)}`).join(' ')}
            fill="none" stroke={C.blueLine} strokeWidth="2.5" strokeLinecap="round"
          />
          <path
            d={data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yRom(romVal(d))}`).join(' ')}
            fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"
          />
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={yPain(d.pain)} r="3.5" fill={C.blueLine} stroke={C.white} strokeWidth="1" />
              <circle cx={x(i)} cy={yRom(romVal(d))} r="3.5" fill={C.green} stroke={C.white} strokeWidth="1" />
              <text x={x(i)} y="145" fontSize="8" textAnchor="middle" fill={C.muted} fontWeight="bold">
                {(d.week || '').replace('Semana', 'S')}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Tabla de mediciones tal como vienen de la BD */}
      <div className="overflow-hidden rounded-[12px]" style={{ backgroundColor: C.fieldBg }}>
        <table className="w-full text-left">
          <thead style={{ backgroundColor: C.headBg, color: C.muted }}>
            <tr>
              <th className={TH}>Periodo</th>
              <th className={TH}>Dolor (EVA)</th>
              <th className={TH}>ROM</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t" style={{ borderColor: C.border }}>
                <td className={`${TD} text-[12.5px] font-bold`} style={{ color: C.navy }}>{d.week}</td>
                <td className={`${TD} text-[12.5px]`} style={{ color: C.body }}>{d.pain}/10</td>
                <td className={`${TD} text-[12.5px]`} style={{ color: C.body }}>{d.ROM}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 rounded-[12px] p-3" style={{ backgroundColor: C.fieldBg }}>
        <p className="flex items-center gap-2 text-[13px] font-bold" style={{ color: C.navy }}>
          <TrendingDown className="h-4 w-4" style={{ color: C.green }} />
          Reducción del dolor: -{(patient.painLevelInitial ?? 0) - (patient.painLevelCurrent ?? 0)} puntos de escala EVA.
        </p>
        <p className="text-[12.5px]" style={{ color: C.body }}>
          ROM inicial: <strong style={{ color: C.navy }}>{patient.romInitial ?? '—'}</strong> → Actual:{' '}
          <strong style={{ color: C.navy }}>{patient.romCurrent ?? '—'}</strong>.
        </p>
      </div>
    </div>
  );
}

/* ==================================================================
   PESTAÑA: RUTINA PRESCRITA  (lectura de BD)
   ================================================================== */
function TabRutina({ patient, onNavigateToPrescription, onEditarRutina, onEliminarRutina }) {
  const routineCruda = patient.routine;
  // Un plan que ya no está "activo" (lo reemplazó uno nuevo, o se eliminó a
  // mano) no se muestra como si siguiera vigente, aunque siga en la BD.
  const routine = routineCruda && routineCruda.estado === 'activo' ? routineCruda : null;
  const exercises = routine?.exercises || [];
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  return (
    <div className="space-y-3">
      {routine ? (
        <>
          <div className="rounded-[12px] p-3" style={{ backgroundColor: C.fieldBg }}>
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h4 className="text-[14px] font-bold leading-tight" style={{ color: C.navy }}>{routine.name}</h4>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase"
                style={{ backgroundColor: C.mint, color: C.green }}
              >
                {routine.duration} días
              </span>
            </div>
            <p className="text-[12.5px] italic" style={{ color: C.body }}>“{routine.instructions}”</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEditarRutina(patient.id, routine)}
              className={`${BTN} flex-1 border py-2 text-[12.5px]`}
              style={{ borderColor: C.fieldBd, color: C.navy }}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar rutina
            </button>
            <button
              type="button"
              onClick={() => setConfirmEliminar(true)}
              className={`${BTN} flex-1 border py-2 text-[12.5px]`}
              style={{ borderColor: TONES.rose.border, color: C.dangerStr, backgroundColor: TONES.rose.bg }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar rutina
            </button>
          </div>

          <h5 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
            Ejercicios prescritos ({exercises.length})
          </h5>

          <div className="space-y-2">
            {exercises.map((ex, index) => (
              <div
                key={index}
                className="flex justify-between gap-3 rounded-[12px] p-3 transition-colors hover:brightness-[.98]"
                style={{ backgroundColor: C.fieldBg }}
              >
                <div className="min-w-0">
                  <h6 className="truncate text-[13.5px] font-bold" style={{ color: C.navy }}>{ex.name}</h6>
                  <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.body }}>{ex.instructions}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between border-l pl-3 text-right" style={{ borderColor: C.border }}>
                  <span className="whitespace-nowrap text-[12.5px] font-bold" style={{ color: C.navy }}>
                    {ex.series} x {ex.reps}
                  </span>
                  <span
                    className="mt-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase"
                    style={{ backgroundColor: C.mint, color: C.green }}
                  >
                    {ex.freq}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EstadoVacio
          icon={Clipboard}
          title="No hay rutina activa prescrita"
          hint="Las rutinas se crean en el módulo de prescripción y se leen desde la base de datos."
        />
      )}

      <button
        type="button"
        onClick={() => onNavigateToPrescription(patient.id)}
        className={`${BTN} w-full py-2.5 text-white`}
        style={{ backgroundColor: C.green }}
      >
        <Activity className="h-4 w-4" /> Prescribir nueva rutina
      </button>

      <ConfirmDialog
        open={confirmEliminar}
        title="Eliminar rutina"
        message={`¿Eliminar "${routine?.name}"? Dejará de ser la rutina activa del paciente. El historial de ejercicios ya cumplidos no se borra.`}
        tone="danger"
        confirmLabel="Eliminar rutina"
        onConfirm={() => { setConfirmEliminar(false); onEliminarRutina(patient.id, routine.id_plan); }}
        onCancel={() => setConfirmEliminar(false)}
      />
    </div>
  );
}

/* ==================================================================
   PESTAÑA: MEDICAMENTOS
   ================================================================== */
function TabMedicamentos({ patient, onCrearReceta, onSuspenderReceta, onEliminarReceta }) {
  const medicamentos = patient.medicamentos || [];
  const activas = medicamentos.filter((m) => m.activa);
  const suspendidas = medicamentos.filter((m) => !m.activa);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nombre: '', dosis: '', frecuencia: '', fechaFin: '', indicaciones: '' });
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const limpiar = () => setForm({ nombre: '', dosis: '', frecuencia: '', fechaFin: '', indicaciones: '' });
  const vacio = !form.nombre.trim() || !form.dosis.trim() || !form.frecuencia.trim();

  const submit = (e) => {
    e.preventDefault();
    if (vacio) return;
    onCrearReceta(patient.id, form);
    limpiar();
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
          Medicamentos recetados ({activas.length})
        </h4>
        {!adding && (
          <button
            type="button"
            onClick={() => { limpiar(); setAdding(true); }}
            className={`${BTN} px-3 py-1.5 text-white`}
            style={{ backgroundColor: C.green }}
          >
            <Plus className="h-3.5 w-3.5" /> Nueva receta
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={submit} className="space-y-2.5 rounded-[12px] p-3" style={{ backgroundColor: C.mintForm }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Medicamento">
              <TextInput
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Ibuprofeno 400 mg"
                required
              />
            </Field>
            <Field label="Dosis">
              <TextInput
                value={form.dosis}
                onChange={(e) => setForm((f) => ({ ...f, dosis: e.target.value }))}
                placeholder="Ej. 1 comprimido"
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Frecuencia">
              <TextInput
                value={form.frecuencia}
                onChange={(e) => setForm((f) => ({ ...f, frecuencia: e.target.value }))}
                placeholder="Ej. Cada 8 horas"
                required
              />
            </Field>
            <Field label="Fecha fin (opcional)">
              <TextInput
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Indicaciones">
            <TextInput
              as="textarea"
              rows="2"
              value={form.indicaciones}
              onChange={(e) => setForm((f) => ({ ...f, indicaciones: e.target.value }))}
              placeholder="Ej. Tomar con alimentos, suspender si hay molestias..."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { limpiar(); setAdding(false); }} className={`${BTN} border px-3 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={vacio}
              className={`${BTN} px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50`}
              style={{ backgroundColor: C.green }}
            >
              <Check className="h-4 w-4" /> Guardar
            </button>
          </div>
        </form>
      )}

      {medicamentos.length === 0 && !adding ? (
        <EstadoVacio
          icon={Pill}
          title="Sin medicamentos recetados"
          hint="Las recetas se guardan en la ficha del paciente, igual que la rutina de ejercicios."
        />
      ) : (
        <div className="space-y-2">
          {activas.map((m) => (
            <div key={m.id} className="rounded-[12px] p-3" style={{ backgroundColor: C.fieldBg }}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <h6 className="text-[13.5px] font-bold" style={{ color: C.navy }}>{m.nombre}</h6>
                <button
                  type="button"
                  onClick={() => setConfirmEliminar(m)}
                  aria-label="Eliminar receta"
                  className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[6px] transition-colors hover:bg-white dark:hover:bg-white/10"
                  style={{ color: C.muted }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[12.5px]" style={{ color: C.body }}>{m.dosis} · {m.frecuencia}</p>
              {m.indicaciones && (
                <p className="mt-1 text-[12.5px] italic" style={{ color: C.body }}>“{m.indicaciones}”</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px]" style={{ color: C.muted }}>
                  Desde {m.fechaInicio}{m.fechaFin ? ` hasta ${m.fechaFin}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onSuspenderReceta(m.id)}
                  className={`${BTN} border px-2.5 py-1 text-[11.5px]`}
                  style={{ borderColor: C.fieldBd, color: C.body }}
                >
                  Suspender
                </button>
              </div>
            </div>
          ))}

          {suspendidas.length > 0 && (
            <>
              <h5 className="mt-3 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
                Suspendidos ({suspendidas.length})
              </h5>
              {suspendidas.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-[12px] p-3 opacity-60"
                  style={{ backgroundColor: C.fieldBg }}
                >
                  <div>
                    <h6 className="text-[13px] font-bold line-through" style={{ color: C.navy }}>{m.nombre}</h6>
                    <p className="text-[12px]" style={{ color: C.body }}>{m.dosis} · {m.frecuencia}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmEliminar(m)}
                    aria-label="Eliminar receta"
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[6px] transition-colors hover:bg-white dark:hover:bg-white/10"
                    style={{ color: C.muted }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmEliminar)}
        title="Eliminar receta"
        message={`¿Eliminar la receta de "${confirmEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Eliminar receta"
        onConfirm={() => { onEliminarReceta(confirmEliminar.id); setConfirmEliminar(null); }}
        onCancel={() => setConfirmEliminar(null)}
      />
    </div>
  );
}

/* ==================================================================
   PESTAÑA: CONTROL DE SESIONES  (lectura de BD)
   ================================================================== */
function TabSesiones({ patient }) {
  const sessions = patient.sessions || [];

  if (sessions.length === 0) {
    return (
      <EstadoVacio
        icon={Calendar}
        title="Sin sesiones registradas"
        hint="Las sesiones se programan en la agenda de controles y se leen desde la base de datos."
      />
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((sess, i) => (
        <div
          key={sess.id ?? i}
          className="rounded-[12px] p-3 transition-colors hover:brightness-[.98]"
          style={{ backgroundColor: C.fieldBg }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold" style={{ color: C.navy }}>
              {sess.date}{sess.time ? ` - ${sess.time}` : ''}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase"
              style={sess.status === 'Completada'
                ? { backgroundColor: C.mint, color: C.green }
                : sess.status === 'Incompleta'
                  ? { backgroundColor: TONES.amber.bg, color: TONES.amber.icon }
                  : sess.status === 'Abandonada'
                    ? { backgroundColor: TONES.rose.bg, color: TONES.rose.icon }
                    : { backgroundColor: TONES.blue.bg, color: TONES.blue.icon }}
            >
              {sess.status}
            </span>
          </div>
          {sess.notes && <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.body }}>{sess.notes}</p>}
          {sess.professional && (
            <span className="mt-1 block text-[11.5px]" style={{ color: C.muted }}>
              Fisioterapeuta: {sess.professional}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ==================================================================
   PESTAÑA: EVALUACIONES CON GONIÓMETRO  (antes y después — FASE 8)
   ================================================================== */
// Misma escala que usa TabEvolucion para el ROM: así las dos pantallas
// representan "recorrido completo" con la misma vara.
const MAX_ROM_ESCALA = 150;

function BarraRom({ label, valor, color }) {
  const pct = valor == null ? 0 : Math.max(2, Math.min(100, (valor / MAX_ROM_ESCALA) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11.5px] font-bold" style={{ color: C.navy }}>
        <span>{label}</span>
        <span>{valor != null ? `${valor}°` : 'pendiente'}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.grid }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function TarjetaAntesDespues({ pp }) {
  const tieneFinal = pp.romFinal != null;
  return (
    <div className="rounded-[14px] border p-3.5" style={{ borderColor: C.border, backgroundColor: C.white }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-extrabold uppercase tracking-[.05em]" style={{ color: C.navy }}>
          {pp.articulacion} · {pp.lado}
        </span>
        {pp.gananciaRom != null && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
            style={{ backgroundColor: C.mint, color: C.green }}
          >
            <TrendingUp className="h-3.5 w-3.5" /> +{pp.gananciaRom}°{pp.gananciaRomPorcentaje != null ? ` (${pp.gananciaRomPorcentaje}%)` : ''}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        <BarraRom label={`Inicial — ${pp.fechaInicial || '—'}`} valor={pp.romInicial} color={C.muted} />
        <BarraRom label={tieneFinal ? `Final — ${pp.fechaFinal}` : 'Final'} valor={pp.romFinal} color={C.green} />
      </div>

      {tieneFinal ? (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2.5 text-center" style={{ borderColor: C.border }}>
          <div>
            <span className="block text-[15px] font-extrabold" style={{ color: C.navy }}>
              {pp.reduccionDolor ?? '—'}
            </span>
            <span className="block text-[10px]" style={{ color: C.muted }}>Menos dolor (EVA)</span>
          </div>
          <div>
            <span className="block text-[15px] font-extrabold" style={{ color: C.navy }}>{pp.diasTratamiento ?? '—'}</span>
            <span className="block text-[10px]" style={{ color: C.muted }}>Días de tratamiento</span>
          </div>
          <div>
            <span className="block text-[15px] font-extrabold" style={{ color: C.navy }}>{pp.sesionesRealizadas ?? 0}</span>
            <span className="block text-[10px]" style={{ color: C.muted }}>Sesiones realizadas</span>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 text-[12px]" style={{ color: C.muted }}>
          Falta la evaluación final para calcular el resultado del tratamiento.
        </p>
      )}
    </div>
  );
}

// ==================================================================
// EL ALTA DEL PACIENTE (FASE 10)
// Mientras sigue en tratamiento: botón "Dar de alta". Ya dado de alta:
// resumen de POR QUÉ terminó y botón "Reingreso" si vuelve.
// ==================================================================
function SeccionAlta({ patient, onOpenAlta, onReingreso }) {
  const [reingresoAbierto, setReingresoAbierto] = useState(false);
  const enTratamiento = !patient.estadoTratamiento || patient.estadoTratamiento === 'en_tratamiento';
  const ultimaAlta = (patient.altas || [])[0] || null;

  if (enTratamiento) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[14px] border p-3.5" style={{ borderColor: C.border, backgroundColor: C.white }}>
        <p className="text-[12.5px]" style={{ color: C.body }}>
          Cuando el paciente termine el tratamiento, cierra el ciclo con el alta: cambia su estado,
          cierra el plan y queda escrito en el historial.
        </p>
        <button
          type="button"
          onClick={() => onOpenAlta(patient.id)}
          className={`${BTN} shrink-0 px-3 py-1.5 text-white`}
          style={{ backgroundColor: C.purple }}
        >
          <LogOut className="h-3.5 w-3.5" /> Dar de alta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-[14px] border p-3.5" style={{ borderColor: C.border, backgroundColor: C.white }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-extrabold uppercase tracking-[.05em]" style={{ color: C.navy }}>
          {ultimaAlta ? (TIPO_ALTA_LABEL[ultimaAlta.tipoAlta] || ultimaAlta.tipoAlta) : 'Fuera de tratamiento'}
          {ultimaAlta && ` · ${ultimaAlta.fechaAlta}`}
        </span>
        <button
          type="button"
          onClick={() => setReingresoAbierto(true)}
          className={`${BTN} border px-3 py-1.5`}
          style={{ borderColor: C.fieldBd, color: C.green }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reingreso
        </button>
      </div>

      {ultimaAlta && (
        <>
          <p className="text-[12.5px]" style={{ color: C.body }}>{ultimaAlta.motivo}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" style={{ color: C.muted }}>
            <span>Estado funcional: <strong style={{ color: C.navy }}>{ESTADO_FUNCIONAL_LABEL[ultimaAlta.estadoFuncional] || ultimaAlta.estadoFuncional}</strong></span>
            {ultimaAlta.romAlcanzado != null && <span>ROM alcanzado: <strong style={{ color: C.navy }}>{ultimaAlta.romAlcanzado}°</strong></span>}
            {ultimaAlta.gananciaRom != null && <span>Ganancia: <strong style={{ color: C.green }}>+{ultimaAlta.gananciaRom}°</strong></span>}
          </div>
          {ultimaAlta.requiereControl && (
            <div
              className="flex items-center gap-2 rounded-[10px] p-2.5 text-[12.5px] font-semibold"
              style={ultimaAlta.controlVencido
                ? { backgroundColor: TONES.amber.bg, color: TONES.amber.icon }
                : { backgroundColor: C.grid, color: C.body }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {ultimaAlta.controlVencido
                ? `Control vencido — estaba programado para el ${ultimaAlta.fechaControlSugerida}. Hay que llamarlo.`
                : `Control programado para el ${ultimaAlta.fechaControlSugerida}.`}
            </div>
          )}
        </>
      )}

      {reingresoAbierto && (
        <ModalReingreso
          patient={patient}
          ultimaAlta={ultimaAlta}
          onClose={() => setReingresoAbierto(false)}
          onConfirm={onReingreso}
        />
      )}
    </div>
  );
}

// Ventana chica: el paciente vuelve a tratamiento. El motivo es opcional
// (`fn_reabrir_tratamiento` lo acepta nulo). La articulación y el diagnóstico
// arrancan precargados con lo que el paciente ya tenía — si el médico los deja
// igual, no cambia nada más que el estado; si los toca (p. ej. tuvo alta de
// cadera y reingresa por rodilla), la base deja el diagnóstico anterior como
// antecedente y el Resumen del paciente queda mostrando el nuevo solo.
function ModalReingreso({ patient, ultimaAlta, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [articulacion, setArticulacion] = useState(capitalizar(patient.articulacion) || 'Rodilla');
  const [diagnostico, setDiagnostico] = useState(patient.diagnosis || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await onConfirm(patient.id, motivo.trim() || null, articulacion, diagnostico.trim() || null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <h3 className="text-[15px] font-extrabold" style={{ color: C.navy }}>Reingreso de {patient.name}</h3>
        <p className="mt-1 text-[12.5px]" style={{ color: C.body }}>
          El paciente vuelve a tratamiento: queda "En tratamiento" otra vez. Si vuelve por otra
          articulación, cambiala acá — la anterior queda guardada como antecedente.
        </p>
        {error && <p className="mt-2 text-[12px] font-semibold text-red-600">{error}</p>}

        {ultimaAlta && (
          <div className="mt-4 space-y-3 rounded-[14px] border p-3.5" style={{ borderColor: C.border, backgroundColor: C.fieldBg }}>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
              <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: C.muted }}>
                Ficha anterior — {TIPO_ALTA_LABEL[ultimaAlta.tipoAlta] || ultimaAlta.tipoAlta} · {ultimaAlta.fechaAlta}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <ReadField label="Diagnóstico anterior" value={patient.diagnosis} />
              <ReadField label="Articulación anterior" value={ultimaAlta.articulacionPrincipal} />
            </div>

            <div className="rounded-[10px] p-2.5" style={{ backgroundColor: C.white }}>
              <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>
                Motivo por el que se dio de alta
              </span>
              <p className="mt-0.5 text-[12.5px]" style={{ color: C.body }}>{ultimaAlta.motivo || '—'}</p>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]" style={{ color: C.muted }}>
              <span>Estado funcional: <strong style={{ color: C.navy }}>{ESTADO_FUNCIONAL_LABEL[ultimaAlta.estadoFuncional] || ultimaAlta.estadoFuncional || '—'}</strong></span>
              {ultimaAlta.romAlcanzado != null && <span>ROM alcanzado: <strong style={{ color: C.navy }}>{ultimaAlta.romAlcanzado}°</strong></span>}
              {ultimaAlta.gananciaRom != null && <span>Ganancia: <strong style={{ color: C.green }}>+{ultimaAlta.gananciaRom}°</strong></span>}
              {ultimaAlta.dolorFinal != null && <span>Dolor final: <strong style={{ color: C.navy }}>{ultimaAlta.dolorFinal}/10</strong></span>}
              {ultimaAlta.diasDeTratamiento != null && <span>Duración: <strong style={{ color: C.navy }}>{ultimaAlta.diasDeTratamiento} días</strong></span>}
              {ultimaAlta.sesionesRealizadas != null && <span>Sesiones: <strong style={{ color: C.navy }}>{ultimaAlta.sesionesRealizadas}</strong></span>}
            </div>

            {ultimaAlta.recomendaciones && (
              <p className="text-[11.5px] italic" style={{ color: C.muted }}>
                Recomendaciones del alta: {ultimaAlta.recomendaciones}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Articulación">
              <select
                value={articulacion}
                onChange={(e) => setArticulacion(e.target.value)}
                className="w-full cursor-pointer rounded-[9px] border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--c-green)]"
                style={{ borderColor: C.fieldBd, color: C.navy }}
              >
                {ARTICULACIONES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Diagnóstico">
              <TextInput value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="Ej. Artrosis de rodilla" />
            </Field>
          </div>
          <Field label="Motivo del reingreso (opcional)">
            <TextInput
              as="textarea"
              rows="3"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Vuelve por recaída de dolor..."
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BTN} border px-3.5 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            className={`${BTN} px-3.5 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-60`}
            style={{ backgroundColor: C.green }}
          >
            {guardando ? 'Guardando...' : 'Confirmar reingreso'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabEvaluaciones({ patient, onOpenEvaluacion, onOpenAlta, onReingreso }) {
  const evaluaciones = patient.evaluaciones || [];
  const prePost = patient.evaluacionesPrePost || [];

  const tieneInicial = evaluaciones.some((e) => e.momento === 'inicial');
  const tieneFinal = evaluaciones.some((e) => e.momento === 'final');

  // "El plan ya terminó" = no tiene plan activo, o el plan activo ya pasó su
  // fecha estimada de fin. Sin la final, este paciente no entra en los
  // resultados de la tesis (punto 6 de la FASE 8).
  const planActivo = patient.routine?.estado === 'activo';
  const planVencido = Boolean(patient.routine?.endDate) && patient.routine.endDate < hoyISO();
  const faltaFinal = tieneInicial && !tieneFinal && (!planActivo || planVencido);

  // Solo hay dos momentos: inicial y final. Con ambos registrados no queda
  // nada más que registrar (el resto es historial, se edita desde la lista).
  const yaCompleto = tieneInicial && tieneFinal;
  const siguienteMomento = !tieneInicial ? 'inicial' : 'final';
  const etiquetaBoton = siguienteMomento === 'inicial'
    ? 'Registrar evaluación inicial'
    : 'Registrar evaluación final';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
          Evaluaciones con goniómetro
        </h4>
        {!yaCompleto && (
          <button
            type="button"
            onClick={() => onOpenEvaluacion(patient.id, siguienteMomento, null)}
            className={`${BTN} px-3 py-1.5 text-white`}
            style={{ backgroundColor: C.green }}
          >
            <Ruler className="h-3.5 w-3.5" /> {etiquetaBoton}
          </button>
        )}
      </div>

      {faltaFinal && (
        <div
          className="flex items-center gap-2 rounded-[10px] p-2.5 text-[12.5px] font-semibold"
          style={{ backgroundColor: TONES.amber.bg, color: TONES.amber.icon }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Falta la evaluación final: el plan ya terminó y sin ella este paciente no entra en los resultados.
        </div>
      )}

      {prePost.length === 0 ? (
        <EstadoVacio
          icon={Ruler}
          title="Sin evaluación inicial registrada"
          hint="Se toma ANTES de que el paciente empiece a usar la aplicación. Sin esta medición no se puede calcular si el tratamiento sirvió."
        />
      ) : (
        <div className="space-y-3">
          {prePost.map((pp, i) => <TarjetaAntesDespues key={i} pp={pp} />)}
        </div>
      )}

      {evaluaciones.length > 0 && (
        <div>
          <h5 className="mb-1.5 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
            Historial de mediciones ({evaluaciones.length})
          </h5>
          <div className="space-y-1.5">
            {evaluaciones.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] p-2.5 text-[12px]"
                style={{ backgroundColor: C.fieldBg }}
              >
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase"
                  style={{ backgroundColor: C.mint, color: C.green }}
                >
                  {e.momento}
                </span>
                <span className="font-bold" style={{ color: C.navy }}>{e.fecha}</span>
                <span style={{ color: C.body }}>{e.articulacion} · {e.lado}</span>
                <span style={{ color: C.body }}>{e.anguloMinimo}° a {e.anguloMaximo}° (ROM {e.romGoniometro}°)</span>
                {e.anguloApp != null && (
                  <span style={{ color: e.dentroUmbral ? C.green : C.danger }}>
                    Cámara: {e.anguloApp}° ({e.dentroUmbral ? 'dentro' : 'fuera'} del umbral)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenEvaluacion(patient.id, e.momento, e)}
                  className="ml-auto grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[6px] transition-colors hover:bg-white dark:hover:bg-white/10"
                  style={{ color: C.muted }}
                  aria-label="Editar evaluación"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-4" style={{ borderColor: C.border }}>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
          Estado del tratamiento
        </h4>
        <SeccionAlta patient={patient} onOpenAlta={onOpenAlta} onReingreso={onReingreso} />
      </div>
    </div>
  );
}

/* ==================================================================
   MODAL DEL EXPEDIENTE
   ================================================================== */
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'historial', label: 'Historial Clínico' },
  { id: 'evaluaciones', label: 'Evaluaciones' },
  { id: 'evolucion', label: 'Evolución' },
  { id: 'rutina', label: 'Rutina Prescrita' },
  { id: 'medicamentos', label: 'Medicamentos' },
  { id: 'sesiones', label: 'Control de Sesiones' },
];

function ExpedienteModal({
  patient, activeTab, setActiveTab, onClose, onUpdatePatient, onAddHistoryEntry,
  onUpdateHistoryEntry, onNavigateToPrescription, onEditarRutina, onEliminarRutina,
  onSendNotification, onToggleStatus,
  onOpenEvaluacion, onOpenAlta, onReingreso, onShowNotification, onRecargar,
  onCrearReceta, onSuspenderReceta, onEliminarReceta, onGuardarHistoriaGeneral,
}) {
  const tone = STATUS[patient.status] || STATUS.Inactivo;

  return (
    <ModalShell
      wide
      icon={FileText}
      kicker="Expediente clínico"
      title={patient.name}
      subtitle={patient.diagnosis}
      badge={patient.id}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-[12px]" style={{ color: C.muted }}>
            Estado del paciente
            <StatusToggle status={patient.status} onToggle={(next) => onToggleStatus(patient.id, next)} />
          </span>
          <button type="button" onClick={onClose} className={`${BTN} border px-3.5 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
            Cerrar
          </button>
        </>
      }
    >
      {/* Pestañas */}
      <div className="flex shrink-0 overflow-x-auto border-b px-2" style={{ borderColor: C.border }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-bold transition-colors"
              style={isActive ? { borderColor: C.green, color: C.green } : { borderColor: 'transparent', color: C.muted }}
            >
              {tab.label}
            </button>
          );
        })}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 pr-2">
          <EstadoTratamientoBadge estado={patient.estadoTratamiento} />
          <Badge tone={tone} dot>{patient.status}</Badge>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {activeTab === 'resumen' && (
          <TabResumen patient={patient} onUpdatePatient={onUpdatePatient} onSendNotification={onSendNotification} />
        )}
        {activeTab === 'historial' && (
          <TabHistorial
            patient={patient}
            onAddHistoryEntry={onAddHistoryEntry}
            onUpdateHistoryEntry={onUpdateHistoryEntry}
            onGuardarHistoriaGeneral={onGuardarHistoriaGeneral}
            onShowNotification={onShowNotification}
            onRecargar={onRecargar}
          />
        )}
        {activeTab === 'evaluaciones' && (
          <TabEvaluaciones
            patient={patient}
            onOpenEvaluacion={onOpenEvaluacion}
            onOpenAlta={onOpenAlta}
            onReingreso={onReingreso}
          />
        )}
        {activeTab === 'evolucion' && <TabEvolucion patient={patient} />}
        {activeTab === 'rutina' && (
          <TabRutina
            patient={patient}
            onNavigateToPrescription={onNavigateToPrescription}
            onEditarRutina={onEditarRutina}
            onEliminarRutina={onEliminarRutina}
          />
        )}
        {activeTab === 'medicamentos' && (
          <TabMedicamentos
            patient={patient}
            onCrearReceta={onCrearReceta}
            onSuspenderReceta={onSuspenderReceta}
            onEliminarReceta={onEliminarReceta}
          />
        )}
        {activeTab === 'sesiones' && <TabSesiones patient={patient} />}
      </div>
    </ModalShell>
  );
}

/* ==================================================================
   MÓDULO DE PACIENTES
   ================================================================== */
export default function ModuloPacientes({
  patients,
  selectedPatientId,
  onSelectPatient,
  onOpenNewPatientModal,
  activeTabInDetail,
  setActiveTabInDetail,
  onNavigateToPrescription,
  onEditarRutina = () => {},
  onEliminarRutina = () => {},
  onSendNotification,
  onUpdatePatient = () => {},
  onAddHistoryEntry = () => {},
  onUpdateHistoryEntry = () => {},
  onToggleStatus = () => {},
  onOpenEvaluacion = () => {},
  onOpenAlta = () => {},
  onReingreso = () => {},
  onCrearReceta = () => {},
  onSuspenderReceta = () => {},
  onEliminarReceta = () => {},
  onGuardarHistoriaGeneral = () => {},
  onShowNotification = () => {},
  onRecargar = () => {},
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [jointFilter, setJointFilter] = useState('Todos');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // El interruptor responde al instante aunque el padre todavía no haya
  // persistido el cambio. Cuando `patients` llega con el valor ya aplicado,
  // el override sobra y se descarta.
  const [statusOverrides, setStatusOverrides] = useState({});

  useEffect(() => {
    setStatusOverrides((prev) => {
      const pending = Object.entries(prev).filter(([id, value]) => {
        const p = patients.find((x) => x.id === id);
        return p && p.status !== value;
      });
      if (pending.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(pending);
    });
  }, [patients]);

  const statusDe = (p) => statusOverrides[p.id] ?? p.status;

  const toggleStatus = (id, next) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: next }));
    onToggleStatus(id, next);
  };

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.ci.toLowerCase().includes(q) ||
        p.diagnosis.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'Todos' || (statusOverrides[p.id] ?? p.status) === statusFilter;
      const joint = capitalizar(p.articulacion);
      const matchesJoint = jointFilter === 'Todos' || joint === jointFilter;
      return matchesSearch && matchesStatus && matchesJoint;
    }).sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [patients, searchQuery, statusFilter, jointFilter, statusOverrides, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  // Si un filtro deja la página actual fuera de rango, volvemos a la última válida.
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = filteredPatients.slice(from, from + pageSize);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('Todos');
    setJointFilter('Todos');
    setSortAsc(true);
    setPage(1);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="space-y-3 pb-4">
      {/* ===================== Cabecera ===================== */}
      <EncabezadoModulo
        icon={Users}
        title="Pacientes"
        subtitle="Registro de pacientes, control clínico y seguimiento de tratamientos."
        actionLabel="Registrar paciente"
        actionIcon={UserPlus}
        onAction={onOpenNewPatientModal}
      />

      {/* ===================== Barra de filtros ===================== */}
      <BarraFiltros
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        searchPlaceholder="Buscar por nombre, apellido, CI o código..."
        onLimpiar={resetFilters}
      >
        <FilterDropdown
          icon={Users}
          label="Estado"
          value={statusFilter}
          options={['Todos', 'Activo', 'Inactivo']}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />

        <FilterDropdown
          icon={IconRodilla}
          label="Articulación"
          value={jointFilter}
          options={['Todos', 'Rodilla', 'Cadera']}
          onChange={(v) => { setJointFilter(v); setPage(1); }}
        />

        <button
          type="button"
          onClick={() => setSortAsc((v) => !v)}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-bold transition-colors hover:bg-white dark:hover:bg-slate-800"
          style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.navy }}
          title="Ordenar por paciente"
        >
          {sortAsc ? <ArrowDownAZ className="h-4 w-4" strokeWidth={2.1} /> : <ArrowUpAZ className="h-4 w-4" strokeWidth={2.1} />}
          {sortAsc ? 'A-Z' : 'Z-A'}
        </button>
      </BarraFiltros>

      {/* ===================== Tabla ===================== */}
      <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <Tabla
          anchos={['w-[100px]', '', 'w-[150px]', 'w-[210px]', 'w-[140px]', 'w-[150px]', 'w-[160px]']}
          minWidth="980px"
          columnas={[
            { label: 'Código' },
            { label: 'Paciente' },
            { label: 'Estado' },
            { label: 'Diagnóstico' },
            { label: 'Última sesión' },
            { label: 'Registro' },
            { label: 'Acciones' },
          ]}
          filas={pageRows}
          pageSize={pageSize}
          mensajeVacio="No se encontraron pacientes coincidentes."
          renderFila={(patient, i) => {
            const av = AVATARS[(from + i) % AVATARS.length];
            const ultima = ultimaSesionDe(patient);

            return (
              <tr
                key={patient.id}
                className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60"
                style={{ borderColor: C.border }}
              >
                <td className={`${TD} text-[12.5px] font-bold`} style={{ color: C.navy }}>{patient.id}</td>

                <td className={TD}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold"
                      style={{ backgroundColor: av.bg, color: av.color }}
                    >
                      {initials(patient.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="truncate text-[13px] font-bold leading-tight" style={{ color: C.navy }}>
                        {patient.name}
                      </span>
                      <span className="block text-[11.5px] leading-tight" style={{ color: C.muted }}>
                        CI: {patient.ci}
                      </span>
                    </span>
                  </div>
                </td>

                <td className={TD}>
                  <EstadoTratamientoBadge estado={patient.estadoTratamiento} />
                </td>

                <td className={`${TD} max-w-[210px] truncate text-[12.5px]`} style={{ color: C.body }}>
                  {patient.diagnosis}
                </td>

                <td className={TD}>
                  {ultima ? (
                    <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: C.body }}>
                      <Calendar className="h-[15px] w-[15px] shrink-0" style={{ color: C.muted }} strokeWidth={1.8} />
                      {ultima.date}
                    </span>
                  ) : (
                    <span className="text-[12.5px]" style={{ color: C.faded }}>Sin sesiones</span>
                  )}
                </td>

                <td className={TD}>
                  <StatusToggle status={statusDe(patient)} onToggle={(next) => toggleStatus(patient.id, next)} />
                </td>

                <td className={TD}>
                  <button
                    type="button"
                    onClick={() => onSelectPatient(patient.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-[var(--c-green)] hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20"
                    style={{ borderColor: C.border, color: C.navy }}
                  >
                    <FileText className="h-[13px] w-[13px]" style={{ color: C.green }} strokeWidth={2} />
                    Ver expediente
                    <ChevronRight className="h-[13px] w-[13px]" style={{ color: C.muted }} />
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
          total={filteredPatients.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta="pacientes"
        />
      </div>

      {/* ===================== Expediente flotante ===================== */}
      {selectedPatient && (
        <ExpedienteModal
          patient={{ ...selectedPatient, status: statusDe(selectedPatient) }}
          activeTab={activeTabInDetail || 'resumen'}
          setActiveTab={setActiveTabInDetail}
          onClose={() => onSelectPatient(null)}
          onUpdatePatient={onUpdatePatient}
          onAddHistoryEntry={onAddHistoryEntry}
          onUpdateHistoryEntry={onUpdateHistoryEntry}
          onNavigateToPrescription={onNavigateToPrescription}
          onEditarRutina={onEditarRutina}
          onEliminarRutina={onEliminarRutina}
          onSendNotification={onSendNotification}
          onToggleStatus={toggleStatus}
          onOpenEvaluacion={onOpenEvaluacion}
          onOpenAlta={onOpenAlta}
          onReingreso={onReingreso}
          onCrearReceta={onCrearReceta}
          onSuspenderReceta={onSuspenderReceta}
          onEliminarReceta={onEliminarReceta}
          onGuardarHistoriaGeneral={onGuardarHistoriaGeneral}
          onShowNotification={onShowNotification}
          onRecargar={onRecargar}
        />
      )}
    </div>
  );
}
