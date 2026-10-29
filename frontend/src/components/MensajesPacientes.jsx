import React, { useState, useMemo } from 'react';
import { Send, Bell, AlertTriangle, Info, CheckCheck, Users, Zap, Search } from 'lucide-react';
import * as api from '../lib/api';
import { C, CARD } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';

// =============================================================================
// Mensajes y avisos.
// -----------------------------------------------------------------------------
// Dos mitades que comparten la misma tabla `notificaciones`:
//
//   IZQUIERDA  lo que el médico ESCRIBE. Va por `fn_mensaje_a_paciente`, que
//              comprueba en la base que ese paciente sea suyo. No hay forma de
//              escribirle a un paciente ajeno cambiando un id en el navegador.
//
//   DERECHA    lo que el médico RECIBE. Mezcla lo que le manda el sistema
//              (adherencia, dolor alto, técnica, citas incumplidas) con lo que
//              le escriben otros profesionales.
// =============================================================================

const ICONO = { alerta: AlertTriangle, aviso: Bell, info: Info };
const COLOR = {
  alerta: 'text-rose-600 bg-rose-50 border-rose-200',
  aviso: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  info: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
};

const PLANTILLAS = [
  ['Recordatorio de ejercicios', 'Recuerda completar tus ejercicios de hoy. La constancia es lo que sostiene la mejora del rango de movimiento.', 'aviso'],
  ['Corrige tu técnica', 'Revisé tu última sesión: el movimiento salió fuera del rango esperado. Vuelve a ver el video de referencia y haz el ejercicio más lento.', 'aviso'],
  ['Vas muy bien', 'Revisé tu progreso y el rango de movimiento mejoró respecto a la semana pasada. Sigue así.', 'info'],
  ['Baja la carga', 'Con el dolor que reportaste, reduce a la mitad las repeticiones hasta tu próximo control y aplica hielo 10 minutos al terminar.', 'alerta'],
];

