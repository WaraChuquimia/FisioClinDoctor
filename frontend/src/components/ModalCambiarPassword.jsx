import React, { useMemo, useState } from 'react';
import { KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ModalBase from './ModalBase';
import { cambiarPasswordDesdePerfil } from '../lib/auth';

const MIN_LARGO = 8;

// Misma heurística de ModalNuevaPassword.jsx — no hace falta una librería.
function calcularFuerza(pw) {
  let score = 0;
  if (pw.length >= MIN_LARGO) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

const NIVELES = [
  { label: 'Muy débil', color: '#DC2626' },
  { label: 'Débil', color: '#EA580C' },
  { label: 'Regular', color: '#CA8A04' },
  { label: 'Fuerte', color: '#65A30D' },
  { label: 'Muy fuerte', color: '#15803D' },
];

// A diferencia de ModalNuevaPassword (cambio obligatorio, sin salida), esta
// se abre por decisión propia desde Mi Perfil: se puede cerrar, y pide la
// contraseña ACTUAL antes de aceptar la nueva.
export default function ModalCambiarPassword({ email, onClose, onSaved }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const fuerza = useMemo(() => calcularFuerza(nueva), [nueva]);
  const nivel = NIVELES[fuerza];

  const noCoinciden = repetir.length > 0 && nueva !== repetir;
  const muyCorta = nueva.length > 0 && nueva.length < MIN_LARGO;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (nueva.length < MIN_LARGO) {
      setError(`La contraseña nueva debe tener al menos ${MIN_LARGO} caracteres.`);
      return;
    }
    if (nueva !== repetir) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await cambiarPasswordDesdePerfil(email, actual, nueva);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase isOpen title="Cambiar contraseña" icon={KeyRound} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Contraseña actual</label>
          <input
            type={verPassword ? 'text' : 'password'}
            required
            autoFocus
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Nueva contraseña</label>
          <div className="relative">
            <input
              type={verPassword ? 'text' : 'password'}
              required
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="••••••••"
              className={`w-full rounded-lg border px-3 py-2 pr-10 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 ${
                muyCorta ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-green-700"
              aria-label={verPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
            >
              {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {nueva.length > 0 && (
            <div className="pt-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-colors"
                    style={{ backgroundColor: i <= fuerza - 1 ? nivel.color : '#E2E8F0' }}
                  />
                ))}
              </div>
              <span className="mt-1 block text-[11px] font-bold" style={{ color: nivel.color }}>
                {nivel.label}
              </span>
            </div>
          )}
          {muyCorta && (
            <span className="block text-[11px] font-medium text-red-500">Mínimo {MIN_LARGO} caracteres.</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Repetir contraseña nueva</label>
          <input
            type={verPassword ? 'text' : 'password'}
            required
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            placeholder="••••••••"
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-600 ${
              noCoinciden ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'
            }`}
          />
          {noCoinciden && <span className="block text-[11px] font-medium text-red-500">Las contraseñas no coinciden.</span>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || !actual || !nueva || !repetir}
            className="flex-1 cursor-pointer rounded-lg bg-green-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
