import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarClock, CalendarDays, Clock, Plus, RefreshCw, CheckCircle2, XCircle, UserX, X, MapPin,
} from 'lucide-react';
import { ESTADO_CITA_LABEL, fmtFechaHora } from '../lib/mappers';
import * as api from '../lib/api';
import { C, CARD } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import FilterDropdown from './ui/FilterDropdown';
import Paginacion from './ui/Paginacion';
import EstadoVacio from './ui/EstadoVacio';

// =============================================================================
// Agenda de controles.
// -----------------------------------------------------------------------------
// Aquí el médico dice CUÁNDO es la próxima sesión de control. No hay ningún
// `fetch` al aviso del paciente: al insertar la cita, el trigger `trg_avisar_
// cita_alta` le manda la notificación, y el revisor horario le recuerda 24 h
// antes. Si el paciente no aparece, el mismo revisor marca 'ausente' y avisa a
// los dos. La app no tiene que acordarse de nada.
// =============================================================================

const TONO = {
  programada: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  confirmada: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200',
  cumplida: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  ausente: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelada: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700',
  reprogramada: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

function ModalCita({ paciente, cita, pacientes, onGuardar, onCerrar }) {
  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; };
  }, []);

  const [idPaciente, setIdPaciente] = useState(paciente?.db_id || cita?.id_paciente || '');
  const [fecha, setFecha] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [tipo, setTipo] = useState('control');
  const [modalidad, setModalidad] = useState('presencial');
  const [duracion, setDuracion] = useState(45);
  const [motivo, setMotivo] = useState('Control de rango articular y adherencia');
  const [indicaciones, setIndicaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        id_paciente: Number(idPaciente),
        fecha_hora: new Date(fecha).toISOString(),
        duracion_minutos: Number(duracion),
        tipo,
        modalidad,
        motivo,
        indicaciones: indicaciones || null,
      });
      onCerrar();
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={enviar} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200">Programar próximo control</h2>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            Paciente
            <select
              required
              value={idPaciente}
              onChange={(e) => setIdPaciente(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            >
              <option value="">Selecciona…</option>
              {pacientes.map((p) => (
                <option key={p.db_id} value={p.db_id}>{p.name} · {p.id}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Fecha y hora
            <input
              required type="datetime-local" value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            />
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Duración (min)
            <input
              type="number" min="5" max="480" value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            />
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Tipo
            <select
              value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            >
              <option value="control">Control</option>
              <option value="evaluacion_inicial">Evaluación inicial</option>
              <option value="terapia">Terapia</option>
              <option value="reevaluacion">Reevaluación</option>
              <option value="alta">Alta</option>
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Modalidad
            <select
              value={modalidad} onChange={(e) => setModalidad(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            >
              <option value="presencial">Presencial</option>
              <option value="domiciliaria">Domiciliaria</option>
              <option value="remota">Remota</option>
            </select>
          </label>

          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            Motivo
            <input
              value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            />
          </label>

          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            Indicaciones para el paciente (le llegan en la notificación)
            <textarea
              rows="3" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Venir con ropa cómoda, no tomar analgésicos 4 h antes…"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 p-5">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400">
            Cancelar
          </button>
          <button disabled={guardando} className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Agendar y avisar'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const VISTAS = ['Próximas', 'Sin cerrar', 'Historial', 'Todas'];

export default function AgendaCitas({ citas, pacientes, onRecargar, onShowNotification }) {
  const [modal, setModal] = useState(false);
  const [vista, setVista] = useState('Próximas');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // `ahora` se calcula una vez por render de la lista y no dentro del filtro:
  // así todas las citas se comparan contra el mismo instante.
  const ahora = useMemo(() => Date.now(), [citas]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (citas || []).filter((c) => {
      if (vista === 'Próximas') {
        if (!(new Date(c.fecha_hora).getTime() >= ahora && !['cancelada', 'cumplida', 'reprogramada'].includes(c.estado))) return false;
      } else if (vista === 'Sin cerrar') {
        if (!c.vencida) return false;
      } else if (vista === 'Historial') {
        if (!['cumplida', 'ausente', 'cancelada', 'reprogramada'].includes(c.estado)) return false;
      }
      return !q || [c.paciente, c.codigo_anonimo].filter(Boolean).some((x) => x.toLowerCase().includes(q));
    });
  }, [citas, vista, busqueda, ahora]);

  const totalPages = Math.max(1, Math.ceil(lista.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = lista.slice(from, from + pageSize);

  const resetFiltros = () => {
    setBusqueda('');
    setVista('Próximas');
    setPage(1);
  };

  const accion = async (fn, mensaje) => {
    try {
      await fn();
      onShowNotification?.(mensaje);
      await onRecargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  const programar = (datos) =>
    accion(() => api.programarCita(datos), 'Cita agendada. El paciente ya recibió el aviso.');

  const reprogramar = (cita) => {
    const valor = window.prompt(
      'Nueva fecha y hora (formato AAAA-MM-DD HH:MM)',
      new Date(cita.fecha_hora).toISOString().slice(0, 16).replace('T', ' '),
    );
    if (!valor) return;
    const nueva = new Date(valor.replace(' ', 'T'));
    if (Number.isNaN(nueva.getTime())) {
      onShowNotification?.('Fecha no válida', 'error');
      return;
    }
    accion(
      () => api.reprogramarCita(cita.id_cita, nueva.toISOString()),
      'Cita reprogramada. El paciente fue notificado.',
    );
  };

  return (
    <div className="space-y-3 pb-4 animate-slide-in">
      <EncabezadoModulo
        icon={CalendarClock}
        title="Agenda de controles"
        subtitle="La próxima sesión de cada paciente. Al agendar, reprogramar o cancelar, el aviso sale solo."
        actionLabel="Programar control"
        actionIcon={Plus}
        onAction={() => setModal(true)}
      />

      <BarraFiltros
        searchValue={busqueda}
        onSearchChange={(v) => { setBusqueda(v); setPage(1); }}
        searchPlaceholder="Buscar por paciente o código..."
        onLimpiar={resetFiltros}
      >
        <FilterDropdown
          icon={CalendarDays}
          label="Vista"
          value={vista}
          options={VISTAS}
          onChange={(v) => { setVista(v); setPage(1); }}
        />
      </BarraFiltros>

      <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <div className="p-4">
          {lista.length === 0 ? (
            <EstadoVacio icon={CalendarClock} title="No hay citas en esta vista" hint="Ajusta los filtros o programa un nuevo control." />
          ) : (
            <div className="grid gap-3">
              {pageRows.map((c) => (
                <article key={c.id_cita} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{c.paciente}</h2>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{c.codigo_anonimo}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONO[c.estado] || TONO.programada}`}>
                          {ESTADO_CITA_LABEL[c.estado] || c.estado}
                        </span>
                        {c.vencida && (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                            Vencida
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtFechaHora(c.fecha_hora)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duracion_minutos} min</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.lugar}</span>
                      </p>
                      {c.motivo && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{c.motivo}</p>}
                      {c.indicaciones && (
                        <p className="mt-1 rounded-lg bg-slate-50 dark:bg-slate-900 p-2 text-xs text-slate-600 dark:text-slate-400">{c.indicaciones}</p>
                      )}
                    </div>

                    {!['cumplida', 'cancelada', 'reprogramada'].includes(c.estado) && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => accion(() => api.cerrarCita(c.id_cita, 'cumplida', 'Asistió al control'), 'Cita marcada como cumplida')}
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Asistió
                        </button>
                        <button
                          onClick={() => accion(() => api.cerrarCita(c.id_cita, 'ausente', 'No se presentó'), 'Marcada como inasistencia; el paciente fue avisado')}
                          className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"
                        >
                          <UserX className="h-3.5 w-3.5" /> No vino
                        </button>
                        <button
                          onClick={() => reprogramar(c)}
                          className="flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reprogramar
                        </button>
                        <button
                          onClick={() => accion(() => api.cerrarCita(c.id_cita, 'cancelada', 'Cancelada por la unidad'), 'Cita cancelada')}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <Paginacion
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          total={lista.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta="citas"
        />
      </div>

      {modal && (
        <ModalCita
          pacientes={pacientes}
          onGuardar={programar}
          onCerrar={() => setModal(false)}
        />
      )}
    </div>
  );
}
