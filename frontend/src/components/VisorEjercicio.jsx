import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Pencil, Send, Clock, Activity, Gauge, Maximize, User, CalendarDays,
  Users, Dumbbell, Video, AlertTriangle,
} from 'lucide-react';
import * as api from '../lib/api';
import { fmtDate } from '../lib/mappers';
import { idDeYoutube, embedYoutube } from '../lib/youtube';

// =============================================================================
// Ventana grande para ver un ejercicio del catálogo con su video.
// -----------------------------------------------------------------------------
// Antes el video solo se veía chiquito, adentro del formulario de editar.
// Esta pantalla es de solo lectura (para eso ya está "Editar"): existe para
// MIRAR el video bien y leer las indicaciones al lado, sin taparlas.
//
// La velocidad 0.5x/1x/1.5x no es un adorno — es la función que más se va a
// usar acá: un fisiatra necesita ver el movimiento en cámara lenta para
// corregir la técnica del paciente.
// =============================================================================

const VELOCIDADES = [0.5, 1, 1.5];

export default function VisorEjercicio({ ejercicio, onClose, onEditar, onRecetar }) {
  const videoRef = useRef(null);
  const vivoRef = useRef(true);
  const [previewUrl, setPreviewUrl] = useState(ejercicio?.videoUrl || '');
  const [cargandoVideo, setCargandoVideo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  // Nunca dejar el reproductor en un recuadro negro sin explicación: si el
  // enlace venció o el navegador no puede con el formato, esto se ve.
  const [errorVideo, setErrorVideo] = useState('');

  const tieneVideo = ejercicio?.videoEstado === 'listo' || Boolean(ejercicio?.videoUrl);
  const idYoutube = idDeYoutube(ejercicio?.videoUrl);

  useEffect(() => () => { vivoRef.current = false; }, []);

  // El enlace firmado dura 1 hora: si el catálogo se cargó hace rato, el que
  // trae la lista puede haber vencido. Se pide uno fresco al abrir el visor,
  // igual que se hace justo antes de darle play en el formulario de editar.
  // También sirve de "Reintentar" cuando el video no se pudo reproducir.
  const pedirEnlaceFresco = () => {
    // Un enlace de YouTube no vence ni necesita firma: nada que refrescar.
    if (idDeYoutube(ejercicio?.videoUrl) || !ejercicio?.videoPath) {
      setPreviewUrl(ejercicio?.videoUrl || '');
      return;
    }
    setCargandoVideo(true);
    setErrorVideo('');
    api.urlVideoEjercicio(ejercicio)
      .then((fresca) => {
        if (!vivoRef.current) return;
        if (fresca) setPreviewUrl(fresca);
        else setErrorVideo('No se pudo generar el enlace del video. Probá de nuevo en un momento.');
      })
      .catch((err) => { if (vivoRef.current) setErrorVideo(err.message); })
      .finally(() => { if (vivoRef.current) setCargandoVideo(false); });
  };

  useEffect(() => {
    setVelocidad(1);
    setErrorVideo('');
    pedirEnlaceFresco();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio?.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!ejercicio) return null;

  const cambiarVelocidad = (v) => {
    setVelocidad(v);
    if (videoRef.current) videoRef.current.playbackRate = v;
  };

  const pantallaCompleta = () => {
    videoRef.current?.requestFullscreen?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-slide-in">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <Dumbbell className="h-4.5 w-4.5 text-green-700" /> {ejercicio.name}
          </h3>
          <button
            type="button" onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[1.5fr_1fr]">
          {/* --------------------------------------------------- VIDEO */}
          <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-950 p-4 lg:border-b-0 lg:border-r">
            {tieneVideo ? (
              <>
                <div className="overflow-hidden rounded-lg bg-black aspect-video">
                  {idYoutube ? (
                    <iframe
                      key={idYoutube}
                      src={embedYoutube(previewUrl)}
                      title={ejercicio.name}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : previewUrl && !errorVideo ? (
                    <video
                      key={previewUrl}
                      ref={videoRef}
                      controls
                      className="max-h-[50vh] w-full bg-black"
                      src={previewUrl}
                      onLoadedMetadata={() => { if (videoRef.current) videoRef.current.playbackRate = velocidad; }}
                      onError={() => setErrorVideo(
                        'No se pudo reproducir el video. El enlace pudo vencer, o el formato no es compatible con este navegador.',
                      )}
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-xs text-white">
                      {cargandoVideo ? 'Cargando video...' : (errorVideo ? '' : 'No se pudo cargar el video.')}
                    </div>
                  )}
                </div>

                {errorVideo && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errorVideo}
                    </span>
                    <button
                      type="button"
                      onClick={pedirEnlaceFresco}
                      className="shrink-0 cursor-pointer text-[11px] font-bold text-red-100 underline"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* YouTube ya trae su propio control de velocidad y pantalla
                    completa dentro del reproductor — no hace falta duplicarlo. */}
                {!idYoutube && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1">
                      <Gauge className="ml-1.5 h-3.5 w-3.5 text-white/60" />
                      {VELOCIDADES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => cambiarVelocidad(v)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                            velocidad === v ? 'bg-green-600 text-white' : 'text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {v}×
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={pantallaCompleta}
                      disabled={!previewUrl || Boolean(errorVideo)}
                      className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <Maximize className="h-3.5 w-3.5" /> Pantalla completa
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg bg-white/5 text-white/50">
                <Video className="h-8 w-8" />
                <p className="text-xs font-semibold">Este ejercicio todavía no tiene video.</p>
              </div>
            )}
          </div>

          {/* --------------------------------------------------- DATOS */}
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            <div>
              <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-200">{ejercicio.name}</h4>
              {ejercicio.codigo && (
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Código {ejercicio.codigo}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                  <Activity className="h-3.5 w-3.5" /> Articulación
                </p>
                <p className="mt-0.5 text-xs font-bold capitalize text-slate-700 dark:text-slate-300">{ejercicio.joint}</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Duración
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">{ejercicio.duration || 30}s</p>
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Ángulo esperado</p>
                <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {ejercicio.minAngle}° — {ejercicio.maxAngle}°
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Instrucciones clínicas</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {ejercicio.instructions || 'Sin instrucciones registradas.'}
              </p>
            </div>

            <div className="mt-auto space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                {ejercicio.creadoPor ? `Creado por ${ejercicio.creadoPor}` : 'Creador no registrado'}
              </p>
              {ejercicio.creadoEn && (
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> {fmtDate(ejercicio.creadoEn)}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                {ejercicio.pacientesRecetados === 1
                  ? '1 paciente lo tiene recetado'
                  : `${ejercicio.pacientesRecetados || 0} pacientes lo tienen recetado`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onRecetar}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-green-200 px-3.5 py-2 text-xs font-bold text-green-800 transition-colors hover:bg-green-50 dark:hover:bg-green-950/30"
          >
            <Send className="h-3.5 w-3.5" /> Recetar a un paciente
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-green-700/20 transition-all hover:bg-green-800 hover:shadow-lg"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
