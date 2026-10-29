// =============================================================================
// Base de datos FALSA, en memoria. No hay Supabase, no hay backend, no hay red.
// -----------------------------------------------------------------------------
// El objetivo es que el panel se pueda NAVEGAR con datos de muestra. Todo lo que
// se "guarda" (pacientes nuevos, rutinas, citas, mensajes…) vive solo en esta
// sesión del navegador: al recargar la página vuelve al estado inicial.
//
// Estructura pensada para calzar exactamente con lo que esperan los componentes
// (las mismas formas que antes construía `src/lib/api.js` desde las vistas SQL).
// =============================================================================

export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

let _seqPaciente = 100;
let _seqPlan = 500;
let _seqCita = 900;
let _seqNotif = 1;
let _seqEjercicio = 50;
let _seqUsuario = 20;

export const nextId = {
  paciente: () => ++_seqPaciente,
  plan: () => ++_seqPlan,
  cita: () => ++_seqCita,
  notif: () => ++_seqNotif,
  ejercicio: () => ++_seqEjercicio,
  usuario: () => ++_seqUsuario,
};

const hoy = new Date();
const iso = (d) => new Date(d).toISOString();
const diasAtras = (n) => iso(new Date(hoy.getTime() - n * 86400000));
const diasAdelante = (n) => iso(new Date(hoy.getTime() + n * 86400000));

// ----------------------------------------------------------------- EJERCICIOS
export const ejercicios = [
  { id_ejercicio: 1, codigo_fisioclin: 'ROD-01', nombre: 'Elevación de pierna recta (SLR)', descripcion: 'Acostado boca arriba, rodilla estirada, subir la pierna 30 cm y sostener 2 s.', articulacion_objetivo: 'rodilla', angulo_min_esperado: 0, angulo_max_esperado: 45, duracion_estimada_segundos: 40, video_referencia_url: '', activo: true },
  { id_ejercicio: 2, codigo_fisioclin: 'ROD-02', nombre: 'Flexión de rodilla con banda', descripcion: 'Banda elástica de baja resistencia. Controlar el retorno lentamente.', articulacion_objetivo: 'rodilla', angulo_min_esperado: 0, angulo_max_esperado: 110, duracion_estimada_segundos: 45, video_referencia_url: '', activo: true },
  { id_ejercicio: 3, codigo_fisioclin: 'CAD-01', nombre: 'Puente de glúteos', descripcion: 'Contraer glúteos arriba, alinear hombros, cadera y rodillas. Sostener 3 s.', articulacion_objetivo: 'cadera', angulo_min_esperado: 0, angulo_max_esperado: 30, duracion_estimada_segundos: 40, video_referencia_url: '', activo: true },
  { id_ejercicio: 4, codigo_fisioclin: 'HOM-01', nombre: 'Rotación externa de hombro con banda', descripcion: 'Codo pegado al cuerpo a 90°, girar el antebrazo hacia afuera.', articulacion_objetivo: 'hombro', angulo_min_esperado: 0, angulo_max_esperado: 60, duracion_estimada_segundos: 35, video_referencia_url: '', activo: true },
  { id_ejercicio: 5, codigo_fisioclin: 'CAD-02', nombre: 'Abducción de cadera en decúbito lateral', descripcion: 'Acostado de lado, pierna estirada, elevar lateralmente sin rotar la cadera.', articulacion_objetivo: 'cadera', angulo_min_esperado: 0, angulo_max_esperado: 40, duracion_estimada_segundos: 35, video_referencia_url: '', activo: true },
  { id_ejercicio: 6, codigo_fisioclin: 'ROD-03', nombre: 'Sentadilla isométrica en pared', descripcion: 'Espalda contra la pared, rodillas a 90°. Sostener la posición.', articulacion_objetivo: 'rodilla', angulo_min_esperado: 60, angulo_max_esperado: 90, duracion_estimada_segundos: 40, video_referencia_url: '', activo: true },
  { id_ejercicio: 7, codigo_fisioclin: 'COL-01', nombre: 'Inclinación pélvica (pelvic tilt)', descripcion: 'Aplanar la espalda baja contra el suelo contrayendo el abdomen. Sostener 5 s.', articulacion_objetivo: 'columna', angulo_min_esperado: 0, angulo_max_esperado: 15, duracion_estimada_segundos: 30, video_referencia_url: '', activo: true },
  { id_ejercicio: 8, codigo_fisioclin: 'COL-02', nombre: 'Pájaro-perro (bird-dog)', descripcion: 'Extender brazo y pierna contraria alternando, columna neutra.', articulacion_objetivo: 'columna', angulo_min_esperado: 0, angulo_max_esperado: 90, duracion_estimada_segundos: 45, video_referencia_url: '', activo: true },
];

