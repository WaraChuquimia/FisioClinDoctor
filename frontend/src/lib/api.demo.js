// =============================================================================
// Capa de datos del panel — VERSIÓN MOCK (sin Supabase, sin backend, sin red).
// -----------------------------------------------------------------------------
// Cada función devuelve datos de muestra desde `mockDb.js` y respeta la misma
// firma que la versión conectada, así que ningún componente cambió.
//
// Las escrituras (crear paciente, guardar rutina, programar cita, enviar
// mensaje…) mutan los arreglos en memoria: se ven durante la sesión y se
// pierden al recargar la página.
// =============================================================================
import {
  mapPacienteBase, mapHistorial, mapSesion, mapEjercicio, mapMedico,
  mapPlanARoutine, fmtDate, frecuenciaSemanal,
} from './mappers';
import * as db from './mockDb';

const clone = (x) => JSON.parse(JSON.stringify(x));
const agrupar = (filas, clave) => {
  const mapa = new Map();
  for (const f of filas || []) {
    if (!mapa.has(f[clave])) mapa.set(f[clave], []);
    mapa.get(f[clave]).push(f);
  }
  return mapa;
};
const rom = (fila) => (fila?.rom_promedio != null ? `${Math.round(fila.rom_promedio)}°` : '—');

// =============================================================================
// SESIÓN Y PERFIL
// =============================================================================
export async function actualizarPerfilMedico(datos) {
  await db.delay();
  const m = db.medicos[0];
  Object.assign(m, datos);
  return clone(m);
}

export async function cargarPerfil(idUsuario) {
  await db.delay();
  return { id_usuario: idUsuario, avatar_path: null, avatar_bucket: null };
}

export async function subirAvatar(idUsuario, archivo) {
  await db.delay();
  // Sin bucket: devolvemos un object URL local para previsualizar la foto.
  const url = typeof URL !== 'undefined' && archivo ? URL.createObjectURL(archivo) : null;
  return { storage_path: `local/${idUsuario}`, url };
}

export async function urlFirmada() {
  return null;
}

export async function quitarAvatar() {
  await db.delay();
  return { ok: true };
}

export async function cargarPreferencias() {
  await db.delay();
  return clone(db.preferencias);
}

export async function guardarPreferencias(datos) {
  await db.delay();
  Object.assign(db.preferencias, datos);
  return clone(db.preferencias);
}

// =============================================================================
// PACIENTES
// =============================================================================
// Modo demo: no hay base que avise cambios.
export function suscribirCambios() {
  return () => {};
}

