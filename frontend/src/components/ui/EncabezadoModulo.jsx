import React from 'react';
import { C } from '../../theme';

// Encabezado estándar de cada módulo: icono, título, subtítulo y (opcional)
// un botón de acción principal a la derecha. Siempre el primer bloque del
// molde, en el mismo orden en todas las pantallas. `children` es para algo
// distinto de un botón de acción (p. ej. el indicador "En vivo" de Evolución
// clínica) — va después del botón, a la derecha también.
export default function EncabezadoModulo({ icon: Icon, title, subtitle, actionLabel, actionIcon: ActionIcon, onAction, children }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={{ backgroundColor: C.mintTile }}>
          <Icon className="h-5 w-5" style={{ color: C.green }} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight tracking-[-.02em]" style={{ color: C.navy }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px]" style={{ color: C.body }}>{subtitle}</p>
          )}
        </div>
      </div>

      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] font-bold text-white shadow-[0_3px_10px_rgba(11,93,59,.22)] transition-colors hover:brightness-110"
          style={{ backgroundColor: C.greenDeep }}
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" strokeWidth={2.2} />}
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}
