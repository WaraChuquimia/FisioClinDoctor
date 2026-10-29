import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Dumbbell, Clock, Activity, Pencil, X, Check, Video,
  Upload, Trash2, Loader2, AlertTriangle, Play,
} from 'lucide-react';
import * as api from '../lib/api';
import VisorEjercicio from './VisorEjercicio';
import ConfirmDialog from './ui/ConfirmDialog';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import FilterDropdown from './ui/FilterDropdown';
import Paginacion from './ui/Paginacion';
import EstadoVacio from './ui/EstadoVacio';
import { C, CARD } from '../theme';
import { MAX_VIDEO_MB, AVISO_VIDEO_GRANDE_MB } from '../lib/limites';
import { idDeYoutube, embedYoutube, miniaturaYoutube } from '../lib/youtube';
import { MOVIMIENTOS_CAMARA, nombreMovimiento } from '../lib/camaraCv';

const emptyForm = {
  name: '',
  joint: 'rodilla',
  camara: '',
  instructions: '',
  duration: 30,
  minAngle: 0,
  maxAngle: 120,
  videoUrl: ''
};

const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
const pesoLegible = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Los .MOV de iPhone suelen venir en HEVC, que Chrome no reproduce — y
// `canPlayType` es la única forma de saberlo ANTES de subir 40 MB para
// enterarse recién al final. Ojo: para `video/quicktime` casi todos los
// navegadores devuelven "" sin mirar el códec real del archivo, así que esto
// bloquea TODOS los .MOV, no solo los HEVC — es la contracara aceptada de
// poder avisar antes de subir en vez de después.
const puedeReproducirNavegador = (tipo) => {
  const soporte = document.createElement('video').canPlayType(tipo);
  return soporte === 'probably' || soporte === 'maybe';
};

const formatoEta = (segundos) => {
  if (segundos == null || !Number.isFinite(segundos) || segundos <= 0) return 'calculando tiempo restante...';
  if (segundos < 60) return `~${Math.ceil(segundos)} s restantes`;
  return `~${Math.ceil(segundos / 60)} min restantes`;
};

