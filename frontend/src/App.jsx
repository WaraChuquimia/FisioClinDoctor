import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ModalNuevoPaciente from './components/ModalNuevoPaciente';
import Login from './components/Login';
import ModalSolicitudPendiente from './components/ModalSolicitudPendiente';
import ModalNuevaPassword from './components/ModalNuevaPassword';
import ModalSolicitarAcceso from './components/ModalSolicitarAcceso';
import ModalEvaluacion from './components/ModalEvaluacion';
import ModalAlta from './components/ModalAlta';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Cada módulo del sidebar es un chunk aparte: solo se descarga cuando el
// usuario entra a esa vista. Reportes y GestionUsuarios arrastran jspdf,
// docx y html2canvas (pesado), así que son los que más ganan con esto.
const DashboardInicio = lazy(() => import('./components/DashboardInicio'));
const ModuloPacientes = lazy(() => import('./components/ModuloPacientes'));
const PrescripcionRutinas = lazy(() => import('./components/PrescripcionRutinas'));
const CatalogoEjercicios = lazy(() => import('./components/CatalogoEjercicios'));
const GraficosEvolucion = lazy(() => import('./components/GraficosEvolucion'));
const SuperadminViews = lazy(() => import('./components/SuperadminViews'));
const AgendaCitas = lazy(() => import('./components/AgendaCitas'));
const MensajesPacientes = lazy(() => import('./components/MensajesPacientes'));
const PerfilMedico = lazy(() => import('./components/PerfilMedico'));
const GestionUsuarios = lazy(() => import('./components/GestionUsuarios'));
const HistorialSesiones = lazy(() => import('./components/HistorialSesiones'));
const EvaluacionGoniometro = lazy(() => import('./components/EvaluacionGoniometro'));
const Reportes = lazy(() => import('./components/Reportes'));
import { restoreSession, refreshSession, signOut, esRetornoDeRecuperacion } from './lib/auth';
import * as api from './lib/api';