export async function cargarPacientes() {
  await db.delay();

  const porHistorial = agrupar(db.historialClinico, 'id_paciente');
  const porSesion = agrupar(db.sesiones, 'id_paciente');
  const porPresc = agrupar(db.prescripciones.filter((x) => x.activo), 'id_paciente');
  const porPlanes = agrupar(db.planes, 'id_paciente');
  const porDolor = agrupar([...db.registroDolor].sort((a, b) => new Date(a.fecha_registro) - new Date(b.fecha_registro)), 'id_paciente');
  const porProgreso = agrupar([...db.progresoSemanal].sort((a, b) => new Date(a.semana) - new Date(b.semana)), 'id_paciente');
  const ejPorId = new Map(db.ejercicios.map((e) => [e.id_ejercicio, e]));

  return db.pacientes.map((p) => {
    const id = p.id_paciente;
    const misSes = porSesion.get(id) || [];
    const misDol = porDolor.get(id) || [];
    const misPres = porPresc.get(id) || [];
    const planAct = (porPlanes.get(id) || []).find((x) => x.estado === 'activo') || (porPlanes.get(id) || [])[0] || null;

    const semanas = porProgreso.get(id) || [];
    const completadas = misSes.filter((s) => s.completado).length;
    // Cumplimiento: media de repeticiones correctas de sus sesiones; si aún no
    // tiene sesiones, se asume 100 %.
    const compliance = misSes.length
      ? Math.round(misSes.reduce((a, s) => a + (s.porcentaje_correctas ?? 90), 0) / misSes.length)
      : 100;
    const totalPrevisto = Math.max(misSes.length, (misPres.length || 1) * ((planAct?.duracion_estimada_semanas) || 4), 4);

    return {
      ...mapPacienteBase(p),

      sessionsCompleted: completadas,
      sessionsTotal: totalPrevisto,
      complianceRate: compliance,
      painLevelInitial: misDol.length ? misDol[0].nivel_dolor : 0,
      painLevelCurrent: misDol.length ? misDol[misDol.length - 1].nivel_dolor : 0,
      romInitial: rom(semanas[0]),
      romCurrent: rom(semanas[semanas.length - 1]),
      ultimaSesion: misSes[0]?.fecha_hora || null,
      prescripcionesActivas: misPres.length,
      avatarBucket: null,
      avatarPath: null,

      history: (porHistorial.get(id) || [])
        .slice()
        .sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro))
        .map(mapHistorial),

      sessions: misSes
        .slice()
        .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
        .map((s) => ({
          ...mapSesion(s, s.supervisor),
          repeticiones: s.repeticiones_totales,
          repeticionesCorrectas: s.repeticiones_correctas,
          porcentajeCorrectas: s.porcentaje_correctas,
          anguloPromedio: s.angulo_promedio,
          romMaximo: s.rom_maximo,
          dolorAntes: s.dolor_antes,
          dolorDespues: s.dolor_despues,
        })),

      routine: planAct
        ? {
            ...mapPlanARoutine(planAct, []),
            exercises: misPres.map((x) => {
              const ej = ejPorId.get(x.id_ejercicio) || {};
              return {
                id: x.id_ejercicio,
                id_prescripcion: x.id_prescripcion,
                name: ej.nombre || `Ejercicio ${x.id_ejercicio}`,
                series: x.series,
                reps: String(x.repeticiones),
                freq: `${x.frecuencia_semanal} veces/sem`,
                instructions: x.observaciones || ej.descripcion || '',
                porSesion: x.series * x.repeticiones,
                porSemana: x.series * x.repeticiones * (x.frecuencia_semanal || 3),
                realizadas: db.sesiones.filter((s) => s.id_prescripcion === x.id_prescripcion).length,
                esperadas: (x.frecuencia_semanal || 3) * ((planAct.duracion_estimada_semanas) || 4),
                adherencia: 100,
                articulacion: ej.articulacion_objetivo || p.articulacion_principal,
              };
            }),
          }
        : null,

      evolutionData: semanas.map((s, i) => ({
        week: `Semana ${i + 1}`,
        semana: s.semana,
        pain: Number(s.dolor_promedio ?? 0),
        ROM: Number(s.rom_promedio ?? 0),
        compliance: s.sesiones ? Math.min(100, s.sesiones * 25) : 0,
      })),

      painHistory: misDol.map((d) => ({
        fecha: fmtDate(d.fecha_registro),
        nivel: d.nivel_dolor,
        momento: d.momento,
      })),
    };
  });
}

export async function crearPaciente(datos, sesion) {
  await db.delay();
  const idMedico = sesion?.medico?.id_medico || 2;
  const id = db.nextId.paciente();
  const fila = {
    id_paciente: id,
    id_usuario: null,
    codigo_anonimo: `PAC-${String(id).padStart(4, '0')}`,
    numero_carnet: datos.ci || String(7000000 + id),
    tipo_documento: 'ci',
    nombre_completo: datos.name,
    fecha_nacimiento: datos.birthDate || '1985-01-01',
    sexo: datos.gender === 'Femenino' ? 'F' : 'M',
    grado_artrosis_kl: Number(datos.gradoArtrosis) || 2,
    articulacion_principal: datos.articulacion || 'rodilla',
    diagnostico_previo: datos.diagnosis || 'Artrosis en estudio',
    activo: true,
    id_medico_tratante: datos.id_medico_tratante || idMedico,
    id_fisioterapeuta_asignado: datos.id_fisioterapeuta || null,
    telefono: datos.phone || null,
    direccion: datos.address || null,
    email: datos.email || '',
    fecha_registro: new Date().toISOString(),
  };
  db.pacientes.unshift(fila);
  return mapPacienteBase(fila);
}

// =============================================================================
// CATÁLOGO DE EJERCICIOS
// =============================================================================
export async function cargarEjercicios() {
  await db.delay();
  return db.ejercicios.map(mapEjercicio);
}