export default function CatalogoEjercicios({
  exercises, onUpdateExercise, onCreateExercise,
  onUploadVideo, onRemoveVideo, onDeleteExercise, onShowNotification,
  onNavigateToPrescription,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [jointFilter, setJointFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [etapaCreacion, setEtapaCreacion] = useState(null); // null | 'creando' | 'subiendo-video'
  const [videoBusy, setVideoBusy] = useState(null); // null | 'subiendo' | 'quitando'
  const [deleting, setDeleting] = useState(false);
  const [confirmQuitarVideo, setConfirmQuitarVideo] = useState(false);
  const [confirmBorrarEjercicio, setConfirmBorrarEjercicio] = useState(false);
  // Avance real de la subida en curso ({ loaded, total, startedAt }) — solo
  // puede haber una subida a la vez desde este formulario, así que un solo
  // estado alcanza tanto para editar como para crear-y-subir de una vez.
  const [progreso, setProgreso] = useState(null);
  const subidaEnCursoRef = useRef(null);
  // El video elegido ANTES de que el ejercicio exista: no se sube todavía
  // (la ruta del archivo necesita el id_ejercicio), se guarda en memoria y se
  // sube recién cuando se aprieta "Crear Ejercicio".
  const [videoPendiente, setVideoPendiente] = useState(null);

  // El ejercicio que se está editando de verdad (con su video), sacado de la
  // lista que vive en App.jsx. Mientras se está creando uno nuevo, es null:
  // todavía no tiene id_ejercicio, así que el video elegido se guarda en
  // `videoPendiente` en vez de subirse directo.
  const activeExercise = editingId ? exercises.find((ex) => ex.id === editingId) || null : null;
  const viewingExercise = viewingId ? exercises.find((ex) => ex.id === viewingId) || null : null;

  const joints = ['Todos', ...new Set(exercises.map((ex) => ex.joint).filter(Boolean))];

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJoint = jointFilter === 'Todos' || ex.joint === jointFilter;
    return matchesSearch && matchesJoint;
  });

  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageExercises = filteredExercises.slice(from, from + pageSize);

  const resetFiltros = () => {
    setSearchQuery('');
    setJointFilter('Todos');
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setVideoPendiente(null);
    setModalOpen(true);
  };

  const openEditModal = (ex) => {
    setEditingId(ex.id);
    setFormData({
      name: ex.name || '',
      joint: ex.joint || 'rodilla',
      camara: ex.camara || '',
      instructions: ex.instructions || '',
      duration: ex.duration || 30,
      minAngle: ex.minAngle ?? 0,
      maxAngle: ex.maxAngle ?? 120,
      // Solo se prellena si el video es un enlace (no un archivo subido):
      // `videoPath` viene vacío cuando es un enlace de YouTube.
      videoUrl: !ex.videoPath ? (ex.videoUrl || '') : ''
    });
    setVideoPendiente(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || videoBusy || deleting) return;
    setModalOpen(false);
    setEditingId(null);
    setVideoPendiente(null);
  };

  // Se abre al hacer clic en la tarjeta: ventana de solo lectura para ver el
  // video en grande. Desde ahí se puede pasar a "Editar" o a "Recetar".
  const abrirVisor = (ex) => setViewingId(ex.id);
  const cerrarVisor = () => setViewingId(null);

  const editarDesdeVisor = () => {
    if (!viewingExercise) return;
    setViewingId(null);
    openEditModal(viewingExercise);
  };

  const recetarDesdeVisor = () => {
    setViewingId(null);
    onNavigateToPrescription?.(null);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onShowNotification?.('El nombre del ejercicio es requerido', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await onUpdateExercise({ id: editingId, ...formData });
        setModalOpen(false);
        setEditingId(null);
      } else {
        // Dos pasos que antes eran del usuario (crear, guardar, RECIÉN subir
        // el video) y ahora son uno solo: se crea el ejercicio y, si había un
        // video elegido, se sube enseguida con el id que se acaba de crear.
        setEtapaCreacion('creando');
        const creado = await onCreateExercise(formData);

        if (videoPendiente) {
          setEtapaCreacion('subiendo-video');
          try {
            await subirConSeguimiento(creado.id, videoPendiente);
          } catch (err) {
            // El ejercicio YA quedó creado — perder esos datos por un video
            // que falló (o que se canceló) sería lo peor que podría pasar
            // acá. Se avisa y se deja que lo reintente editándolo.
            onShowNotification?.(
              err?.cancelado
                ? 'El ejercicio se creó, pero se canceló la subida del video. Puedes agregarlo después editándolo.'
                : 'El ejercicio se creó, pero el video no se pudo subir. Puedes intentarlo de nuevo editándolo.',
              'error',
            );
          }
        }

        setModalOpen(false);
        setEditingId(null);
        setVideoPendiente(null);
      }
    } catch {
      // el error de crear/actualizar ya se mostró con el toast
    } finally {
      setSaving(false);
      setEtapaCreacion(null);
    }
  };

  const validarVideo = (file) => {
    if (!TIPOS_VIDEO.includes(file.type)) {
      return `Formato no admitido (${file.type || 'desconocido'}). Sube un video MP4, MOV o WEBM.`;
    }
    if (file.size > MAX_VIDEO_MB * 1048576) {
      return `El video pesa ${pesoLegible(file.size)}. El máximo permitido es ${MAX_VIDEO_MB} MB. Comprímelo a 720p antes de subirlo.`;
    }
    if (!puedeReproducirNavegador(file.type)) {
      return 'Este video está en un formato que el navegador no reproduce. Conviértelo a MP4 (H.264).';
    }
    return null;
  };

  // Punto único de subida: arma el AbortController, reporta el avance real
  // (para la barra) y deja todo listo para poder cancelar a mitad de camino.
  // Lo usan tanto "editar" (sube al toque) como "crear" (sube después de
  // crear el ejercicio, desde `handleSubmit`).
  const subirConSeguimiento = (idEjercicio, file) => {
    const controller = new AbortController();
    subidaEnCursoRef.current = controller;
    setProgreso({ loaded: 0, total: file.size, startedAt: Date.now(), lastUpdate: Date.now() });
    return onUploadVideo(idEjercicio, file, {
      // `lastUpdate` se guarda acá (fuera del render) para poder calcular
      // cuánto lleva sin llamar a `Date.now()` durante el render.
      onProgress: (loaded, total) => setProgreso((p) => ({
        ...(p || { startedAt: Date.now() }), loaded, total, lastUpdate: Date.now(),
      })),
      signal: controller.signal,
    }).finally(() => {
      subidaEnCursoRef.current = null;
      setProgreso(null);
    });
  };

  const cancelarSubida = () => subidaEnCursoRef.current?.abort();

  // Si el ejercicio YA existe (se está editando) el video se sube al toque,
  // como siempre. Si TODAVÍA no existe (se está creando) se guarda en
  // memoria nomás: lo sube `handleSubmit` en cuanto tenga el id nuevo.
  const handlePickVideo = (file) => {
    const problema = validarVideo(file);
    if (problema) {
      onShowNotification?.(problema, 'error');
      return;
    }
    if (file.size > AVISO_VIDEO_GRANDE_MB * 1048576) {
      onShowNotification?.(`Este video pesa ${pesoLegible(file.size)}: va a tardar en subir y en abrirse; conviene comprimirlo.`);
    }
    if (activeExercise) {
      subirVideoInmediato(file);
    } else {
      setVideoPendiente(file);
    }
  };

  const subirVideoInmediato = async (file) => {
    setVideoBusy('subiendo');
    try {
      await subirConSeguimiento(activeExercise.id, file);
    } catch (err) {
      if (err?.cancelado) onShowNotification?.('Subida de video cancelada.');
      // si no fue cancelado, el error ya se mostró con el toast
    } finally {
      setVideoBusy(null);
    }
  };

  const handleRemoveVideoClick = () => {
    if (!activeExercise) return;
    setConfirmQuitarVideo(true);
  };

  const confirmarQuitarVideo = async () => {
    setConfirmQuitarVideo(false);
    setVideoBusy('quitando');
    try {
      await onRemoveVideo(activeExercise.id, activeExercise.videoPath);
    } catch {
      // el error ya se mostró con el toast
    } finally {
      setVideoBusy(null);
    }
  };

  const handleDeleteClick = () => {
    if (!activeExercise) return;
    setConfirmBorrarEjercicio(true);
  };

  const confirmarBorrarEjercicio = async () => {
    setConfirmBorrarEjercicio(false);
    setDeleting(true);
    try {
      await onDeleteExercise(activeExercise.id, activeExercise.videoPath);
      setModalOpen(false);
      setEditingId(null);
    } catch {
      // el error ya se mostró con el toast
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3 pb-4 animate-slide-in">
      <EncabezadoModulo
        icon={Dumbbell}
        title="Catálogo de ejercicios"
        subtitle="Biblioteca clínica de ejercicios terapéuticos disponibles para prescripción."
        actionLabel="Nuevo ejercicio"
        actionIcon={Plus}
        onAction={openCreateModal}
      />

      <BarraFiltros
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        searchPlaceholder="Buscar ejercicio por nombre o categoría..."
        onLimpiar={resetFiltros}
      >
        <FilterDropdown
          icon={Dumbbell}
          label="Articulación"
          value={jointFilter}
          options={joints}
          onChange={(v) => { setJointFilter(v); setPage(1); }}
        />
      </BarraFiltros>

      <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <div className="p-4">
          {filteredExercises.length === 0 ? (
            <EstadoVacio
              icon={Dumbbell}
              title="No se encontraron ejercicios"
              hint="Ajusta los filtros o registra un nuevo ejercicio en el catálogo."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {pageExercises.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => abrirVisor(ex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') abrirVisor(ex); }}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
                >
                  <div className="h-32 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    {ex.image ? (
                      <img src={ex.image} alt={ex.name} className="w-full h-full object-cover" />
                    ) : miniaturaYoutube(ex.videoUrl) ? (
                      <MiniaturaConPlay>
                        <img src={miniaturaYoutube(ex.videoUrl)} alt={ex.name} className="w-full h-full object-cover" />
                      </MiniaturaConPlay>
                    ) : ex.videoPath && ex.videoUrl ? (
                      <MiniaturaConPlay>
                        {/* Sin foto propia: el primer cuadro del video hace de
                            miniatura. `#t=0.5` evita el cuadro negro del inicio y
                            `preload="metadata"` baja solo lo necesario para dibujarlo. */}
                        <video
                          src={`${ex.videoUrl}#t=0.5`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </MiniaturaConPlay>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-green-900 shadow-sm">
                      {ex.joint}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col flex-grow space-y-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-snug">{ex.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{ex.category || 'Movilidad'}</p>
                      {ex.camara ? (
                        <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 mt-1">
                          Cámara: {nombreMovimiento(ex.camara) || ex.camara}
                        </p>
                      ) : (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-1">
                          Sin cámara · edítalo para activarla
                        </p>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-grow">
                      {ex.instructions || 'Sin instrucciones registradas.'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {ex.duration || 30}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> {ex.minAngle}°-{ex.maxAngle}°
                      </span>
                      {ex.videoEstado === 'listo' && (
                        <span className="flex items-center gap-1 text-green-700">
                          <Video className="w-3.5 h-3.5" /> Video
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(ex); }}
                      className="mt-1 w-full py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-bold text-green-900 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar Ejercicio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Paginacion
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          total={filteredExercises.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta="ejercicios"
        />
      </div>

      {/* Create / Edit Modal */}
      {/* Se dibuja con un portal directo sobre <body>: si quedara anidado en
          la página, la animación de entrada de esta (animate-slide-in) deja
          un `transform` activo en el contenedor, y eso rompe `fixed` — el
          modal se ancla al tamaño de esa caja en vez de a toda la pantalla. */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-in overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-green-700" />
                {editingId ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nombre del Ejercicio *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ej. Flexión de Rodilla Asistida"
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Articulación</label>
                  <select
                    value={formData.joint}
                    onChange={(e) => handleChange('joint', e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-white dark:bg-slate-900"
                  >
                    <option value="rodilla">Rodilla</option>
                    <option value="hombro">Hombro</option>
                    <option value="cadera">Cadera</option>
                    <option value="codo">Codo</option>
                    <option value="columna">Columna</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Duración (seg)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleChange('duration', e.target.value)}
                    min="1"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Seguimiento con cámara (app del paciente)
                </label>
                <select
                  value={formData.camara}
                  onChange={(e) => handleChange('camara', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-white dark:bg-slate-900"
                >
                  <option value="">Sin cámara: el paciente solo lo marca como hecho</option>
                  <optgroup label="Cadera">
                    {MOVIMIENTOS_CAMARA.filter((m) => m.zona === 'cadera').map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Rodilla">
                    {MOVIMIENTOS_CAMARA.filter((m) => m.zona === 'rodilla').map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>
                    ))}
                  </optgroup>
                </select>
                <p className={`text-[11px] ${formData.camara ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {formData.camara
                    ? 'La app contará series y repeticiones con este movimiento.'
                    : 'Elige el movimiento que más se parece para que el paciente pueda usar la cámara.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Ángulo Mínimo Esperado</label>
                  <input
                    type="number"
                    value={formData.minAngle}
                    onChange={(e) => handleChange('minAngle', e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Ángulo Máximo Esperado</label>
                  <input
                    type="number"
                    value={formData.maxAngle}
                    onChange={(e) => handleChange('maxAngle', e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <VideoZone
                exercise={activeExercise}
                busy={videoBusy || (etapaCreacion === 'subiendo-video' ? 'subiendo' : null)}
                progreso={progreso}
                onCancelar={cancelarSubida}
                onPickVideo={handlePickVideo}
                onRemoveVideo={handleRemoveVideoClick}
                pendingFile={activeExercise ? null : videoPendiente}
                onClearPendingFile={() => setVideoPendiente(null)}
                videoUrlEnlace={formData.videoUrl}
                onChangeVideoUrlEnlace={(v) => handleChange('videoUrl', v)}
              />

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Instrucciones Clínicas</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  rows="3"
                  placeholder="Descripción técnica del ejercicio y su ejecución correcta..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                ></textarea>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  {activeExercise && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={saving || Boolean(videoBusy) || deleting}
                      className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Borrando...' : 'Borrar ejercicio'}
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving || Boolean(videoBusy) || deleting}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {editingId ? 'Cerrar' : 'Cancelar'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || Boolean(videoBusy) || deleting}
                    className="px-5 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-green-700/20 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> {saving
                      ? (editingId
                        ? 'Guardando...'
                        : (etapaCreacion === 'subiendo-video' ? 'Subiendo video...' : 'Creando ejercicio...'))
                      : (editingId ? 'Guardar Cambios' : 'Crear Ejercicio')}
                  </button>
                </div>
              </div>
            </form>
          </div>
          </div>
        </div>,
        document.body
      )}

      {viewingExercise && (
        <VisorEjercicio
          ejercicio={viewingExercise}
          onClose={cerrarVisor}
          onEditar={editarDesdeVisor}
          onRecetar={recetarDesdeVisor}
        />
      )}

      <ConfirmDialog
        open={confirmQuitarVideo}
        title="Quitar video"
        message="¿Quitar el video de este ejercicio? Vas a poder subir otro después."
        tone="amber"
        confirmLabel="Quitar video"
        onConfirm={confirmarQuitarVideo}
        onCancel={() => setConfirmQuitarVideo(false)}
      />

      <ConfirmDialog
        open={confirmBorrarEjercicio}
        title="Borrar ejercicio"
        message={`¿Borrar "${activeExercise?.name}" del catálogo? Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Borrar"
        onConfirm={confirmarBorrarEjercicio}
        onCancel={() => setConfirmBorrarEjercicio(false)}
      />
    </div>
  );
}

/* -------- Miniatura de la tarjeta con el botón de play encima -------- */
function MiniaturaConPlay({ children }) {
  return (
    <div className="relative w-full h-full">
      {children}
      <span className="absolute inset-0 flex items-center justify-center bg-black/15">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md">
          <Play className="h-4 w-4 translate-x-[1px] fill-green-800 text-green-800" />
        </span>
      </span>
    </div>
  );
}

/* -------- Zona de subida / reemplazo del video del ejercicio -------- */
// Funciona en dos modos:
//   - Editando un ejercicio que YA existe: elegir un archivo lo sube al toque.
//   - Creando uno nuevo (`exercise` es null): elegir un archivo NO lo sube —
//     lo deja en `pendingFile` con una vista previa local (el propio navegador
//     puede reproducir el archivo antes de subirlo), y el botón "Crear
//     Ejercicio" del formulario es quien lo sube después.
function VideoZone({
  exercise, busy, progreso, onCancelar, onPickVideo, onRemoveVideo, pendingFile, onClearPendingFile,
  videoUrlEnlace, onChangeVideoUrlEnlace,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  // Nunca dejar un recuadro negro sin explicación: si el <video> no puede
  // reproducir lo que se le dio (enlace vencido, formato no soportado), esto
  // lo muestra encima del reproductor en vez de quedarse callado.
  const [errorReproduccion, setErrorReproduccion] = useState('');
  // 'archivo' (subir el video) o 'enlace' (pegar un link de YouTube, como
  // hace Google Drive). Si el ejercicio ya trae un enlace guardado (y no un
  // archivo), arranca ahí directo.
  const [modo, setModo] = useState(() => (videoUrlEnlace ? 'enlace' : 'archivo'));

  const estado = exercise?.videoEstado || 'sin_video';

  useEffect(() => {
    setPreviewUrl(estado === 'listo' ? (exercise?.videoUrl || '') : '');
    setErrorReproduccion('');
    reintentoHecho.current = false;
  }, [exercise?.id, estado, exercise?.videoUrl]);

  // Vista previa del video TODAVÍA no subido: es un enlace local al mismo
  // archivo elegido, así que se ve sin tocar la red — sirve para notar de
  // una vez si se adjuntó el video equivocado.
  useEffect(() => {
    if (!pendingFile) { setPendingUrl(''); return undefined; }
    const url = URL.createObjectURL(pendingFile);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  // El enlace firmado dura 1 hora. Si venció (la lista quedó abierta mucho
  // tiempo), el <video> falla y ahí se pide uno fresco — una sola vez, para
  // no entrar en un bucle si el problema es otro. OJO: no hacerlo en `onPlay`:
  // el enlace nuevo cambia el `src` (y el `key`), el reproductor se vuelve a
  // montar y el video se detiene apenas se le da play.
  const reintentoHecho = useRef(false);
  const alFallarVideo = () => {
    if (!reintentoHecho.current && exercise?.videoPath) {
      reintentoHecho.current = true;
      refrescarEnlace();
      return;
    }
    setErrorReproduccion(
      'No se pudo reproducir el video. El enlace pudo vencer, o el formato no es compatible con este navegador.',
    );
  };

  const refrescarEnlace = async () => {
    if (!exercise?.videoPath) return;
    setLoadingPreview(true);
    setErrorReproduccion('');
    try {
      const fresca = await api.urlVideoEjercicio(exercise);
      if (fresca) setPreviewUrl(fresca);
      else setErrorReproduccion('No se pudo generar el enlace del video. Probá de nuevo en un momento.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const abrirSelector = () => inputRef.current?.click();

  const handleFiles = (lista) => {
    const file = lista?.[0];
    if (file) onPickVideo(file);
  };

  const tieneVideoListo = Boolean(exercise) && estado === 'listo' && exercise.videoPath;

  const cargado = progreso?.loaded || 0;
  const total = progreso?.total || 0;
  const pctSubida = total ? Math.min(100, Math.round((cargado / total) * 100)) : 0;
  const segundosTranscurridos = progreso ? (progreso.lastUpdate - progreso.startedAt) / 1000 : 0;
  const bytesPorSegundo = segundosTranscurridos > 0.5 ? cargado / segundosTranscurridos : 0;
  const etaSegundos = bytesPorSegundo > 0 ? (total - cargado) / bytesPorSegundo : null;

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Video de referencia</label>

      {busy === 'subiendo' ? (
        <div className="rounded-lg border border-dashed border-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-4">
          <div className="flex items-center justify-between text-xs font-bold text-green-800">
            <span>Subiendo video...</span>
            <span>{pctSubida}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-green-100">
            <div
              className="h-full rounded-full bg-green-600 transition-[width] duration-150"
              style={{ width: `${pctSubida}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-semibold text-green-700">
            <span>{(cargado / 1048576).toFixed(1)} MB de {(total / 1048576).toFixed(1)} MB</span>
            <span>{formatoEta(etaSegundos)}</span>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="mt-2.5 w-full rounded-lg border border-red-200 dark:border-red-900 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      ) : busy === 'quitando' ? (
        <div className="rounded-lg border border-dashed border-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-8 text-center">
          <Loader2 className="w-5 h-5 mx-auto animate-spin text-green-700" />
          <p className="mt-1.5 text-xs font-bold text-green-800">Quitando video...</p>
        </div>
      ) : tieneVideoListo ? (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden bg-black">
            {previewUrl ? (
              <video
                key={previewUrl}
                controls
                playsInline
                preload="metadata"
                onError={alFallarVideo}
                className="w-full max-h-56 bg-black"
                src={previewUrl}
              />
            ) : (
              <div className="h-28 flex items-center justify-center text-white text-xs">
                {loadingPreview ? 'Cargando video...' : 'No se pudo cargar el video'}
              </div>
            )}
          </div>
          {errorReproduccion && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errorReproduccion}
              </span>
              <button
                type="button"
                onClick={refrescarEnlace}
                className="shrink-0 cursor-pointer text-[11px] font-bold text-red-700 dark:text-red-300 underline"
              >
                Reintentar
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={abrirSelector}
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-green-900 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg cursor-pointer"
            >
              Reemplazar video
            </button>
            <button
              type="button"
              onClick={onRemoveVideo}
              className="px-2.5 py-1.5 border border-red-200 dark:border-red-900 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
            >
              Quitar video
            </button>
          </div>
        </div>
      ) : pendingFile ? (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden bg-black">
            <video controls className="w-full max-h-56 bg-black" src={pendingUrl} />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {pendingFile.name} · {pesoLegible(pendingFile.size)}
            </span>
            <span className="shrink-0 text-[10px] font-bold uppercase text-amber-600">Se sube al crear</span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={abrirSelector}
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-green-900 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg cursor-pointer"
            >
              Elegir otro
            </button>
            <button
              type="button"
              onClick={onClearPendingFile}
              className="px-2.5 py-1.5 border border-red-200 dark:border-red-900 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Subir archivo <-> Enlace de YouTube, igual que Google Drive deja
              elegir entre subir un archivo o pegar un link de YouTube. */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setModo('archivo')}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${modo === 'archivo' ? 'bg-white dark:bg-slate-900 text-green-800 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Subir archivo
            </button>
            <button
              type="button"
              onClick={() => setModo('enlace')}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${modo === 'enlace' ? 'bg-white dark:bg-slate-900 text-green-800 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Enlace de YouTube
            </button>
          </div>

          {modo === 'enlace' ? (
            <div className="space-y-2">
              <input
                type="url"
                value={videoUrlEnlace || ''}
                onChange={(e) => onChangeVideoUrlEnlace?.(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {videoUrlEnlace && !idDeYoutube(videoUrlEnlace) && (
                <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Eso no parece un enlace de YouTube. Copia el link completo del video.
                </p>
              )}
              {idDeYoutube(videoUrlEnlace) && (
                <div className="space-y-1.5">
                  <div className="rounded-lg overflow-hidden bg-black aspect-video">
                    <iframe
                      key={videoUrlEnlace}
                      src={embedYoutube(videoUrlEnlace)}
                      title="Vista previa del video"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    La miniatura se toma sola de YouTube — no hay que subir nada aparte.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              className="rounded-lg border border-dashed px-3 py-5 text-center transition-colors"
              style={{ borderColor: dragging ? '#166534' : '#E2E8F0', backgroundColor: dragging ? '#F0FDF4' : '#FFFFFF' }}
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 dark:text-slate-500" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Arrastra el video aquí o{' '}
                <button type="button" onClick={abrirSelector} className="font-bold text-green-700 underline cursor-pointer">
                  selecciónalo
                </button>
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">MP4, MOV o WEBM · hasta {MAX_VIDEO_MB} MB (ideal: menos de 20 MB)</p>
              {estado === 'error' && (
                <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Hubo un error al subir el video. Intenta de nuevo.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
