import React, { useEffect, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Download, Pencil, Check, Replace, Trash2,
  ZoomIn, ZoomOut, AlertCircle, FileText, Loader2,
} from 'lucide-react';
import * as api from '../lib/api';
import ConfirmDialog from './ui/ConfirmDialog';

// =============================================================================
// Visor de adjuntos clínicos (radiografías, estudios, informes...).
// -----------------------------------------------------------------------------
// Antes esto se abría en una pestaña nueva, que el navegador solía bloquear,
// y si el enlace fallaba no pasaba NADA — ni un error, ni un aviso. Este
// componente vive DENTRO del sistema (una ventana a pantalla completa) y
// nunca falla en silencio: si el enlace no se pudo generar, el motivo real
// de Supabase se ve en pantalla.
//
// Mantiene su propia copia de la lista (`lista`) en vez de depender del
// prop `adjuntos` en cada cambio: así renombrar/cambiar tipo/reemplazar se
// ve al instante, sin esperar a que el padre vuelva a leer todo el paciente.
// `onCambiado` avisa al padre para que, en segundo plano, esa lectura
// también ocurra y el resto de la pantalla (fuera del visor) quede al día.
// =============================================================================

const TIPOS_ESTUDIO = [
  ['radiografia', 'Radiografía'],
  ['resonancia', 'Resonancia'],
  ['tomografia', 'Tomografía'],
  ['ecografia', 'Ecografía'],
  ['laboratorio', 'Laboratorio'],
  ['informe', 'Informe'],
  ['foto', 'Foto'],
  ['otro', 'Otro'],
];