export async function crearEjercicio(ej, sesion) {
  await db.delay();
  const fila = {
    id_ejercicio: db.nextId.ejercicio(),
    codigo_fisioclin: ej.codigo || null,
    nombre: ej.name,
    descripcion: ej.instructions || null,
    articulacion_objetivo: ej.joint || 'rodilla',
    angulo_min_esperado: Number(ej.minAngle ?? 0),
    angulo_max_esperado: Number(ej.maxAngle ?? 120),
    duracion_estimada_segundos: Number(ej.duration ?? 30),
    video_referencia_url: ej.videoUrl || '',
    id_medico_creador: sesion?.medico?.id_medico || 2,
    activo: true,
  };
  db.ejercicios.push(fila);
  return mapEjercicio(fila);
}

export async function actualizarEjercicio(ej) {
  await db.delay();
  const fila = db.ejercicios.find((x) => x.id_ejercicio === ej.id);
  if (fila) {
    Object.assign(fila, {
      nombre: ej.name,
      descripcion: ej.instructions,
      articulacion_objetivo: ej.joint,
      angulo_min_esperado: Number(ej.minAngle ?? 0),
      angulo_max_esperado: Number(ej.maxAngle ?? 120),
      duracion_estimada_segundos: Number(ej.duration ?? 30),
      video_referencia_url: ej.videoUrl || '',
      activo: ej.activo !== false,
    });
  }
  return mapEjercicio(fila || ej);
}

// =============================================================================
// PLAN Y PRESCRIPCIONES
// =============================================================================
export async function guardarRutina(idPaciente, rutina, sesion) {
  await db.delay();
  const idMedico = sesion?.medico?.id_medico || 2;
  let idPlan = rutina.id_plan;

  if (idPlan) {
    const plan = db.planes.find((x) => x.id_plan === idPlan);
    if (plan) {
      plan.objetivo_general = rutina.name;
      plan.duracion_estimada_semanas = Number(rutina.weeks) || Math.ceil((rutina.duration || 14) / 7);
      plan.fecha_inicio = rutina.startDate || plan.fecha_inicio;
      plan.observaciones = rutina.instructions || null;
    }
  } else {
    // Mismo cierre que en api.js: solo puede haber un plan 'activo' por
    // paciente, o el viejo se sigue leyendo en vez del recién creado.
    db.planes.forEach((x) => {
      if (x.id_paciente === idPaciente && x.estado === 'activo') {
        x.estado = 'completado';
        x.fecha_fin_real = new Date().toISOString().slice(0, 10);
      }
    });

    idPlan = db.nextId.plan();
    db.planes.unshift({
      id_plan: idPlan,
      id_paciente: idPaciente,
      id_medico_responsable: idMedico,
      objetivo_general: rutina.name || 'Plan terapéutico',
      duracion_estimada_semanas: Number(rutina.weeks) || Math.ceil((rutina.duration || 14) / 7),
      fecha_inicio: rutina.startDate || new Date().toISOString().slice(0, 10),
      fecha_fin_estimada: rutina.endDate || null,
      observaciones: rutina.instructions || null,
      estado: 'activo',
    });
  }

  // Desactivar prescripciones viejas del plan.
  db.prescripciones.forEach((x) => {
    if (x.id_plan === idPlan && x.activo) x.activo = false;
  });

  const nuevas = (rutina.exercises || []).map((e) => ({
    id_prescripcion: db.nextId.plan() + 1000,
    id_plan: idPlan,
    id_paciente: idPaciente,
    id_ejercicio: e.id,
    id_medico_prescriptor: idMedico,
    series: Number(e.series) || 3,
    repeticiones: Number(e.reps) || 10,
    frecuencia_semanal: frecuenciaSemanal(e.freq),
    observaciones: e.instructions || null,
    activo: true,
  }));
  db.prescripciones.push(...nuevas);

  return { id_plan: idPlan, prescripciones: nuevas.length };
}

export async function cambiarEstadoPlan(idPlan, estado) {
  await db.delay();
  const plan = db.planes.find((x) => x.id_plan === idPlan);
  if (!plan) throw new Error('No se pudo cambiar el estado del plan');
  plan.estado = estado;
  plan.fecha_fin_real = estado === 'completado' ? new Date().toISOString().slice(0, 10) : null;
  return plan;
}