// ------------------------------------------------------------------ MÉDICOS
export const medicos = [
  { id_medico: 2, id_usuario: 4, nombre_completo: 'Dr. Alejandro Martin', tipo_profesional: 'medico_fisiatra', especialidad: 'Medicina Física y Rehabilitación', cedula_profesional: 'MP-4821', telefono: '+591 70000010', unidad: 'Unidad de Medicina Física y Rehabilitación — COSSMIL', biografia: 'Médico fisiatra con 12 años de experiencia en rehabilitación de rodilla y cadera.', consultorio: 'Consultorio 3, planta baja', horario_atencion: 'Lun a Vie, 08:00–14:00' },
  { id_medico: 3, id_usuario: 5, nombre_completo: 'Dra. Daniela Rojas', tipo_profesional: 'medico_fisiatra', especialidad: 'Medicina Física y Rehabilitación', cedula_profesional: 'MP-5307', telefono: '+591 70000011', unidad: 'Unidad de Medicina Física y Rehabilitación — COSSMIL', biografia: 'Especialista en rehabilitación de columna y hombro.', consultorio: 'Consultorio 4, planta baja', horario_atencion: 'Lun a Vie, 14:00–19:00' },
  { id_medico: 4, id_usuario: 6, nombre_completo: 'Lic. Carlos Mamani', tipo_profesional: 'fisioterapeuta', especialidad: 'Fisioterapia', cedula_profesional: 'FT-2210', telefono: '+591 70000012', unidad: 'Unidad de Medicina Física y Rehabilitación — COSSMIL', biografia: '', consultorio: 'Sala de terapia 1', horario_atencion: 'Lun a Vie, 08:00–16:00' },
];

// ---------------------------------------------------------------- PREFERENCIAS
export const preferencias = {
  tamano_letra: 'normal',
  tema: 'claro',
  alto_contraste: false,
  notificaciones_push: true,
  recordatorio_diario: true,
  audio_guia: true,
  audio_correccion: true,
  vibracion: false,
  hora_recordatorio: '09:00',
  voz: 'es-BO-mujer',
  volumen: 80,
};

// --------------------------------------------------------------- PLANES
export const planes = [
  { id_plan: 501, id_paciente: 101, id_medico_responsable: 2, objetivo_general: 'Fortalecimiento y estabilidad post-artroscopia de rodilla', duracion_estimada_semanas: 8, fecha_inicio: diasAtras(20).slice(0, 10), fecha_fin_estimada: diasAdelante(36).slice(0, 10), observaciones: 'Progresar carga según tolerancia. Hielo 10 min al terminar.', estado: 'activo' },
  { id_plan: 502, id_paciente: 102, id_medico_responsable: 3, objetivo_general: 'Control de gonartrosis grado III — mantener rango y potencia de cuádriceps', duracion_estimada_semanas: 12, fecha_inicio: diasAtras(35).slice(0, 10), fecha_fin_estimada: diasAdelante(49).slice(0, 10), observaciones: 'Evitar impacto. Bicicleta estática sin resistencia como calentamiento.', estado: 'activo' },
  { id_plan: 503, id_paciente: 104, id_medico_responsable: 2, objetivo_general: 'Control de coxartrosis grado II — mantener rango y fuerza de abductores de cadera', duracion_estimada_semanas: 6, fecha_inicio: diasAtras(10).slice(0, 10), fecha_fin_estimada: diasAdelante(32).slice(0, 10), observaciones: 'Progresar carga según tolerancia. Evitar rotación interna forzada.', estado: 'activo' },
];

