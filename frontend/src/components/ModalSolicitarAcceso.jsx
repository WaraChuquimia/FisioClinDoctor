import React, { useEffect, useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import ModalBase from './ModalBase';
import { solicitarAcceso } from '../lib/auth';

// La usa gente que TODAVÍA NO entró al sistema: la base tiene una política
// que permite este insert sin sesión, y solo puede crear solicitudes en
// estado `pendiente` (fn_solicitar_acceso).
const ESTADO_INICIAL = { nombre: '', email: '', tipo: 'medico_fisiatra', cedula: '', telefono: '' };

export default function ModalSolicitarAcceso({ isOpen, onClose, prefill }) {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...ESTADO_INICIAL, nombre: prefill?.nombre || '', email: prefill?.email || '' });
      setError(null);
      setEnviado(false);
    }
  }, [isOpen, prefill]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await solicitarAcceso(form);
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Solicitar acceso" icon={UserPlus}>
      {enviado ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tu solicitud fue enviada. El administrador la revisará.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-lg bg-green-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-green-800"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Nombre completo *</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Ej. Dra. Ana Rojas"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Correo electrónico *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="nombre.apellido@cossmil.bo"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Tipo profesional *</label>
            <select
              value={form.tipo}
              onChange={set('tipo')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="medico_fisiatra">Médico fisiatra</option>
              <option value="fisioterapeuta">Fisioterapeuta</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Cédula profesional *</label>
              <input
                type="text"
                required
                value={form.cedula}
                onChange={set('cedula')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={set('telefono')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="cursor-pointer rounded-lg bg-green-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      )}
    </ModalBase>
  );
}
