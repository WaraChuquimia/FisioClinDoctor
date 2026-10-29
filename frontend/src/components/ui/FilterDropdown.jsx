import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { C } from '../../theme';

// El desplegable de filtro del molde: icono + etiqueta + valor actual, con
// una lista que se abre debajo. Se cierra con Escape o con clic afuera.
export default function FilterDropdown({ icon: Icon, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full shrink-0 lg:w-[152px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full cursor-pointer items-center gap-1.5 rounded-[10px] border px-2.5 transition-colors hover:bg-white dark:hover:bg-slate-800"
        style={{ backgroundColor: C.fieldBg, borderColor: open ? C.green : C.fieldBd }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: C.muted }} strokeWidth={2} />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[9.5px] font-medium leading-none" style={{ color: C.muted }}>{label}</span>
          <span className="mt-0.5 block truncate text-[12.5px] font-bold leading-none" style={{ color: C.navy }}>
            {value}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: C.muted }}
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-[10px] border bg-white dark:bg-slate-900 py-1 shadow-[0_8px_24px_rgba(16,40,64,.14)]"
          style={{ borderColor: C.border }}
        >
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => { onChange(o); setOpen(false); }}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-[12.5px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ color: o === value ? C.green : C.navy }}
              >
                {o}
                {o === value && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