// -------------------------------------------------------- PRESCRIPCIONES
export const prescripciones = [
  { id_prescripcion: 7001, id_plan: 501, id_paciente: 101, id_ejercicio: 1, id_medico_prescriptor: 2, series: 3, repeticiones: 15, frecuencia_semanal: 7, observaciones: 'Sin dolor punzante en la cara anterior.', activo: true },
  { id_prescripcion: 7002, id_plan: 501, id_paciente: 101, id_ejercicio: 3, id_medico_prescriptor: 2, series: 3, repeticiones: 12, frecuencia_semanal: 7, observaciones: '', activo: true },
  { id_prescripcion: 7003, id_plan: 501, id_paciente: 101, id_ejercicio: 6, id_medico_prescriptor: 2, series: 3, repeticiones: 10, frecuencia_semanal: 4, observaciones: 'Sostener 20 s por repetición.', activo: true },
  { id_prescripcion: 7010, id_plan: 502, id_paciente: 102, id_ejercicio: 2, id_medico_prescriptor: 3, series: 3, repeticiones: 12, frecuencia_semanal: 5, observaciones: 'Banda amarilla.', activo: true },
  { id_prescripcion: 7011, id_plan: 502, id_paciente: 102, id_ejercicio: 6, id_medico_prescriptor: 3, series: 3, repeticiones: 8, frecuencia_semanal: 3, observaciones: '', activo: true },
  { id_prescripcion: 7020, id_plan: 503, id_paciente: 104, id_ejercicio: 5, id_medico_prescriptor: 2, series: 3, repeticiones: 1, frecuencia_semanal: 7, observaciones: 'Mantener 30 s cada repetición.', activo: true },
];

// -------------------------------------------------------------- SESIONES
export const sesiones = [
  { id_sesion: 8001, id_paciente: 101, id_prescripcion: 7001, id_ejercicio: 1, ejercicio: 'Elevación de pierna recta (SLR)', fecha_hora: diasAtras(14), estado: 'completada', completado: true, resultado_evaluacion: 'correcto', observaciones: 'Buen control motor. Edema residual leve.', duracion_segundos: 620, supervisor: 'Dr. Alejandro Martin', repeticiones_totales: 45, repeticiones_correctas: 41, porcentaje_correctas: 91, angulo_promedio: 38, rom_maximo: 44, dolor_antes: 4, dolor_despues: 3 },
  { id_sesion: 8002, id_paciente: 101, id_prescripcion: 7002, id_ejercicio: 3, ejercicio: 'Puente de glúteos', fecha_hora: diasAtras(11), estado: 'completada', completado: true, resultado_evaluacion: 'correcto', observaciones: 'Progresa bien.', duracion_segundos: 540, supervisor: 'Lic. Carlos Mamani', repeticiones_totales: 36, repeticiones_correctas: 34, porcentaje_correctas: 94, angulo_promedio: 27, rom_maximo: 31, dolor_antes: 3, dolor_despues: 2 },
  { id_sesion: 8003, id_paciente: 101, id_prescripcion: 7003, id_ejercicio: 6, ejercicio: 'Sentadilla isométrica en pared', fecha_hora: diasAtras(6), estado: 'completada', completado: true, resultado_evaluacion: 'incorrecto', observaciones: 'Rodilla se adelanta al pie. Revisar técnica.', duracion_segundos: 480, supervisor: 'Dr. Alejandro Martin', repeticiones_totales: 30, repeticiones_correctas: 19, porcentaje_correctas: 63, angulo_promedio: 72, rom_maximo: 88, dolor_antes: 4, dolor_despues: 5 },
  { id_sesion: 8010, id_paciente: 102, id_prescripcion: 7010, id_ejercicio: 2, ejercicio: 'Flexión de rodilla con banda', fecha_hora: diasAtras(9), estado: 'completada', completado: true, resultado_evaluacion: 'correcto', observaciones: 'Sin dolor durante el ejercicio.', duracion_segundos: 600, supervisor: 'Dra. Daniela Rojas', repeticiones_totales: 36, repeticiones_correctas: 33, porcentaje_correctas: 92, angulo_promedio: 95, rom_maximo: 108, dolor_antes: 5, dolor_despues: 4 },
  { id_sesion: 8011, id_paciente: 102, id_prescripcion: 7011, id_ejercicio: 6, ejercicio: 'Sentadilla isométrica en pared', fecha_hora: diasAtras(3), estado: 'completada', completado: true, resultado_evaluacion: 'incorrecto', observaciones: 'Poca profundidad. Reforzar cuádriceps.', duracion_segundos: 420, supervisor: 'Dra. Daniela Rojas', repeticiones_totales: 24, repeticiones_correctas: 14, porcentaje_correctas: 58, angulo_promedio: 55, rom_maximo: 70, dolor_antes: 6, dolor_despues: 6 },
  { id_sesion: 8020, id_paciente: 104, id_prescripcion: 7020, id_ejercicio: 5, ejercicio: 'Abducción de cadera en decúbito lateral', fecha_hora: diasAtras(2), estado: 'completada', completado: true, resultado_evaluacion: 'correcto', observaciones: 'Mejora el rango de abducción.', duracion_segundos: 300, supervisor: 'Dr. Alejandro Martin', repeticiones_totales: 12, repeticiones_correctas: 12, porcentaje_correctas: 100, angulo_promedio: 14, rom_maximo: 16, dolor_antes: 2, dolor_despues: 1 },
];

