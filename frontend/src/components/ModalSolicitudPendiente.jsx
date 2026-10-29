import React from 'react';
import { Hourglass, XCircle, AlertTriangle, LogOut, UserPlus } from 'lucide-react';
import ModalBase from './ModalBase';

const fechaLegible = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Aparece SOLA, encima del login, apenas restoreSession() devuelve
// `pendiente: true`. No se cierra con Escape ni con clic afuera: la única
// salida es "Cerrar sesión" — la persona tiene que leerla.
export default function ModalSolicitudPendiente({ solicitud, cuenta, onSignOut, onSolicitarAcceso }) {
  const estado = solicitud?.estado || 'sin_solicitud';
  const fecha = fechaLegible(solicitud?.fecha);

  const cerrarSesion = (
    <button
      type="button"
      onClick={onSignOut}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
    >
      <LogOut className="h-4 w-4" /> Cerrar sesión
    </button>
  );

  return (
    <ModalBase isOpen dismissible={false} title="Estado de tu acceso">
      <div className="space-y-4 text-center">
        {estado === 'pendiente' && (
          <>
            <Hourglass className="mx-auto h-10 w-10 text-amber-500" />
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">Tu solicitud está en revisión</h3>
            <div className="space-y-1 rounded-lg bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left text-[12.5px] text-slate-600 dark:text-slate-400">
              <p><span className="font-bold text-slate-700 dark:text-slate-300">Nombre:</span> {solicitud?.nombre || cuenta?.nombre || '—'}</p>
              <p><span className="font-bold text-slate-700 dark:text-slate-300">Correo:</span> {cuenta?.email || '—'}</p>
              {fecha && <p><span className="font-bold text-slate-700 dark:text-slate-300">Enviada el:</span> {fecha}</p>}
            </div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              El administrador la revisará y te avisaremos por correo.
            </p>
          </>
        )}

        {estado === 'rechazada' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">Tu solicitud no fue aprobada</h3>
            {solicitud?.observaciones && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-3 text-left text-[12.5px] text-red-700 dark:text-red-300">
                <span className="font-bold">Motivo:</span> {solicitud.observaciones}
              </div>
            )}
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              Si crees que es un error, contacta al administrador de tu unidad.
            </p>
          </>
        )}

        {estado === 'sin_solicitud' && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">Tu correo no está registrado en el sistema</h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              {cuenta?.email ? <>Entraste con <strong>{cuenta.email}</strong>, pero esa cuenta no tiene acceso todavía.</> : 'Esa cuenta no tiene acceso todavía.'}
            </p>
            <button
              type="button"
              onClick={onSolicitarAcceso}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-green-800"
            >
              <UserPlus className="h-4 w-4" /> Solicitar acceso
            </button>
          </>
        )}

        {cerrarSesion}
      </div>
    </ModalBase>
  );
}
