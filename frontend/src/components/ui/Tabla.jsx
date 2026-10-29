import React from 'react';
import { C, TH, TD } from '../../theme';

// Envoltorio de tabla del molde: cabecera fija, fila de "cargando", fila de
// "sin resultados" y filas fantasma para que la altura no salte al filtrar o
// al activar/desactivar algo. Las columnas cambian de un módulo a otro; la
// cabecera y esos tres estados no — por eso viven acá y no se repiten.
//
//   columnas: [{ label }]                — una por cabecera
//   anchos:   ['w-[100px]', '', ...]     — opcional, incide en <col>
//   filas:    datos ya filtrados/paginados
//   renderFila: (fila, index) => <tr>...</tr>
//   pageSize: si se pasa, completa con filas fantasma hasta llenar la página
export default function Tabla({
  columnas, anchos, minWidth = '880px',
  filas, renderFila, cargando,
  mensajeVacio = 'No se encontraron resultados.',
  pageSize,
}) {
  const nCols = columnas.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left" style={{ minWidth }}>
        {anchos && (
          <colgroup>
            {anchos.map((w, i) => <col key={i} className={w} />)}
          </colgroup>
        )}
        <thead style={{ backgroundColor: C.headBg, color: C.muted }}>
          <tr className="border-b" style={{ borderColor: C.border }}>
            {columnas.map((col, i) => (
              <th key={i} className={`${TH} truncate ${col.className || ''}`} title={col.title}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan={nCols} className="px-4 py-12 text-center text-[14px]" style={{ color: C.muted }}>
                Cargando...
              </td>
            </tr>
          ) : filas.length === 0 ? (
            <tr>
              <td colSpan={nCols} className="px-4 py-12 text-center text-[14px]" style={{ color: C.muted }}>
                {mensajeVacio}
              </td>
            </tr>
          ) : (
            filas.map(renderFila)
          )}

          {pageSize && filas.length > 0 && filas.length < pageSize &&
            Array.from({ length: pageSize - filas.length }).map((_, i) => (
              <tr key={`ghost-${i}`} className="border-b last:border-b-0" style={{ borderColor: C.border }} aria-hidden="true">
                {columnas.map((_, j) => (
                  <td key={j} className={TD}>
                    {j === 1 ? <span className="block h-8" /> : (j === 0 ? ' ' : null)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