// ------------------------------------------------------- REGISTRO DE DOLOR
export const registroDolor = [
  { id_dolor: 1, id_paciente: 101, nivel_dolor: 8, momento: 'antes', fecha_registro: diasAtras(20) },
  { id_dolor: 2, id_paciente: 101, nivel_dolor: 5, momento: 'independiente', fecha_registro: diasAtras(12) },
  { id_dolor: 3, id_paciente: 101, nivel_dolor: 3, momento: 'independiente', fecha_registro: diasAtras(4) },
  { id_dolor: 10, id_paciente: 102, nivel_dolor: 7, momento: 'antes', fecha_registro: diasAtras(30) },
  { id_dolor: 11, id_paciente: 102, nivel_dolor: 6, momento: 'independiente', fecha_registro: diasAtras(15) },
  { id_dolor: 12, id_paciente: 102, nivel_dolor: 6, momento: 'independiente', fecha_registro: diasAtras(3) },
  { id_dolor: 20, id_paciente: 104, nivel_dolor: 9, momento: 'antes', fecha_registro: diasAtras(10) },
  { id_dolor: 21, id_paciente: 104, nivel_dolor: 3, momento: 'independiente', fecha_registro: diasAtras(2) },
];

// ------------------------------------------------------------- HISTORIAL
export const historialClinico = [
  { id_historial: 1, id_paciente: 101, id_medico: 2, tipo_entrada: 'diagnostico', titulo: 'Evaluación inicial post-artroscopia', contenido: 'Cuatro semanas de evolución. Rango de movimiento limitado, dolor agudo al apoyo.', fecha_registro: diasAtras(20), visible_para_paciente: true },
  { id_historial: 2, id_paciente: 101, id_medico: 2, tipo_entrada: 'evolucion', titulo: 'Control a las 2 semanas', contenido: 'Mejora en control motor de rodilla. Se retira muleta para marcha en tramos cortos. Dolor 4/10.', fecha_registro: diasAtras(8), visible_para_paciente: true },
  { id_historial: 10, id_paciente: 102, id_medico: 3, tipo_entrada: 'diagnostico', titulo: 'Gonartrosis grado III', contenido: 'Limitación funcional a la marcha prolongada y a subir escaleras. Crepitación palpable.', fecha_registro: diasAtras(35), visible_para_paciente: true },
  { id_historial: 11, id_paciente: 102, id_medico: 3, tipo_entrada: 'cambio_tratamiento', titulo: 'Ajuste de plan', contenido: 'Se reduce carga en sentadilla isométrica por molestia femoropatelar.', fecha_registro: diasAtras(3), visible_para_paciente: false },
  { id_historial: 20, id_paciente: 104, id_medico: 2, tipo_entrada: 'diagnostico', titulo: 'Secuela de fractura bimaleolar', contenido: 'Retiro de yeso hace 3 días. Edema y rigidez articular importante.', fecha_registro: diasAtras(10), visible_para_paciente: true },
];

