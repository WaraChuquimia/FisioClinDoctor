import React, { useEffect, useState } from 'react';
import { KeyRound, AlertCircle, MailCheck } from 'lucide-react';
import ModalBase from './ModalBase';
import { recuperarPassword } from '../lib/auth';

// El profesional lo resuelve SOLO, sin molestar al administrador.
// El mensaje de respuesta es SIEMPRE el mismo, exista o no la cuenta: si
// dijera "ese correo no existe" cualquiera podría ir probando correos hasta
// averiguar quién tiene cuenta en el sistema. No cambiar ese texto.
export default function ModalRecuperarPassword({ isOpen, onClose }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setTexto('');
      setError(null);
      setMensaje(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const respuesta = await recuperarPassword(texto);
      setMensaje(respuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="¿Olvidaste tu contraseña?" icon={KeyRound}>
      {mensaje ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-green-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{mensaje}</p>
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
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
            Escribe tu usuario o tu correo. Si la cuenta existe, te mandamos un enlace para elegir una contraseña nueva.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Tu usuario o tu correo</label>
            <input
              type="text"
              required
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="dr.martin o dr.martin@fisioclin.bo"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
            />
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
              {enviando ? 'Enviando...' : 'Enviarme el enlace'}
            </button>
          </div>
        </form>
      )}
    </ModalBase>
  );
}
