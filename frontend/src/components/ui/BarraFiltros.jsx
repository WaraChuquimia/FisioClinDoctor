import React from 'react';
import { Search, ListFilter } from 'lucide-react';
import { C, CARD } from '../../theme';

// Barra de filtros del molde: buscador + los filtros propios de cada módulo
// (pasados como children, p. ej. <FilterDropdown .../>) + botón Limpiar.
export default function BarraFiltros({ searchValue, onSearchChange, searchPlaceholder = 'Buscar...', onLimpiar, children, endContent }) {
  return (
    <div className={`${CARD} flex flex-col gap-2.5 p-2.5 lg:flex-row lg:items-center`} style={{ borderColor: C.border }}>
      <label className="relative block min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-[10px] border pl-9 pr-3 text-[13.5px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]"
          style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.navy }}
        />
      </label>

      {children}

      <button
        type="button"
        onClick={onLimpiar}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.body }}
      >
        <ListFilter className="h-4 w-4" strokeWidth={2.1} />
        Limpiar
      </button>
      {endContent}
    </div>
  );
}