// -------------------------------------------------- PROGRESO SEMANAL (vista)
export const progresoSemanal = [
  { id_paciente: 101, semana: diasAtras(21).slice(0, 10), dolor_promedio: 8, rom_promedio: 90, sesiones: 2 },
  { id_paciente: 101, semana: diasAtras(14).slice(0, 10), dolor_promedio: 6, rom_promedio: 105, sesiones: 3 },
  { id_paciente: 101, semana: diasAtras(7).slice(0, 10), dolor_promedio: 4, rom_promedio: 120, sesiones: 3 },
  { id_paciente: 101, semana: hoy.toISOString().slice(0, 10), dolor_promedio: 3, rom_promedio: 128, sesiones: 2 },
  { id_paciente: 102, semana: diasAtras(21).slice(0, 10), dolor_promedio: 7, rom_promedio: 95, sesiones: 2 },
  { id_paciente: 102, semana: diasAtras(14).slice(0, 10), dolor_promedio: 6, rom_promedio: 100, sesiones: 2 },
  { id_paciente: 102, semana: diasAtras(7).slice(0, 10), dolor_promedio: 6, rom_promedio: 104, sesiones: 1 },
  { id_paciente: 104, semana: diasAtras(14).slice(0, 10), dolor_promedio: 9, rom_promedio: -5, sesiones: 1 },
  { id_paciente: 104, semana: diasAtras(7).slice(0, 10), dolor_promedio: 5, rom_promedio: 8, sesiones: 2 },
  { id_paciente: 104, semana: hoy.toISOString().slice(0, 10), dolor_promedio: 3, rom_promedio: 15, sesiones: 2 },
];

// ------------------------------------------------------------- PACIENTES
export const pacientes = [
  { id_paciente: 101, id_usuario: null, codigo_anonimo: 'PAC-0001', numero_carnet: '7000001', tipo_documento: 'ci', nombre_completo: 'JUAN CARLOS CONDORI MAMANI', fecha_nacimiento: '1980-03-15', sexo: 'M', grado_artrosis_kl: 2, articulacion_principal: 'rodilla', diagnostico_previo: 'Artrosis de rodilla grado II', activo: true, id_medico_tratante: 2, id_fisioterapeuta_asignado: 4, telefono: '70000001', direccion: 'Zona Sur, La Paz', email: 'juan.condori@example.bo', fecha_registro: diasAtras(22) },
  { id_paciente: 102, id_usuario: null, codigo_anonimo: 'PAC-0002', numero_carnet: '7000002', tipo_documento: 'ci', nombre_completo: 'MARIA ELENA QUISPE FLORES', fecha_nacimiento: '1978-07-22', sexo: 'F', grado_artrosis_kl: 3, articulacion_principal: 'rodilla', diagnostico_previo: 'Gonartrosis grado III con limitación funcional', activo: true, id_medico_tratante: 3, id_fisioterapeuta_asignado: 4, telefono: '70000002', direccion: 'Villa Fátima, La Paz', email: 'maria.quispe@example.bo', fecha_registro: diasAtras(36) },
  { id_paciente: 103, id_usuario: null, codigo_anonimo: 'PAC-0003', numero_carnet: '7000003', tipo_documento: 'ci', nombre_completo: 'PEDRO LUIS MAMANI ROJAS', fecha_nacimiento: '1969-11-02', sexo: 'M', grado_artrosis_kl: 2, articulacion_principal: 'cadera', diagnostico_previo: 'Coxartrosis grado II', activo: true, id_medico_tratante: 3, id_fisioterapeuta_asignado: null, telefono: '70000003', direccion: 'El Alto', email: '', fecha_registro: diasAtras(18) },
  { id_paciente: 104, id_usuario: null, codigo_anonimo: 'PAC-0004', numero_carnet: '7000004', tipo_documento: 'ci', nombre_completo: 'ANA SOFIA VARGAS PEREZ', fecha_nacimiento: '1985-01-18', sexo: 'F', grado_artrosis_kl: 2, articulacion_principal: 'cadera', diagnostico_previo: 'Coxartrosis grado II con dolor a la rotación interna', activo: true, id_medico_tratante: 2, id_fisioterapeuta_asignado: 4, telefono: '70000004', direccion: 'Sopocachi, La Paz', email: 'ana.vargas@example.bo', fecha_registro: diasAtras(12) },
  { id_paciente: 105, id_usuario: null, codigo_anonimo: 'PAC-0005', numero_carnet: '7000005', tipo_documento: 'ci', nombre_completo: 'JOSE MIGUEL FLORES TICONA', fecha_nacimiento: '1972-05-30', sexo: 'M', grado_artrosis_kl: 3, articulacion_principal: 'cadera', diagnostico_previo: 'Coxartrosis grado III con restricción de movilidad', activo: true, id_medico_tratante: 3, id_fisioterapeuta_asignado: null, telefono: '70000005', direccion: 'Cochabamba', email: '', fecha_registro: diasAtras(40) },
  { id_paciente: 106, id_usuario: null, codigo_anonimo: 'PAC-0006', numero_carnet: '7000006', tipo_documento: 'ci', nombre_completo: 'LUCIA BEATRIZ CHOQUE MENDOZA', fecha_nacimiento: '1990-09-09', sexo: 'F', grado_artrosis_kl: 1, articulacion_principal: 'rodilla', diagnostico_previo: 'Artrosis de rodilla grado I', activo: false, id_medico_tratante: 2, id_fisioterapeuta_asignado: null, telefono: '70000006', direccion: 'Santa Cruz', email: '', fecha_registro: diasAtras(60) },
];

