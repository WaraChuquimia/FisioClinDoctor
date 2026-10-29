import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Base común para las ventanas flotantes del login: fondo oscuro
// semitransparente, tarjeta centrada, cierra con Escape y con clic afuera.
// `dismissible={false}` quita esas dos salidas y el botón X — para las
// ventanas que la persona tiene que leer sí o sí (solicitud pendiente,
// cambio de contraseña obligatorio).
export default function ModalBase({
  isOpen, onClose, title, icon: Icon, children, footer,
  dismissible = true, maxWidth = 'max-w-md',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (dismissible && e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-slide-in w-full ${maxWidth} overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl`}
      >
        {title && (
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 py-4">
            <h2 className="m-0 flex items-center gap-2 text-base font-extrabold tracking-wide text-slate-800 dark:text-slate-200">
              {Icon && <Icon className="h-5 w-5 text-green-700" />}
              {title}
            </h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        <div className="p-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