// =============================================================================
// El panel ya no guarda la sesión en localStorage ni la pide a `/api/auth/login`.
// La sesión vive en Supabase Auth y se reconstruye en cada arranque desde
// `vista_sesion_actual`. Eso resuelve dos cosas de golpe:
//
//   · una sesión copiada a mano en localStorage dejaba de valer, porque los
//     permisos venían del navegador y no de la base;
//   · el retorno de "Entrar con Google" aterriza en esta misma URL sin token en
//     el estado de React, y `restoreSession()` lo recoge del hash de la URL.
// =============================================================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  // Alguien entró con Google (o con usuario+contraseña) y la base no tiene
  // fila suya en `usuarios`: no es "no hay sesión", es que su solicitud está
  // pendiente, fue rechazada, o nunca la hizo. `pendingRequest` guarda ese
  // estado para que se muestre ModalSolicitudPendiente en vez de un login
  // vacío o un panel a medio armar.
  const [pendingRequest, setPendingRequest] = useState(null);

  // `esRetornoDeRecuperacion()` es un chequeo síncrono del hash de la URL:
  // se puede resolver antes de que termine el arranque, así que arranca ya
  // con el valor correcto en vez de esperar un efecto.
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(() => esRetornoDeRecuperacion());
  const [solicitarAccesoOpen, setSolicitarAccesoOpen] = useState(false);

  const [currentView, setCurrentView] = useState('inicio');
  const [patients, setPatients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [citas, setCitas] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profesionales, setProfesionales] = useState({ todos: [], medicos: [], fisioterapeutas: [] });
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeTabInDetail, setActiveTabInDetail] = useState('resumen');
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [enVivo, setEnVivo] = useState(false);
  const [errorActualizacion, setErrorActualizacion] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newPatientModalOpen, setNewPatientModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Modo oscuro: se guarda en localStorage y, si nunca se tocó, arranca según
  // lo que el sistema operativo del usuario ya tenga configurado.
  const [darkMode, setDarkMode] = useState(() => {
    const guardado = localStorage.getItem('fisioclin_modo_oscuro');
    if (guardado != null) return guardado === '1';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('fisioclin_modo_oscuro', darkMode ? '1' : '0');
  }, [darkMode]);

  // Ventana flotante de evaluación con goniómetro (FASE 8): { patient, momento,
  // evaluacionExistente } | null. Se abre desde la ficha del paciente, desde
  // el módulo de Evaluaciones, o al terminar de registrar un paciente nuevo.
  const [evalModalState, setEvalModalState] = useState(null);

  // Ventana flotante del alta (FASE 10): { patient } | null.
  const [altaModalState, setAltaModalState] = useState(null);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Punto único donde se interpreta lo que devuelve restoreSession()/
  // refreshSession(): sesión pendiente, sesión de verdad, o cambio de
  // contraseña obligatorio (recién creada o forzado por el administrador).
  const aplicarSesion = useCallback((sesion) => {
    if (!sesion) return;
    if (sesion.pendiente) {
      setPendingRequest({ solicitud: sesion.solicitud, cuenta: sesion.cuenta });
      return;
    }
    setPendingRequest(null);
    setCurrentUser(sesion);
    setCurrentView(vistaInicial(sesion));
    if (sesion.user?.debe_cambiar_password) setShowNewPasswordModal(true);
  }, []);

  // --------------------------------------------------------------- ARRANQUE
  useEffect(() => {
    (async () => {
      try {
        const sesion = await restoreSession();
        aplicarSesion(sesion);
      } finally {
        setBootLoading(false);
      }
    })();
  }, [aplicarSesion]);

  // ------------------------------------------------------------ CARGA DE DATOS
  const cargarTodo = useCallback(async () => {
    if (!currentUser || currentUser.user?.nombre_rol === 'paciente') return;
    setLoading(true);
    try {
      const avisos = [];
      const resultados = await Promise.allSettled([
        api.cargarPacientes((aviso) => avisos.push(aviso)),
        api.cargarEjercicios(),
        api.cargarCitas(),
        api.cargarNotificaciones(),
        api.cargarProfesionales(),
      ]);
      const setters = [setPatients, setExercises, setCitas, setNotifications, setProfesionales];
      const etiquetas = ['pacientes', 'ejercicios', 'citas', 'notificaciones', 'profesionales'];
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'fulfilled') {
          setters[indice](resultado.value);
        } else {
          console.error(`No se pudieron cargar ${etiquetas[indice]}:`, resultado.reason);
          const detalle = resultado.reason instanceof Error
            ? resultado.reason.message
            : String(resultado.reason);
          avisos.push(`${etiquetas[indice]}: ${detalle}`);
        }
      });
      if (resultados.some((resultado) => resultado.status === 'fulfilled')) {
        setUltimaActualizacion(new Date());
      }
      const mensajeError = avisos.join(' ');
      setErrorActualizacion(mensajeError);
      if (mensajeError) showToast(mensajeError, 'error');
    } catch (err) {
      console.error(err);
      setErrorActualizacion(err.message);
      showToast(`No se pudo cargar la información: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUser, showToast]);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  // ------------------------------------------------------------ TIEMPO REAL
  // Cuando alguien (otro médico, la app del paciente, el modelo de visión)
  // guarda una sesión, un dolor, una medición o un alta, los pacientes se
  // vuelven a leer solos. Se espera 800 ms para juntar ráfagas: una sesión
  // inserta decenas de repeticiones y no hace falta recargar por cada una.
  const esPanel = Boolean(currentUser) && currentUser.user?.nombre_rol !== 'paciente';

  useEffect(() => {
    if (!esPanel) return undefined;
    let espera = null;
    let intervalo = null;
    const recargarPacientes = () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        try {
          let aviso = '';
          const pacientes = await api.cargarPacientes((mensaje) => { aviso = mensaje; });
          setPatients(pacientes);
          setUltimaActualizacion(new Date());
          setErrorActualizacion(aviso);
          if (aviso) showToast(aviso, 'error');
        } catch (e) {
          console.error('Tiempo real: no se pudo recargar pacientes', e);
          setErrorActualizacion(e.message);
        }
      }, 800);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') recargarPacientes();
    };
    const dejar = api.suscribirCambios([
      'pacientes', 'sesiones', 'repeticiones_ejercicio', 'metricas_articulares',
      'registro_dolor', 'evaluaciones_goniometro', 'planes_tratamiento',
      'prescripciones_ejercicio', 'altas_paciente', 'historial_clinico',
      'recetas_medicamentos', 'historia_clinica_general',
    ], recargarPacientes, (estado) => {
      const conectado = estado === 'SUBSCRIBED';
      setEnVivo(conectado);
      if (conectado) recargarPacientes();
    });
    intervalo = setInterval(recargarPacientes, 60_000);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      clearTimeout(espera);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      dejar();
      setEnVivo(false);
    };
  }, [esPanel, showToast]);

  // Refrescos parciales, para no releer 8 tablas por marcar una cita.
  const recargarCitas = useCallback(async () => {
    try { setCitas(await api.cargarCitas()); } catch (e) { showToast(e.message, 'error'); }
  }, [showToast]);

  const recargarEjercicios = useCallback(async () => {
    try { setExercises(await api.cargarEjercicios()); } catch (e) { showToast(e.message, 'error'); }
  }, [showToast]);

  const recargarAvisos = useCallback(async () => {
    try { setNotifications(await api.cargarNotificaciones()); } catch (e) { showToast(e.message, 'error'); }
  }, [showToast]);

  // --------------------------------------------------------------- SESIÓN
  const handleLoginSuccess = (sesion) => {
    aplicarSesion(sesion);
    if (!sesion?.pendiente) {
      showToast(`Bienvenido, ${sesion.user.nombre_completo || sesion.user.nombre_usuario}`);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setPendingRequest(null);
    setPatients([]); setExercises([]); setCitas([]); setNotifications([]);
    showToast('Sesión cerrada correctamente');
  };

  const refrescarSesion = async () => {
    const s = await refreshSession();
    aplicarSesion(s);
  };

  // Ventana "Elige tu nueva contraseña": tanto para el cambio obligatorio
  // (6.5) como para el retorno del enlace de recuperación (6.3).
  const handlePasswordSaved = async () => {
    // Limpia el hash de recuperación (#recuperar / #type=recovery) para que
    // un F5 no vuelva a abrir esta ventana.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowNewPasswordModal(false);
    showToast('Contraseña actualizada correctamente');
    await refrescarSesion();
  };

  // -------------------------------------------------------------- ACCIONES
  const handleViewPatientDetail = (patientId) => {
    setSelectedPatientId(patientId);
    setActiveTabInDetail('resumen');
    setCurrentView('pacientes');
  };

  // Desde el módulo de Evaluaciones: llevar directo a la pestaña de
  // Evaluaciones de ese paciente, no al resumen.
  const handleViewPatientEvaluaciones = (patientId) => {
    setSelectedPatientId(patientId);
    setActiveTabInDetail('evaluaciones');
    setCurrentView('pacientes');
  };

  const handleSaveNewPatient = async (datos) => {
    try {
      const nuevo = await api.crearPaciente(datos, currentUser);
      await cargarTodo();
      setSelectedPatientId(nuevo.id);
      // A la pestaña de Evaluaciones, no al resumen: ahí está el botón
      // "Registrar evaluación inicial" — hay que medir ANTES de que el
      // paciente empiece a usar la app.
      setActiveTabInDetail('evaluaciones');
      setCurrentView('pacientes');
      showToast(`Paciente ${nuevo.name} registrado con código ${nuevo.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ----------------------------------------------------- EVALUACIÓN CON GONIÓMETRO
  const handleOpenEvaluacion = (patientId, momento = 'inicial', evaluacionExistente = null) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    setEvalModalState({ patient: paciente, momento, evaluacionExistente });
  };

  const handleCloseEvaluacion = () => setEvalModalState(null);

  const handleSaveEvaluacion = async (idPacienteDb, datos, idEvaluacionExistente) => {
    try {
      if (idEvaluacionExistente) {
        await api.actualizarEvaluacion(idEvaluacionExistente, datos);
      } else {
        await api.crearEvaluacion(idPacienteDb, datos, currentUser);
      }
      await cargarTodo();
      showToast('Evaluación guardada. El historial se actualizó solo.');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // ----------------------------------------------------- ALTA DEL PACIENTE
  const handleOpenAlta = (patientId) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    setAltaModalState({ patient: paciente });
  };

  const handleCloseAlta = () => setAltaModalState(null);

  // Desde el aviso "falta la evaluación final" dentro de ModalAlta: cierra el
  // alta y abre el registro de la evaluación final de ESE paciente.
  const handleIrAEvaluacionFinalDesdeAlta = (patientId) => {
    setAltaModalState(null);
    handleOpenEvaluacion(patientId, 'final', null);
  };

  const handleSaveAlta = async (idPacienteDb, datos) => {
    try {
      await api.darAlta(idPacienteDb, datos);
      await cargarTodo();
      showToast(
        datos.forzar
          ? 'Alta registrada sin evaluación final.'
          : 'Alta registrada. El historial y el plan se cerraron solos.',
      );
    } catch (err) {
      // Si falta la evaluación final, ModalAlta ya muestra el mensaje de la
      // base con las dos salidas — no hace falta un toast duplicado acá.
      if (!err.faltaEvaluacionFinal) showToast(err.message, 'error');
      throw err;
    }
  };

  const handleReingreso = async (patientId, motivo, articulacion, diagnosis) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.reabrirTratamiento(paciente.db_id, motivo, articulacion, diagnosis);
      await cargarTodo();
      showToast(`${paciente.name} volvió a tratamiento.`);
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleSaveRoutine = async (patientId, routineData) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      // Cada prescripción insertada dispara el aviso al paciente desde la base.
      const r = await api.guardarRutina(paciente.db_id, routineData, currentUser);
      await cargarTodo();
      showToast(
        routineData.id_plan
          ? 'Rutina actualizada.'
          : `Rutina prescrita: ${r.prescripciones} ejercicios. El paciente ya fue notificado.`,
      );
      setEditingRoutine(null);
      setSelectedPatientId(patientId);
      setActiveTabInDetail('rutina');
      setCurrentView('pacientes');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Los componentes trabajan con patient.id (el código PAC-0001); la base
  // necesita patient.db_id (el número interno). Se traduce acá, una sola vez.
  const handleUpdatePatient = async (patientId, datos) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.actualizarPaciente(paciente.db_id, datos);
      await cargarTodo();
      showToast('Datos del paciente actualizados');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleStatus = async (patientId, nextStatus) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.cambiarEstadoPaciente(paciente.db_id, nextStatus === 'Activo');
      await cargarTodo();
      showToast(nextStatus === 'Activo' ? 'Paciente activado' : 'Paciente desactivado');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddHistoryEntry = async (patientId, datos) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.crearNotaClinica(paciente.db_id, datos, datos.files, currentUser);
      await cargarTodo();
      showToast('Registro agregado al historial');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateHistoryEntry = async (patientId, idHistorial, datos) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.actualizarNotaClinica(idHistorial, datos);
      const idMedico = currentUser?.medico?.id_medico;
      for (const archivo of datos.files || []) {
        await api.subirAdjunto(paciente.db_id, idHistorial, archivo, idMedico);
      }
      await cargarTodo();
      showToast('Registro actualizado');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleNavigateToPrescription = (patientId) => {
    setSelectedPatientId(patientId);
    setEditingRoutine(null);
    setCurrentView('rutinas');
  };

  const handleEditarRutina = (patientId, routine) => {
    setSelectedPatientId(patientId);
    setEditingRoutine(routine);
    setCurrentView('rutinas');
  };

  const handleEliminarRutina = async (patientId, idPlan) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.cambiarEstadoPlan(idPlan, 'suspendido');
      await cargarTodo();
      showToast('Rutina eliminada. Ya no es la rutina activa del paciente.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCrearReceta = async (patientId, datos) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.crearRecetaMedicamento(paciente.db_id, datos, currentUser);
      await cargarTodo();
      showToast('Medicamento recetado.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSuspenderReceta = async (idReceta) => {
    try {
      await api.suspenderRecetaMedicamento(idReceta);
      await cargarTodo();
      showToast('Receta suspendida.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEliminarReceta = async (idReceta) => {
    try {
      await api.eliminarRecetaMedicamento(idReceta);
      await cargarTodo();
      showToast('Receta eliminada.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGuardarHistoriaGeneral = async (patientId, datos) => {
    const paciente = patients.find((p) => p.id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.guardarHistoriaGeneral(paciente.db_id, datos, currentUser);
      await cargarTodo();
      showToast('Historia clínica general guardada.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateExercise = async (nuevo) => {
    try {
      const creado = await api.crearEjercicio(nuevo, currentUser);
      setExercises((prev) => [...prev, creado]);
      showToast(`Ejercicio "${creado.name}" agregado al catálogo.`);
      return creado;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdateExercise = async (ej) => {
    try {
      const actualizado = await api.actualizarEjercicio(ej);
      // Se combina con lo que ya había (no se reemplaza entero): `actualizarEjercicio`
      // no vuelve a pedir quién lo creó ni cuántos pacientes lo tienen recetado
      // — pedirlo de nuevo por cada edición sería una consulta de más — y perder
      // esos datos de la vista hasta el próximo `cargarTodo()` sería un paso atrás.
      setExercises((prev) => prev.map((x) => (x.id === actualizado.id ? { ...x, ...actualizado } : x)));
      showToast(`Ejercicio "${actualizado.name}" actualizado.`);
      return actualizado;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // El video se guarda aparte: el ejercicio ya tiene que existir (la ruta usa
  // su id_ejercicio). Devuelve el ejercicio actualizado para que el modal
  // refresque su estado al instante, sin esperar el recargarEjercicios().
  // `opciones` trae `onProgress`/`signal` para la barra de progreso y el
  // botón de cancelar del catálogo.
  const handleUploadVideo = async (idEjercicio, archivo, opciones) => {
    try {
      const actualizado = await api.subirVideoEjercicio(idEjercicio, archivo, currentUser, opciones);
      await recargarEjercicios();
      showToast(`Video de "${actualizado.name}" subido correctamente.`);
      return actualizado;
    } catch (err) {
      // Un cancelado no es un error: el usuario lo pidió a propósito. El
      // catálogo ya sabe distinguirlo (`err.cancelado`) y no muestra ESTE
      // aviso — mostraría dos, uno encima del otro, si se dejara acá.
      if (!err?.cancelado) showToast(err.message, 'error');
      throw err;
    }
  };

  const handleRemoveVideo = async (idEjercicio, rutaVideo) => {
    try {
      const actualizado = await api.quitarVideoEjercicio(idEjercicio, rutaVideo);
      await recargarEjercicios();
      showToast('Video eliminado del ejercicio.');
      return actualizado;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteExercise = async (idEjercicio, rutaVideo) => {
    try {
      const r = await api.eliminarEjercicio(idEjercicio, rutaVideo);
      await recargarEjercicios();
      showToast(r.mensaje);
      return r;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // El médico le escribe a UN paciente desde su ficha.
  const handleSendNotification = async (patientId, titulo, mensaje) => {
    const paciente = patients.find((p) => p.id === patientId || p.db_id === patientId);
    if (!paciente) return showToast('Paciente no encontrado', 'error');
    try {
      await api.enviarMensajePaciente(paciente.db_id, titulo, mensaje);
      await recargarAvisos();
      showToast('Mensaje enviado al paciente');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await api.marcarNotificacionesLeidas([notif.id]);
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      }
      if (notif.id_paciente) {
        const p = patients.find((x) => x.db_id === notif.id_paciente);
        if (p) return handleViewPatientDetail(p.id);
      }
      setCurrentView('notificaciones');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ------------------------------------------------------------- RENDER
  let mainContent;

  if (bootLoading) {
    mainContent = (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-green-900 border-t-transparent" />
      </div>
    );
  } else if (!currentUser) {
    mainContent = (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onOpenSolicitarAcceso={() => setSolicitarAccesoOpen(true)}
      />
    );
  } else {
    const esSuper = currentUser.user?.nombre_rol === 'superusuario';

    // Compartido por el Sidebar y por "Mi Perfil" del Header: si el módulo está
    // cerrado para este usuario, ni se cambia de vista (la base tampoco lo
    // dejaría pasar).
    const handleViewChange = (view) => {
      if (!esSuper && currentUser.permissions?.[view] === false) {
        showToast('No tienes acceso a este módulo', 'error');
        return;
      }
      setCurrentView(view);
    };

    const renderView = () => {
      switch (currentView) {
        case 'citas':
          return (
            <AgendaCitas
              citas={citas}
              pacientes={patients}
              onRecargar={recargarCitas}
              onShowNotification={showToast}
            />
          );
        case 'notificaciones':
          return (
            <MensajesPacientes
              pacientes={patients}
              notificaciones={notifications}
              onRecargar={recargarAvisos}
              onShowNotification={showToast}
            />
          );
        case 'perfil':
          return (
            <PerfilMedico
              sesion={currentUser}
              onActualizado={refrescarSesion}
              onShowNotification={showToast}
            />
          );
        case 'usuarios':
        case 'medicos':
        case 'auditoria':
          return <GestionUsuarios vista={currentView} onShowNotification={showToast} />;
        case 'sesiones':
          return <HistorialSesiones patients={patients} onViewPatientDetail={handleViewPatientDetail} />;
        // "Solicitudes de acceso" se fusionó con "Usuarios y permisos": si algo
        // todavía apunta acá (un permiso viejo, un enlace guardado), cae en la
        // misma pantalla en vez de una vista en blanco.
        case 'solicitudes':
          return <GestionUsuarios vista="usuarios" onShowNotification={showToast} />;
        case 'pacientes':
          return (
            <ModuloPacientes
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              onOpenNewPatientModal={() => setNewPatientModalOpen(true)}
              activeTabInDetail={activeTabInDetail}
              setActiveTabInDetail={setActiveTabInDetail}
              onNavigateToPrescription={handleNavigateToPrescription}
              onEditarRutina={handleEditarRutina}
              onEliminarRutina={handleEliminarRutina}
              onSendNotification={handleSendNotification}
              onUpdatePatient={handleUpdatePatient}
              onToggleStatus={handleToggleStatus}
              onAddHistoryEntry={handleAddHistoryEntry}
              onUpdateHistoryEntry={handleUpdateHistoryEntry}
              onOpenEvaluacion={handleOpenEvaluacion}
              onOpenAlta={handleOpenAlta}
              onReingreso={handleReingreso}
              onCrearReceta={handleCrearReceta}
              onSuspenderReceta={handleSuspenderReceta}
              onEliminarReceta={handleEliminarReceta}
              onGuardarHistoriaGeneral={handleGuardarHistoriaGeneral}
              onShowNotification={showToast}
              onRecargar={cargarTodo}
            />
          );
        case 'evaluaciones':
          return (
            <EvaluacionGoniometro
              patients={patients}
              onViewPatient={handleViewPatientEvaluaciones}
            />
          );
        case 'reportes':
          return (
            <Reportes
              patients={patients}
              currentUser={currentUser}
              onShowNotification={showToast}
            />
          );
        case 'rutinas':
          return (
            <PrescripcionRutinas
              patients={patients.filter((p) => p.status === 'Activo')}
              exercises={exercises}
              preSelectedPatientId={selectedPatientId}
              routineToEdit={editingRoutine}
              onSaveRoutine={handleSaveRoutine}
              onCancel={() => {
                setEditingRoutine(null);
                setCurrentView(selectedPatientId ? 'pacientes' : 'inicio');
              }}
            />
          );
        case 'ejercicios':
          return (
            <CatalogoEjercicios
              exercises={exercises}
              onUpdateExercise={handleUpdateExercise}
              onCreateExercise={handleCreateExercise}
              onUploadVideo={handleUploadVideo}
              onRemoveVideo={handleRemoveVideo}
              onDeleteExercise={handleDeleteExercise}
              onShowNotification={showToast}
              onNavigateToPrescription={handleNavigateToPrescription}
            />
          );
        case 'evolucion':
          return <GraficosEvolucion patients={patients} profesionales={profesionales} enVivo={enVivo} ultimaActualizacion={ultimaActualizacion} errorActualizacion={errorActualizacion} />;
        case 'superadmin':
          return (
            <SuperadminViews
              currentUser={{
                nombre_usuario: currentUser.user?.nombre_usuario,
                nombre_completo: currentUser.user?.nombre_completo,
                nombre_rol: currentUser.user?.nombre_rol,
              }}
              patients={patients}
              citas={citas}
              onShowNotification={showToast}
              onViewChange={setCurrentView}
            />
          );
        case 'inicio':
        default:
          return (
            <DashboardInicio
              patients={patients}
              citas={citas}
              currentUser={{
                nombre_usuario: currentUser.user?.nombre_usuario,
                nombre_completo: currentUser.user?.nombre_completo,
                nombre_rol: currentUser.user?.nombre_rol,
              }}
              onViewPatientDetail={handleViewPatientDetail}
              onViewChange={setCurrentView}
            />
          );
      }
    };

    mainContent = (
      <div className="relative flex min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          sidebarOpen={sidebarOpen}
          currentUser={{
            nombre_rol: currentUser.user?.nombre_rol,
            permissions: currentUser.permissions,
          }}
        />

        <div className="flex min-w-0 flex-grow flex-col">
          <Header
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
            currentUser={{
              nombre_usuario: currentUser.user?.nombre_usuario,
              nombre_completo: currentUser.user?.nombre_completo,
              nombre_rol: currentUser.user?.nombre_rol,
              avatar_url: currentUser.user?.avatar_url,
            }}
            onLogout={handleLogout}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((v) => !v)}
            onViewChange={handleViewChange}
          />

          <main className="relative mx-auto w-full max-w-[1400px] flex-grow p-6 md:p-8">
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-50/50 backdrop-blur-xs">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-green-900 border-t-transparent" />
              </div>
            )}
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-green-900 border-t-transparent" />
                </div>
              }
            >
              {renderView()}
            </Suspense>
          </main>
        </div>

        <ModalNuevoPaciente
          isOpen={newPatientModalOpen}
          onClose={() => setNewPatientModalOpen(false)}
          onSave={handleSaveNewPatient}
          currentUser={currentUser}
          profesionales={profesionales}
        />
      </div>
    );
  }

  return (
    <>
      {mainContent}

      <Toast toast={toast} />

      {/* 6.1 — se abre sola apenas restoreSession() devuelve pendiente:true.
          No se cierra con Escape ni clic afuera: solo "Cerrar sesión". */}
      {pendingRequest && (
        <ModalSolicitudPendiente
          solicitud={pendingRequest.solicitud}
          cuenta={pendingRequest.cuenta}
          onSignOut={handleLogout}
          onSolicitarAcceso={() => setSolicitarAccesoOpen(true)}
        />
      )}

      {/* 6.3 + 6.5 — retorno del enlace de recuperación, o cambio obligatorio. */}
      {showNewPasswordModal && <ModalNuevaPassword onSaved={handlePasswordSaved} />}

      {/* 6.4 — la abre el enlace "Solicitar acceso" del login, o el botón de
          ModalSolicitudPendiente cuando el correo no está registrado. */}
      <ModalSolicitarAcceso
        isOpen={solicitarAccesoOpen}
        onClose={() => setSolicitarAccesoOpen(false)}
        prefill={pendingRequest?.cuenta}
      />

      {/* FASE 8 — evaluación con goniómetro. La key fuerza que el formulario
          arranque de cero cada vez que cambia el paciente, el momento, o cuál
          evaluación se está editando. */}
      {evalModalState && (
        <ModalEvaluacion
          key={`${evalModalState.patient.id}-${evalModalState.momento}-${evalModalState.evaluacionExistente?.id || 'nueva'}`}
          patient={evalModalState.patient}
          momentoInicial={evalModalState.momento}
          evaluacionExistente={evalModalState.evaluacionExistente}
          onClose={handleCloseEvaluacion}
          onSave={handleSaveEvaluacion}
        />
      )}

      {/* FASE 10 — dar de alta. Vive aparte de ModalEvaluacion porque, si falta
          la evaluación final, tiene que poder cerrarse a sí misma y abrir esa
          otra ventana en su lugar. */}
      {altaModalState && (
        <ModalAlta
          key={altaModalState.patient.id}
          patient={altaModalState.patient}
          onClose={handleCloseAlta}
          onSave={handleSaveAlta}
          onIrAEvaluacionFinal={handleIrAEvaluacionFinalDesdeAlta}
        />
      )}
    </>
  );
}

function vistaInicial(sesion) {
  if (sesion.user?.nombre_rol === 'superusuario') return 'superadmin';
  const orden = ['inicio', 'pacientes', 'citas', 'sesiones', 'evolucion', 'perfil'];
  return orden.find((m) => sesion.permissions?.[m] !== false) || 'perfil';
}

function Toast({ toast, oscuro }) {
  if (!toast) return null;
  return (
    <div
      className={`animate-slide-in fixed bottom-5 right-5 z-50 flex max-w-md items-center gap-2 rounded-xl border p-3 text-xs shadow-2xl ${
        oscuro ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {toast.type === 'error'
        ? <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
        : <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />}
      <span className="font-semibold">{toast.text}</span>
    </div>
  );
}