export default function MensajesPacientes({
  pacientes, notificaciones, onRecargar, onShowNotification,
}) {
  const [destinatarios, setDestinatarios] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [severidad, setSeveridad] = useState('info');
  const [enviando, setEnviando] = useState(false);
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const conCuenta = useMemo(
    () => (pacientes || []).filter((p) => p.id_usuario),
    [pacientes],
  );

  const bandeja = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (notificaciones || []).filter((n) => {
      if (soloSinLeer && n.read) return false;
      if (!q) return true;
      return [n.text, n.mensaje, n.categoria].filter(Boolean).some((x) => x.toLowerCase().includes(q));
    });
  }, [notificaciones, soloSinLeer, busqueda]);

  const alternar = (dbId) =>
    setDestinatarios((prev) =>
      prev.includes(dbId) ? prev.filter((x) => x !== dbId) : [...prev, dbId],
    );

  const enviar = async (e) => {
    e.preventDefault();
    if (!destinatarios.length) {
      onShowNotification?.('Selecciona al menos un paciente', 'error');
      return;
    }
    setEnviando(true);
    try {
      if (destinatarios.length === 1) {
        await api.enviarMensajePaciente(destinatarios[0], titulo, mensaje, severidad);
      } else {
        await api.enviarMensajeMasivo(destinatarios, titulo, mensaje, severidad);
      }
      onShowNotification?.(
        `Mensaje enviado a ${destinatarios.length} paciente${destinatarios.length > 1 ? 's' : ''}`,
      );
      setTitulo('');
      setMensaje('');
      setDestinatarios([]);
      await onRecargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const marcarTodo = async () => {
    try {
      await api.marcarNotificacionesLeidas(null);
      await onRecargar();
      onShowNotification?.('Avisos marcados como leídos');
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  const revisarAhora = async () => {
    try {
      const r = await api.ejecutarRevisionAlertas();
      onShowNotification?.(
        `Revisión ejecutada: ${r.adherencia ?? 0} avisos de adherencia, ${r.dolor_alto ?? 0} de dolor, ${r.recordatorios_cita ?? 0} recordatorios.`,
      );
      await onRecargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  return (
    <div className="space-y-3 pb-4 animate-slide-in">
      <EncabezadoModulo
        icon={Bell}
        title="Mensajes y avisos"
        subtitle="Escribile a tus pacientes y revisá los avisos que te manda el sistema (adherencia, dolor, técnica y citas)."
      />

      <div className="grid gap-5 xl:grid-cols-2">
      {/* ------------------------------------------------------- ESCRIBIR */}
      <form onSubmit={enviar} className={`p-5 ${CARD}`} style={{ borderColor: C.border }}>
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: C.navy }}>
          <Send className="h-[18px] w-[18px]" style={{ color: C.green }} /> Escribir al paciente
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          El mensaje le llega a la app como notificación y queda firmado con tu nombre.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Destinatarios <span className="font-normal text-slate-400 dark:text-slate-500">({destinatarios.length} seleccionados)</span>
            </p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2">
              {conCuenta.length === 0 && (
                <p className="p-2 text-xs text-slate-400 dark:text-slate-500">
                  Ninguno de tus pacientes tiene todavía cuenta de acceso, así que no hay a quién escribir.
                </p>
              )}
              {conCuenta.map((p) => (
                <label key={p.db_id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={destinatarios.includes(p.db_id)}
                    onChange={() => alternar(p.db_id)}
                    className="h-4 w-4 accent-green-800"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{p.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{p.id}</span>
                  {p.complianceRate < 80 && (
                    <span className="ml-auto rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      adherencia {p.complianceRate}%
                    </span>
                  )}
                </label>
              ))}
            </div>
            {conCuenta.length > 0 && (
              <button
                type="button"
                onClick={() => setDestinatarios(conCuenta.map((p) => p.db_id))}
                className="mt-1 flex items-center gap-1 text-xs font-bold text-green-800"
              >
                <Users className="h-3 w-3" /> Seleccionar todos
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PLANTILLAS.map(([t, m, s]) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTitulo(t); setMensaje(m); setSeveridad(s); }}
                className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:border-green-700 hover:text-green-800"
              >
                {t}
              </button>
            ))}
          </div>

          <input
            required maxLength={150} value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del mensaje"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm"
          />
          <textarea
            required rows="5" value={mensaje} onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribe aquí el mensaje que verá el paciente…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm"
          />

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Importancia
              <select
                value={severidad} onChange={(e) => setSeveridad(e.target.value)}
                className="ml-2 rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-sm font-normal"
              >
                <option value="info">Informativo</option>
                <option value="aviso">Aviso</option>
                <option value="alerta">Alerta</option>
              </select>
            </label>
            <button
              disabled={enviando}
              className="ml-auto flex items-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </form>

      {/* -------------------------------------------------------- RECIBIR */}
      <div className={`p-5 ${CARD}`} style={{ borderColor: C.border }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: C.navy }}>
            <Bell className="h-[18px] w-[18px]" style={{ color: C.green }} /> Mis avisos
          </h2>
          <div className="flex gap-2">
            <button
              onClick={revisarAhora}
              title="Ejecuta ahora la revisión que normalmente corre cada hora"
              className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              style={{ borderColor: C.fieldBd, color: C.body }}
            >
              <Zap className="h-3.5 w-3.5" /> Revisar ahora
            </button>
            <button
              onClick={marcarTodo}
              className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              style={{ borderColor: C.fieldBd, color: C.body }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídos
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="relative block min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en mis avisos..."
              className="h-9 w-full rounded-[10px] border pl-9 pr-3 text-[12.5px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]"
              style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.navy }}
            />
          </label>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] font-semibold" style={{ color: C.body }}>
            <input
              type="checkbox" checked={soloSinLeer} onChange={(e) => setSoloSinLeer(e.target.checked)}
              className="h-3.5 w-3.5 accent-green-800"
            />
            Solo sin leer
          </label>
        </div>

        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
          {bandeja.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-[12px]" style={{ borderColor: C.fieldBd, color: C.muted }}>
              Sin avisos. El sistema revisa adherencia, dolor, técnica y citas cada hora.
            </p>
          )}
          {bandeja.map((n) => {
            const Icon = ICONO[n.severidad] || Info;
            return (
              <article
                key={n.id}
                className={`rounded-xl border p-3 ${n.read ? 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}
              >
                <div className="flex gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${COLOR[n.severidad] || COLOR.info}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{n.text}</p>
                    <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600 dark:text-slate-400">{n.mensaje}</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      {n.time} · {n.categoria}
                      {!n.read && <span className="ml-2 font-bold text-green-800">nuevo</span>}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
