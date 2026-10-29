import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { C } from '../../theme';

function pageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (page >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', page - 1, page, page + 1, '…', total];
}

// Pie de tabla del molde: cuántos se muestran, los botones de página y el
// selector de "por página". Toda lista lleva esto, aunque hoy tenga 4 filas.
export default function Paginacion({
  page, totalPages, onPageChange,
  total, from, pageSize, onPageSizeChange,
  opcionesPageSize = [6, 10, 15, 25, 50],
  etiqueta = 'resultados',
}) {
  const arrow = 'grid h-7 w-7 place-items-center rounded-[7px] border transition-colors disabled:opacity-40';

  return (
    <div
      className="flex flex-col items-center justify-between gap-2 border-t px-3.5 py-2 lg:flex-row"
      style={{ borderColor: C.border }}
    >
      <span className="text-[12px]" style={{ color: C.muted }}>
        {total === 0
          ? `Sin ${etiqueta} que mostrar`
          : `Mostrando ${from + 1} - ${Math.min(from + pageSize, total)} de ${total} ${etiqueta}`}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          className={`${arrow} ${page === 1 ? '' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          style={{ borderColor: C.border, color: C.muted }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-[13px]" style={{ color: C.muted }}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-[7px] text-[12.5px] font-bold transition-colors"
              style={p === page ? { backgroundColor: C.greenDeep, color: '#FFFFFF' } : { color: C.navy }}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
          className={`${arrow} ${page === totalPages ? '' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          style={{ borderColor: C.border, color: C.muted }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: C.muted }}>
        Mostrar
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="cursor-pointer appearance-none rounded-[7px] border py-1 pl-2.5 pr-7 text-[12.5px] font-bold outline-none"
            style={{ backgroundColor: C.white, borderColor: C.fieldBd, color: C.navy }}
          >
            {opcionesPageSize.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.muted }} />
        </div>
        por página
      </div>
    </div>
  );
}