const pesoLegible = (b) => {
  if (!b) return '—';
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

const fechaLegible = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function VisorAdjunto({
  adjuntos, indiceInicial = 0, idPaciente, onClose, onCambiado, onShowNotification,
}) {
  const [lista, setLista] = useState(adjuntos);
  const [indice, setIndice] = useState(indiceInicial);
  const [url, setUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreBorrador, setNombreBorrador] = useState('');

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [intento, setIntento] = useState(0);
  const arrastreRef = useRef(null);
  const inputReemplazo = useRef(null);

  const actual = lista[indice] || null;
  const esImagen = (actual?.type || '').startsWith('image/');
  const esPdf = actual?.type === 'application/pdf';

  // Pedir el enlace firmado cada vez que cambia el adjunto (o su archivo,
  // tras un "Reemplazar"), o cuando se pide reintentar tras un error —
  // los enlaces firmados duran 1 hora y son por ruta.
  useEffect(() => {
    if (!actual) return undefined;
    let vivo = true;
    setUrl(null); setError(null); setCargando(true);
    setZoom(1); setPan({ x: 0, y: 0 });

    (async () => {
      try {
        const enlace = await api.urlAdjunto(actual);
        if (!vivo) return;
        if (!enlace) throw new Error('El archivo no tiene un enlace válido.');
        setUrl(enlace);
      } catch (err) {
        if (vivo) setError(err.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [actual?.id, actual?.path, intento]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndice((i) => Math.min(lista.length - 1, i + 1));
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lista.length, onClose]);

  if (!actual) return null;

  const actualizarLocal = (id, cambios) => {
    setLista((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  };

  const iniciarRenombrar = () => {
    setNombreBorrador(actual.nombreVisible || actual.nombreOriginal || actual.name || '');
    setEditandoNombre(true);
  };

  const guardarNombre = async () => {
    setGuardando(true);
    try {
      const fila = await api.renombrarAdjunto(actual.id, nombreBorrador);
      actualizarLocal(actual.id, {
        nombreVisible: fila.nombre_visible,
        name: fila.nombre_visible || fila.nombre_original,
      });
      setEditandoNombre(false);
      onShowNotification?.('Nombre actualizado');
      onCambiado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarTipo = async (tipoEstudio) => {
    setGuardando(true);
    try {
      const fila = await api.cambiarTipoAdjunto(actual.id, tipoEstudio);
      actualizarLocal(actual.id, { tipoEstudio: fila.tipo_estudio });
      onShowNotification?.('Tipo de estudio actualizado');
      onCambiado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const elegirReemplazo = () => inputReemplazo.current?.click();

  const onArchivoReemplazo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setGuardando(true);
    try {
      const fila = await api.reemplazarAdjunto(actual.id, idPaciente, actual.bucket, actual.path, archivo);
      actualizarLocal(actual.id, {
        path: fila.storage_path,
        bucket: fila.bucket,
        type: fila.mime_type,
        size: fila.tamano_bytes,
        nombreOriginal: fila.nombre_original,
        creadoEn: actual.creadoEn,
      });
      onShowNotification?.('Archivo reemplazado');
      onCambiado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setConfirmEliminar(false);
    setGuardando(true);
    try {
      await api.eliminarAdjunto(actual.id, actual.bucket, actual.path);
      onShowNotification?.('Adjunto eliminado');
      onCambiado?.();
      setLista((prev) => {
        const resto = prev.filter((a) => a.id !== actual.id);
        if (resto.length === 0) {
          onClose?.();
        } else {
          setIndice((i) => Math.min(i, resto.length - 1));
        }
        return resto;
      });
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const descargar = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = actual.nombreOriginal || actual.name || 'archivo';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const acercar = () => setZoom((z) => Math.min(4, z + 0.5));
  const alejar = () => setZoom((z) => {
    const nuevo = Math.max(1, z - 0.5);
    if (nuevo === 1) setPan({ x: 0, y: 0 });
    return nuevo;
  });

  const onMouseDownImg = (e) => {
    if (zoom <= 1) return;
    arrastreRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMoveImg = (e) => {
    if (!arrastreRef.current) return;
    const { x, y, panX, panY } = arrastreRef.current;
    setPan({ x: panX + (e.clientX - x), y: panY + (e.clientY - y) });
  };
  const onMouseUpImg = () => { arrastreRef.current = null; };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95">
      {/* --------------------------------------------------- BARRA SUPERIOR */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          {editandoNombre ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nombreBorrador}
                onChange={(e) => setNombreBorrador(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(); if (e.key === 'Escape') setEditandoNombre(false); }}
                className="w-full max-w-sm rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm text-white outline-none focus:border-white/40"
                placeholder="Nombre para este adjunto"
              />
              <button
                type="button" onClick={guardarNombre} disabled={guardando}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                title="Guardar nombre"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button" onClick={() => setEditandoNombre(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white"
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={iniciarRenombrar}
              className="group flex max-w-full items-center gap-2 text-left"
              title="Renombrar"
            >
              <span className="truncate text-sm font-bold text-white">
                {actual.nombreVisible || actual.nombreOriginal || actual.name}
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/80" />
            </button>
          )}
          <p className="mt-0.5 text-[11px] text-white/50">
            {pesoLegible(actual.size)} · {fechaLegible(actual.creadoEn)}
            {actual.subidoPor ? ` · Subido por ${actual.subidoPor}` : ''}
            {lista.length > 1 ? ` · ${indice + 1} de ${lista.length}` : ''}
          </p>
        </div>

        <button
          type="button" onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* --------------------------------------------------- CONTENIDO */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {lista.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
              className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Adjunto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setIndice((i) => Math.min(lista.length - 1, i + 1))}
              disabled={indice === lista.length - 1}
              className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Siguiente adjunto"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {cargando && (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-xs font-semibold">Cargando archivo…</span>
          </div>
        )}

        {!cargando && error && (
          <div className="mx-6 flex max-w-md flex-col items-center gap-2 rounded-xl border border-red-400/30 bg-red-950/40 px-5 py-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-300" />
            <p className="text-sm font-bold text-red-200">No se pudo mostrar el archivo</p>
            <p className="text-xs text-red-300/90">{error}</p>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              className="mt-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-500/30"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && esImagen && (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
            onMouseDown={onMouseDownImg}
            onMouseMove={onMouseMoveImg}
            onMouseUp={onMouseUpImg}
            onMouseLeave={onMouseUpImg}
            onDoubleClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          >
            <img
              src={url}
              alt={actual.nombreVisible || actual.nombreOriginal || actual.name}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain transition-transform"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />
          </div>
        )}

        {!cargando && !error && esPdf && (
          <iframe
            src={url}
            title={actual.nombreVisible || actual.nombreOriginal || actual.name}
            className="h-full w-full border-0 bg-white dark:bg-slate-900"
          />
        )}

        {!cargando && !error && !esImagen && !esPdf && (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <FileText className="h-10 w-10" />
            <p className="text-sm font-semibold">Este tipo de archivo no se puede previsualizar.</p>
            <button
              type="button" onClick={descargar}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"
            >
              <Download className="h-3.5 w-3.5" /> Descargar para verlo
            </button>
          </div>
        )}

        {esImagen && !cargando && !error && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 px-2 py-1.5 backdrop-blur">
            <button type="button" onClick={alejar} disabled={zoom <= 1} className="grid h-8 w-8 place-items-center rounded-full text-white disabled:opacity-30" aria-label="Alejar">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-[11px] font-bold text-white/80">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={acercar} disabled={zoom >= 4} className="grid h-8 w-8 place-items-center rounded-full text-white disabled:opacity-30" aria-label="Acercar">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------- BARRA INFERIOR */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">
          Tipo
          <select
            value={actual.tipoEstudio || 'otro'}
            disabled={guardando}
            onChange={(e) => cambiarTipo(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-bold text-white outline-none disabled:opacity-50"
          >
            {TIPOS_ESTUDIO.map(([valor, etiqueta]) => (
              <option key={valor} value={valor} className="text-slate-900 dark:text-slate-100">{etiqueta}</option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button" onClick={descargar} disabled={!url}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Descargar
          </button>
          <button
            type="button" onClick={elegirReemplazo} disabled={guardando}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <Replace className="h-3.5 w-3.5" /> Reemplazar
          </button>
          <input ref={inputReemplazo} type="file" accept="image/*,application/pdf" className="hidden" onChange={onArchivoReemplazo} />
          <button
            type="button" onClick={() => setConfirmEliminar(true)} disabled={guardando}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Borrar
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmEliminar}
        title="Borrar adjunto"
        message={`¿Borrar "${actual.nombreVisible || actual.nombreOriginal || actual.name}"? Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Borrar"
        onConfirm={eliminar}
        onCancel={() => setConfirmEliminar(false)}
      />
    </div>
  );
}
