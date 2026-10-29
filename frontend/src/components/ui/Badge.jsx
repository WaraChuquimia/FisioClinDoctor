import React from 'react';
import { BADGE } from '../../theme';

// Un estado, un color, en todo el sistema: una sola definición de etiqueta
// en vez de repetir el mismo <span> con colores a mano en cada pantalla.
// `tone` acepta una clave de BADGE ('green'|'amber'|'blue'|'red'|'slate') o
// un objeto propio { bg, color, dot? } — por ejemplo STATUS[patient.status].
export default function Badge({ tone = 'slate', dot, children }) {
  const t = typeof tone === 'string' ? (BADGE[tone] || BADGE.slate) : tone;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: t.bg, color: t.color }}
    >
      {dot && <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot || t.color }} />}
      {children}
    </span>
  );
}