// --------------------------------------------------------------- CITAS
export const citas = [
  { id_cita: 901, id_paciente: 101, id_medico: 2, id_plan: 501, fecha_hora: diasAdelante(2), duracion_minutos: 45, tipo: 'control', modalidad: 'presencial', motivo: 'Control de rango articular y adherencia', lugar: 'Consultorio 3 — COSSMIL', indicaciones: 'Venir con ropa cómoda.', estado: 'programada', recordatorio_enviado: true },
  { id_cita: 902, id_paciente: 102, id_medico: 3, id_plan: 502, fecha_hora: diasAdelante(1), duracion_minutos: 45, tipo: 'reevaluacion', modalidad: 'presencial', motivo: 'Reevaluación de dolor femoropatelar', lugar: 'Consultorio 4 — COSSMIL', indicaciones: null, estado: 'confirmada', recordatorio_enviado: true },
  { id_cita: 903, id_paciente: 104, id_medico: 2, id_plan: 503, fecha_hora: diasAdelante(4), duracion_minutos: 30, tipo: 'control', modalidad: 'presencial', motivo: 'Control de marcha y ROM de cadera', lugar: 'Sala de terapia 1 — COSSMIL', indicaciones: null, estado: 'programada', recordatorio_enviado: false },
  { id_cita: 904, id_paciente: 101, id_medico: 2, id_plan: 501, fecha_hora: diasAtras(3), duracion_minutos: 45, tipo: 'control', modalidad: 'presencial', motivo: 'Control quincenal', lugar: 'Consultorio 3 — COSSMIL', indicaciones: null, estado: 'cumplida', recordatorio_enviado: true },
  { id_cita: 905, id_paciente: 102, id_medico: 3, id_plan: 502, fecha_hora: diasAtras(1), duracion_minutos: 45, tipo: 'terapia', modalidad: 'presencial', motivo: 'Sesión supervisada', lugar: 'Sala de terapia 1 — COSSMIL', indicaciones: null, estado: 'ausente', recordatorio_enviado: true },
];

// -------------------------------------------------------- NOTIFICACIONES
export const notificaciones = [
  { id_notificacion: 1, id_usuario: 4, id_paciente: 102, tipo: 'cita_incumplida', categoria: 'cita', severidad: 'aviso', titulo: 'Paciente ausente', mensaje: 'MARIA ELENA QUISPE FLORES no asistió a la sesión de ayer.', accion_ruta: '/citas', leida: false, fecha_creacion: diasAtras(1) },
  { id_notificacion: 2, id_usuario: 4, id_paciente: 101, tipo: 'tecnica_deficiente', categoria: 'clinico', severidad: 'alerta', titulo: 'Técnica deficiente', mensaje: 'JUAN CARLOS CONDORI: 63% de repeticiones correctas en la sentadilla isométrica. Revisar técnica en el próximo control.', accion_ruta: '/sesiones', leida: false, fecha_creacion: diasAtras(6) },
  { id_notificacion: 3, id_usuario: 4, id_paciente: 104, tipo: 'sesion_evaluada', categoria: 'clinico', severidad: 'info', titulo: 'Buen trabajo', mensaje: 'ANA SOFIA VARGAS completó la sesión de cadera con 100% de aciertos.', accion_ruta: '/sesiones', leida: true, fecha_creacion: diasAtras(2) },
  { id_notificacion: 4, id_usuario: 4, id_paciente: 102, tipo: 'dolor_alto', categoria: 'clinico', severidad: 'alerta', titulo: 'Dolor elevado sostenido', mensaje: 'MARIA ELENA QUISPE reporta EVA 6/10 de media en las últimas 48 h.', accion_ruta: '/pacientes', leida: false, fecha_creacion: diasAtras(3) },
];

