import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Search, Check, ChevronDown, X } from 'lucide-react';

// Tope de filas que se pintan a la vez: con miles de pacientes no tiene
// sentido montar un <button> por cada uno (lag de render y de scroll).
// El buscador sigue filtrando sobre la lista completa; solo se corta lo
// que se muestra.
const LIMITE_VISIBLE = 60;

export default function PacienteCombobox({
  pacientes = [],
  value = 'Todos',
  onChange,
}) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  // Foco al input al abrir
  useEffect(() => {
    if (abierto && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
    }
  }, [abierto]);

  // Lista formateada y filtrada (orden alfabético: con cientos de
  // pacientes, el orden de llegada de la API no ayuda a encontrar nada).
  const pacientesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? pacientes.filter((p) => p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q))
      : pacientes;
    return [...base].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [pacientes, query]);

  // Solo se pintan las primeras N filas; el resto aparece a medida que se
  // filtra con la búsqueda.
  const pacientesVisibles = useMemo(
    () => pacientesFiltrados.slice(0, LIMITE_VISIBLE),
    [pacientesFiltrados]
  );
  const ocultos = pacientesFiltrados.length - pacientesVisibles.length;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Botón activador */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className={`flex h-10 items-center justify-between gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
          value !== 'Todos'
            ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
            : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Users className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-400" />
          <span className="truncate max-w-[140px]">
            {value === 'Todos' ? 'Todos los pacientes' : value}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {value !== 'Todos' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('Todos');
              }}
              className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              title="Restablecer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Menú Flotante con Buscador y Altura Controlada */}
      {abierto && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Input de Búsqueda Integrado */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o PAC-..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Lista de Resultados, recortada a LIMITE_VISIBLE filas */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5 custom-scroll">
            <button
              type="button"
              onClick={() => {
                onChange('Todos');
                setAbierto(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                value === 'Todos'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Todos los pacientes</span>
              {value === 'Todos' && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            </button>

            {pacientesFiltrados.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
                No se encontraron pacientes
              </div>
            ) : (
              pacientesVisibles.map((p) => {
                const seleccionado = value === p.name;
                return (
                  <button
                    key={p.db_id || p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.name);
                      setAbierto(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      seleccionado
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col text-left truncate mr-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{p.id}</span>
                    </div>
                    {seleccionado && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                );
              })
            )}

            {ocultos > 0 && (
              <p className="px-2.5 py-1.5 text-center text-[10.5px] text-slate-400 dark:text-slate-500 italic">
                +{ocultos} más — seguí escribiendo para encontrarlos
              </p>
            )}
          </div>

          {/* Conteo total al pie del menú */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] text-slate-500 dark:text-slate-500 flex justify-between">
            <span>Coincidencias: {pacientesFiltrados.length}</span>
            <span>Total: {pacientes.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}