// =============================================================================
// AGENDA
// =============================================================================
function citaSalida(c) {
  const p = db.pacientes.find((x) => x.id_paciente === c.id_paciente) || {};
  const m = db.medicos.find((x) => x.id_medico === c.id_medico) || {};
  const d = new Date(c.fecha_hora);
  return {
    ...c,
    id: c.id_cita,
    paciente: p.nombre_completo || '—',
    patientName: p.nombre_completo || '—',
    codigo_anonimo: p.codigo_anonimo || '—',
    patientId: p.codigo_anonimo || '—',
    telefono_paciente: p.telefono || '',
    articulacion: p.articulacion_principal || '',
    medico: m.nombre_completo || '',
    diagnosis: p.diagnostico_previo || '',
    fecha_local: d.toISOString().slice(0, 10),
    hora_local: d.toTimeString().slice(0, 5),
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
    type: c.tipo,
    status: c.estado,
    lugar: c.lugar || 'COSSMIL',
    vencida: d.getTime() < Date.now() && ['programada', 'confirmada'].includes(c.estado),
  };
}

export async function cargarCitas(desde = null) {
  await db.delay();
  let filas = [...db.citas].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  if (desde) filas = filas.filter((c) => new Date(c.fecha_hora) >= new Date(desde));
  return filas.map(citaSalida);
}

export async function programarCita(datos) {
  await db.delay();
  const id = db.nextId.cita();
  db.citas.push({
    id_cita: id,
    id_paciente: Number(datos.id_paciente),
    id_medico: datos.id_medico || 2,
    id_plan: datos.id_plan || null,
    fecha_hora: datos.fecha_hora,
    duracion_minutos: Number(datos.duracion_minutos) || 45,
    tipo: datos.tipo || 'control',
    modalidad: datos.modalidad || 'presencial',
    motivo: datos.motivo || 'Control',
    lugar: datos.lugar || 'COSSMIL',
    indicaciones: datos.indicaciones || null,
    estado: 'programada',
    recordatorio_enviado: false,
  });
  return { id_cita: id };
}

export async function reprogramarCita(idCita, nuevaFecha) {
  await db.delay();
  const c = db.citas.find((x) => x.id_cita === idCita);
  if (c) {
    c.fecha_hora = nuevaFecha;
    c.estado = 'programada';
  }
  return clone(c);
}

export async function cerrarCita(idCita, estado, observaciones) {
  await db.delay();
  const c = db.citas.find((x) => x.id_cita === idCita);
  if (c) {
    c.estado = estado;
    c.observaciones_cierre = observaciones || null;
  }
  return clone(c);
}