// ---------------------------------------------------------------- USUARIOS
// Para la vista de "Usuarios y permisos" del superusuario.
const permisosMedico = {
  inicio: true, pacientes: true, ejercicios: true, rutinas: true, sesiones: true,
  evolucion: true, citas: true, notificaciones: true, reportes: true, perfil: true,
  solicitudes: false, usuarios: false, medicos: false, auditoria: false, configuracion: true,
};
const permisosFisio = { ...permisosMedico, rutinas: false, ejercicios: false, evolucion: false };

export const usuarios = [
  { id_usuario: 1, rol: 'superusuario', email: 'superadmin@fisioclin.demo', nombre_usuario: 'superadmin', medico_nombre: null, paciente_nombre: null, id_medico: null, cedula_profesional: null, pacientes_a_cargo: 0, tiene_cuenta_auth: true, activo: true, modulos_permitidos: {} },
  { id_usuario: 4, rol: 'medico_fisiatra', email: 'dr.martin@fisioclin.demo', nombre_usuario: 'dr.martin', medico_nombre: 'Dr. Alejandro Martin', paciente_nombre: null, id_medico: 2, cedula_profesional: 'MP-4821', pacientes_a_cargo: 3, tiene_cuenta_auth: true, activo: true, modulos_permitidos: { ...permisosMedico } },
  { id_usuario: 5, rol: 'medico_fisiatra', email: 'dra.rojas@fisioclin.demo', nombre_usuario: 'dra.rojas', medico_nombre: 'Dra. Daniela Rojas', paciente_nombre: null, id_medico: 3, cedula_profesional: 'MP-5307', pacientes_a_cargo: 3, tiene_cuenta_auth: true, activo: true, modulos_permitidos: { ...permisosMedico } },
  { id_usuario: 6, rol: 'fisioterapeuta', email: 'carlos.mamani@fisioclin.demo', nombre_usuario: 'carlos.mamani', medico_nombre: 'Lic. Carlos Mamani', paciente_nombre: null, id_medico: 4, cedula_profesional: 'FT-2210', pacientes_a_cargo: 0, tiene_cuenta_auth: false, activo: true, modulos_permitidos: { ...permisosFisio } },
];

// ------------------------------------------------------- SOLICITUDES DE ACCESO
export const solicitudes = [
  { id_solicitud: 1, nombre_completo: 'Dr. Luis Mendoza', email: 'l.mendoza@cossmil.mil', tipo_profesional: 'medico_fisiatra', cedula_profesional: 'MP-9931', telefono: '70012345', fecha_solicitud: diasAtras(1), estado: 'pendiente', observaciones: '', antiguedad: 'hace 1 día' },
  { id_solicitud: 2, nombre_completo: 'Lic. Andrea Rojas', email: 'a.rojas@cossmil.mil', tipo_profesional: 'fisioterapeuta', cedula_profesional: 'FT-4420', telefono: '70023456', fecha_solicitud: diasAtras(2), estado: 'pendiente', observaciones: '', antiguedad: 'hace 2 días' },
  { id_solicitud: 3, nombre_completo: 'Dr. Martín Salazar', email: 'm.salazar@cossmil.mil', tipo_profesional: 'medico_fisiatra', cedula_profesional: 'MP-3312', telefono: '70034567', fecha_solicitud: diasAtras(5), estado: 'pendiente', observaciones: '', antiguedad: 'hace 5 días' },
];

// ------------------------------------------------------------- BITÁCORA
export const bitacora = [
  { id_evento: 1, fecha: diasAtras(1), autor: 'Sistema', rol: 'superusuario', accion: 'REVISION_ALERTAS', tabla: 'notificaciones', id_registro: '—', detalle: 'Revisión automática: 2 avisos generados.' },
  { id_evento: 2, fecha: diasAtras(3), autor: 'Dra. Daniela Rojas', rol: 'medico_fisiatra', accion: 'UPDATE', tabla: 'planes_tratamiento', id_registro: '502', detalle: 'Ajuste de carga en sentadilla isométrica.' },
  { id_evento: 3, fecha: diasAtras(6), autor: 'Dr. Alejandro Martin', rol: 'medico_fisiatra', accion: 'INSERT', tabla: 'prescripciones_ejercicio', id_registro: '7003', detalle: 'Nueva prescripción para PAC-0001.' },
  { id_evento: 4, fecha: diasAtras(12), autor: 'Superusuario', rol: 'superusuario', accion: 'INSERT', tabla: 'pacientes', id_registro: '104', detalle: 'Alta de paciente ANA SOFIA VARGAS PEREZ.' },
];
