import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { C, TONES } from '../../theme';

const TONOS = {
  amber: { bg: TONES.amber.bg, border: TONES.amber.border, icon: TONES.amber.icon, btn: TONES.amber.icon, btnHover: '#B07711' },
  danger: { bg: TONES.rose.bg, border: TONES.rose.border, icon: TONES.rose.icon, btn: C.dangerStr, btnHover: '#C22525' },
};

// Reemplazo del `window.confirm` nativo: mismo propósito (avisar antes de una
// acción y esperar sí/no), pero como ventana flotante con los colores del
// molde en vez del diálogo gris del navegador.
export default function ConfirmDialog({
  open,
  title = 'Confirmar acción',
  message,
  tone = 'amber',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  const t = TONOS[tone] || TONOS.amber;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  // Se monta directo en <body>: si quedara dentro de una pantalla con
  // `animate-slide-in` (que deja un `transform` puesto), el `fixed` se mide
  // contra esa pantalla y la ventana sale cortada y DETRÁS de otros modales.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="animate-slide-in w-full max-w-sm overflow-hidden rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_24px_60px_rgba(16,40,64,.28)]"
        style={{ borderColor: t.border }}
      >
        <div className="flex items-start gap-3 p-5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: t.bg, color: t.icon }}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="m-0 text-[14px] font-extrabold" style={{ color: C.navy }}>{title}</h3>
            <p className="mt-1 text-[12.5px] leading-snug" style={{ color: C.body }}>{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: C.border, backgroundColor: C.headBg }}>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[9px] border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: C.fieldBd, color: C.body }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-colors"
            style={{ backgroundColor: t.btn }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.btnHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.btn; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