// =============================================================================
// NOTIFICACIONES Y MENSAJES
// =============================================================================
function haceCuantoTxt(valor) {
  const ms = Date.now() - new Date(valor).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

export async function cargarNotificaciones(limite = 50) {
  await db.delay();
  return [...db.notificaciones]
    .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
    .slice(0, limite)
    .map((n) => ({
      id: n.id_notificacion,
      id_notificacion: n.id_notificacion,
      text: n.titulo,
      mensaje: n.mensaje,
      time: haceCuantoTxt(n.fecha_creacion),
      fecha_creacion: n.fecha_creacion,
      read: n.leida,
      leida: n.leida,
      severidad: n.severidad,
      categoria: n.categoria,
      tipo: n.tipo,
      id_paciente: n.id_paciente,
      accion_ruta: n.accion_ruta,
    }));
}

export async function marcarNotificacionesLeidas(ids = null) {
  await db.delay();
  db.notificaciones.forEach((n) => {
    if (!ids || ids.includes(n.id_notificacion)) n.leida = true;
  });
  return { ok: true };
}

function nuevoAviso(idPaciente, titulo, mensaje, severidad) {
  const p = db.pacientes.find((x) => x.id_paciente === idPaciente);
  db.notificaciones.unshift({
    id_notificacion: db.nextId.notif() + 1000,
    id_usuario: p?.id_usuario || null,
    id_paciente: idPaciente,
    tipo: 'mensaje_medico',
    categoria: 'mensaje',
    severidad: severidad || 'info',
    titulo,
    mensaje,
    accion_ruta: '/notificaciones',
    leida: false,
    fecha_creacion: new Date().toISOString(),
  });
}

export async function enviarMensajePaciente(idPaciente, titulo, mensaje, severidad = 'info') {
  await db.delay();
  nuevoAviso(idPaciente, titulo, mensaje, severidad);
  return { ok: true };
}

export async function enviarMensajeMasivo(idsPaciente, titulo, mensaje, severidad = 'info') {
  await db.delay();
  (idsPaciente || []).forEach((id) => nuevoAviso(id, titulo, mensaje, severidad));
  return { ok: true, enviados: (idsPaciente || []).length };
}

// =============================================================================
// SUPERUSUARIO
// =============================================================================
export async function cargarUsuarios() {
  await db.delay();
  return clone(db.usuarios);
}

export async function cargarMedicos() {
  await db.delay();
  return db.medicos.map((m) => ({
    ...mapMedico({
      ...m,
      usuarios: {
        id_usuario: m.id_usuario,
        email: `${m.nombre_completo.toLowerCase().replace(/[^a-z]+/g, '.')}@fisioclin.demo`,
        activo: true,
        rol: m.tipo_profesional,
      },
    }),
    biografia: m.biografia || '',
    consultorio: m.consultorio || '',
    horario_atencion: m.horario_atencion || '',
  }));
}

export async function definirModulos(idUsuario, modulos) {
  await db.delay();
  const u = db.usuarios.find((x) => x.id_usuario === idUsuario);
  if (u) u.modulos_permitidos = { ...u.modulos_permitidos, ...modulos };
  return clone(u);
}

export async function cambiarEstadoUsuario(idUsuario, activo) {
  await db.delay();
  const u = db.usuarios.find((x) => x.id_usuario === idUsuario);
  if (u) u.activo = activo;
  return clone(u);
}

export async function crearProfesional(datos) {
  await db.delay();
  const idUsuario = db.nextId.usuario();
  const idMedico = db.nextId.usuario() + 100;
  db.medicos.push({
    id_medico: idMedico, id_usuario: idUsuario,
    nombre_completo: datos.nombre_completo, tipo_profesional: datos.tipo_profesional,
    especialidad: datos.especialidad || '', cedula_profesional: datos.cedula_profesional || '',
    telefono: datos.telefono || '', unidad: 'COSSMIL', biografia: '', consultorio: '', horario_atencion: '',
  });
  db.usuarios.push({
    id_usuario: idUsuario, rol: datos.tipo_profesional, email: datos.email,
    nombre_usuario: (datos.email || '').split('@')[0], medico_nombre: datos.nombre_completo,
    paciente_nombre: null, id_medico: idMedico, cedula_profesional: datos.cedula_profesional || '',
    pacientes_a_cargo: 0, tiene_cuenta_auth: false, activo: true,
    modulos_permitidos: { inicio: true, pacientes: true, sesiones: true, citas: true, perfil: true, notificaciones: true },
  });
  return { id_usuario: idUsuario, id_medico: idMedico };
}

export async function cargarSolicitudes() {
  await db.delay();
  return clone(db.solicitudes.filter((s) => s.estado === 'pendiente'));
}

export async function aprobarSolicitud(idSolicitud) {
  await db.delay();
  const s = db.solicitudes.find((x) => x.id_solicitud === idSolicitud);
  if (s) {
    s.estado = 'aprobada';
    await crearProfesional({
      nombre_completo: s.nombre_completo, email: s.email,
      cedula_profesional: s.cedula_profesional, tipo_profesional: s.tipo_profesional,
      especialidad: '', telefono: s.telefono,
    });
  }
  return { ok: true };
}

export async function rechazarSolicitud(idSolicitud, _id, motivo) {
  await db.delay();
  const s = db.solicitudes.find((x) => x.id_solicitud === idSolicitud);
  if (s) { s.estado = 'rechazada'; s.observaciones = motivo || ''; }
  return { ok: true };
}

export async function cargarBitacora(limite = 200) {
  await db.delay();
  return clone(db.bitacora.slice(0, limite));
}

export async function crearCuentaAcceso({ email }) {
  await db.delay();
  const u = db.usuarios.find((x) => x.email === email);
  if (u) u.tiene_cuenta_auth = true;
  return { ok: true, email };
}

export async function cambiarPasswordDeOtro() {
  await db.delay();
  return { ok: true };
}

export async function cambiarEmailDeOtro() {
  await db.delay();
  return { ok: true };
}

export async function ejecutarRevisionAlertas() {
  await db.delay(300);
  return { adherencia: 1, dolor_alto: 1, recordatorios_cita: 2, tecnica: 1, total: 5 };
}
