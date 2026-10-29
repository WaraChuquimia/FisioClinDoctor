import React from 'react';
import { C } from '../../theme';

// Ninguna pantalla vacía se queda en blanco: dice qué pasó y qué hacer
// ("Todavía no hay ejercicios. Crea el primero con el botón de arriba").
export default function EstadoVacio({ icon: Icon, title, hint }) {
  return (
    <div
      className="rounded-[14px] border border-dashed py-10 text-center"
      style={{ borderColor: C.fieldBd, backgroundColor: C.fieldBg }}
    >
      <Icon className="mx-auto mb-2 h-8 w-8" style={{ color: C.faded }} />
      <p className="text-[13.5px] font-bold" style={{ color: C.muted }}>{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[12.5px]" style={{ color: C.faded }}>{hint}</p>}
    </div>
  );
}
