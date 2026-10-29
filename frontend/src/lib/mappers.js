// Traductores entre las filas de Supabase (esquema `fisioclin_supabase`) y las
// formas que los componentes de React ya esperan. Centralizado aquí para que un
// cambio de esquema solo toque este archivo.

import { miniaturaYoutube } from './youtube';

export const ROL_LABEL = {
  superusuario: 'Superusuario',
  medico_fisiatra: 'Médico Fisiatra',
  fisioterapeuta: 'Fisioterapeuta',
  paciente: 'Paciente',
};

// El orden es el de la barra lateral. Tienen que coincidir con las claves de
// `catalogo_modulos`/`modulos_permitidos`: si aquí aparece un módulo que la
// base no conoce, el superusuario no puede concederlo y queda siempre en falso.
//
// `configuracion` NO está: se podía conceder pero no tiene pantalla ni fase
// que la construya (FASE 7), así que se quitó. `reportes` volvió en la FASE 9
// al construirse esa pantalla. `superadmin` SÍ está: es la vista del
// superusuario y ya existe en `catalogo_modulos` (`solo_superusuario = true`),
// pero antes no estaba acá, así que su permiso nunca se evaluaba.
// `solicitudes` ya no está: esa pantalla se fusionó con "Usuarios y
// permisos" (quien ve `usuarios` ve también las solicitudes pendientes), así
// que mantener un permiso aparte para algo que ya no tiene pantalla propia
// solo iba a confundir ("¿por qué puedo tildar 'Solicitudes' si no hay
// ningún botón de Solicitudes?"). El valor puede seguir viviendo en
// `catalogo_modulos`/`modulos_permitidos` de usuarios viejos — no molesta,
// simplemente ya no se ofrece ni se evalúa desde acá.
export const MODULOS = [
  'inicio', 'superadmin', 'pacientes', 'ejercicios', 'rutinas', 'sesiones',
  'evolucion', 'evaluaciones', 'reportes', 'citas', 'notificaciones', 'perfil',
  'usuarios', 'medicos', 'auditoria',
];

export const MODULO_LABEL = {
  inicio: 'Inicio',
  superadmin: 'Centro de control',
  pacientes: 'Pacientes',
  ejercicios: 'Catálogo de ejercicios',
  rutinas: 'Prescripción de rutinas',
  sesiones: 'Sesiones',
  evolucion: 'Evolución clínica',
  evaluaciones: 'Evaluaciones (goniómetro)',
  reportes: 'Reportes',
  citas: 'Agenda de controles',
  notificaciones: 'Mensajes y avisos',
  perfil: 'Mi perfil',
  usuarios: 'Gestión de usuarios',
  medicos: 'Médicos',
  auditoria: 'Auditoría',
};

// Tipos válidos de `reportes_generados.tipo_reporte` (los mismos que exige
// `fn_registrar_reporte`).
export const TIPO_REPORTE_LABEL = {
  individual: 'Paciente',
  general: 'Resumen de la unidad',
  usuarios: 'Usuarios y accesos',
  profesionales: 'Profesionales',
  evaluaciones: 'Evaluaciones',
  adherencia: 'Adherencia',
  auditoria: 'Auditoría',
};

export const ESTADO_CITA_LABEL = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  cumplida: 'Cumplida',
  ausente: 'No asistió',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
};

// `pacientes.estado_tratamiento` (FASE 10): ya no alcanza con Activo/Inactivo
// para distinguir "se curó" de "abandonó" o "se derivó" — eso es lo que
// resuelve `altas_paciente`/`fn_dar_alta`.
export const ESTADO_TRATAMIENTO_LABEL = {
  en_tratamiento: 'En tratamiento',
  de_alta: 'De alta',
  alta_temporal: 'Alta temporal',
  suspendido: 'Suspendido',
  abandono: 'Abandono',
  derivado: 'Derivado',
};

export const TIPO_ALTA_LABEL = {
  alta_medica: 'Alta médica',
  alta_temporal: 'Alta temporal',
  alta_voluntaria: 'Alta voluntaria',
  abandono: 'Abandono',
  derivado: 'Derivado',
};

export const ESTADO_FUNCIONAL_LABEL = {
  recuperado: 'Recuperado',
  funcional: 'Funcional',
  mejoria_parcial: 'Mejoría parcial',
  sin_cambios: 'Sin cambios',
  empeoro: 'Empeoró',
};

export const fmtFechaHora = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-BO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
};

export const fmtDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
};

export const edadDesde = (fechaNacimiento) => {
  const d = new Date(fechaNacimiento);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

export const generoLabel = (sexo) => (sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : '—');

// "Diario" / "3 veces por semana" -> frecuencia_semanal (1..7)
export const frecuenciaSemanal = (freq) => {
  const f = String(freq || '').toLowerCase();
  if (f.includes('2 veces al día') || f.includes('3 veces al día')) return 7;
  if (f.includes('diario')) return 7;
  if (f.includes('por medio')) return 4;
  if (f.includes('3 veces') || f.includes('tres veces')) return 3;
  if (f.includes('2 veces') || f.includes('dos veces')) return 2;
  const n = parseInt(f, 10);
  return Number.isNaN(n) ? 3 : Math.min(7, Math.max(1, n));
};

export const frecuenciaLabel = (n) => {
  if (n >= 7) return 'Diario';
  if (n === 1) return '1 vez/semana';
  return `${n} veces/semana`;
};

export const tipoEntradaLabel = (tipo) => ({
  evolucion: 'Evolución',
  diagnostico: 'Evaluación',
  indicacion: 'Control',
  cambio_tratamiento: 'Control',
  observacion_general: 'Control',
  // FASE 10: la evaluación con goniómetro y el alta se escriben solas en el
  // historial (triggers de la base) con estos tipos — sin esto, aparecían
  // como "Control", que es justo lo contrario de lo que son.
  evaluacion_inicial: 'Evaluación inicial',
  evaluacion_final: 'Evaluación final',
  alta_medica: 'Alta médica',
  reingreso: 'Reingreso',
}[tipo] || 'Control');

// ---------------------------------------------------------------------------
// Ejercicio del catálogo  ->  forma del componente CatalogoEjercicios / drawer
// ---------------------------------------------------------------------------
export const mapEjercicio = (row) => ({
  id: row.id_ejercicio,
  codigo: row.codigo_fisioclin || null,
  name: row.nombre,
  joint: row.articulacion_objetivo,
  category: 'Movilidad',
  difficulty: 'Media',
  instructions: row.descripcion || '',
  videoUrl: row.video_referencia_url || row.video_storage_path || '',
  // Si el video es un enlace de YouTube, la miniatura sale sola (YouTube ya
  // la tiene). Si es un archivo subido, por ahora no hay miniatura propia.
  image: miniaturaYoutube(row.video_referencia_url),
  duration: row.duracion_estimada_segundos ?? 30,
  minAngle: row.angulo_min_esperado ?? 0,
  maxAngle: row.angulo_max_esperado ?? 120,
  activo: row.activo,
  // Código del movimiento para la cámara del paciente ('C01'..'R09'), o ''.
  camara: row.clase_lstm || '',
});

// ---------------------------------------------------------------------------
// Médico  ->  tarjeta de SuperadminViews / selectores
// ---------------------------------------------------------------------------
export const mapMedico = (row) => ({
  id_medico: row.id_medico,
  id_usuario: row.id_usuario,
  name: row.nombre_completo,
  nombre_completo: row.nombre_completo,
  tipo_profesional: row.tipo_profesional,
  especialidad: row.especialidad,
  cedula_profesional: row.cedula_profesional,
  telefono: row.telefono || '',
  email: row.usuarios?.email || '',
  unidad: row.unidad || '',
  activo: row.usuarios?.activo ?? true,
});

// ---------------------------------------------------------------------------
// Paciente: fila base + datos relacionados  ->  objeto "patient" del panel
// ---------------------------------------------------------------------------
export const mapPacienteBase = (p) => ({
  id: p.codigo_anonimo || `PAC-${String(p.id_paciente).padStart(4, '0')}`,
  db_id: p.id_paciente,
  id_usuario: p.id_usuario,
  name: p.nombre_completo,
  age: edadDesde(p.fecha_nacimiento) ?? '—',
  gender: generoLabel(p.sexo),
  ci: p.numero_carnet || '—',
  phone: p.telefono || '',
  email: p.email || '',
  // Resto de la ficha de `pacientes` (antes se descartaban aunque la consulta
  // los traía): sin esto ni el formulario de edición ni otras pantallas los ven.
  nombres: p.nombres || '',
  apellidoPaterno: p.apellido_paterno || '',
  apellidoMaterno: p.apellido_materno || '',
  birthDate: fmtDate(p.fecha_nacimiento),
  tipoDocumento: p.tipo_documento || 'ci',
  ciExpedido: p.ci_expedido || '',
  ciComplemento: p.ci_complemento || '',
  address: p.direccion || '',
  emergencyContactName: p.contacto_emergencia_nombre || '',
  emergencyContactPhone: p.contacto_emergencia_telefono || '',
  dentroDelEstudio: p.dentro_del_estudio ?? null,
  origenRegistro: p.origen_registro || 'manual',
  idMedicoRegistrador: p.id_medico_registrador ?? null,
  diagnosis: p.diagnostico_previo || 'Rehabilitación física',
  articulacion: p.articulacion_principal,
  gradoArtrosis: p.grado_artrosis_kl,
  status: p.activo ? 'Activo' : 'Inactivo',
  // Distinto de `status`: ese es el interruptor manual Activo/Inactivo; esto
  // es el punto del recorrido clínico (FASE 10) — lo pone `fn_dar_alta`/
  // `fn_reabrir_tratamiento`, no el superusuario a mano.
  estadoTratamiento: p.estado_tratamiento || 'en_tratamiento',
  admissionDate: fmtDate(p.fecha_registro) || fmtDate(p.creado_en),
  idMedicoTratante: p.id_medico_tratante,
  idFisioterapeuta: p.id_fisioterapeuta_asignado,
  // se rellenan en el detalle
  sessionsCompleted: 0,
  sessionsTotal: 0,
  complianceRate: 100,
  painLevelInitial: 0,
  painLevelCurrent: 0,
  romInitial: '—',
  romCurrent: '—',
  history: [],
  routine: null,
  sessions: [],
  evolutionData: [],
  medicamentos: [],
  historiaGeneral: null,
});

// Si `tipo_entrada` no trae un valor reconocido para reingreso/alta (porque
// el trigger de la base usa otro nombre, o porque todavía no se verificó
// contra la base real), se reconoce igual por lo que el propio trigger
// escribe en el texto — así la fila no se pierde en el cajón genérico
// "Control" solo por no adivinar bien el nombre exacto de la columna.
const tipoPorContenido = (contenido) => {
  const texto = (contenido || '').toLowerCase();
  if (/reingres/.test(texto)) return 'Reingreso';
  if (/dado de alta|alta m[eé]dica|alta temporal|alta voluntaria/.test(texto)) return 'Alta médica';
  return null;
};

export const mapHistorial = (h) => {
  const tipo = tipoEntradaLabel(h.tipo_entrada);
  return {
    id: h.id_historial,
    date: fmtDate(h.fecha_registro),
    note: h.contenido,
    type: tipo === 'Control' ? (tipoPorContenido(h.contenido) || tipo) : tipo,
    title: h.titulo,
  };
};

// ---------------------------------------------------------------------------
// Receta de medicamento  ->  pestaña "Medicamentos" de la ficha del paciente
// ---------------------------------------------------------------------------
export const mapReceta = (r) => ({
  id: r.id_receta,
  nombre: r.nombre_medicamento,
  dosis: r.dosis,
  frecuencia: r.frecuencia,
  fechaInicio: fmtDate(r.fecha_inicio),
  fechaFin: fmtDate(r.fecha_fin),
  indicaciones: r.indicaciones || '',
  activa: r.activa,
});

// ---------------------------------------------------------------------------
// Historia clínica general  ->  ficha de ingreso (formato papel) del paciente
// ---------------------------------------------------------------------------
export const mapHistoriaGeneral = (h) => ({
  id: h.id_historia_general,
  informante: h.anamnesis_informante,
  confiable: h.anamnesis_confiable,
  motivoConsulta: h.motivo_consulta || '',
  enfermedadActual: h.enfermedad_actual || '',
  antecedentesPatologicos: h.antecedentes_patologicos || '',
  tratamientoActual: h.tratamiento_actual || '',
  habitos: h.habitos || '',
  habitosHigienicos: h.habitos_higienicos || '',
  examenFisico: h.examen_fisico || '',
  actualizadoEn: h.actualizado_en,
});

export const mapSesion = (s, profesionalNombre) => ({
  id: s.id_sesion,
  date: fmtDate(s.fecha_hora),
  time: fmtTime(s.fecha_hora) || '08:30',
  // Sesiones con cámara (app del paciente): 'incompleta' = tocó Finalizar
  // antes de hacer todas las repeticiones; 'abandonada' = salió sin terminar.
  status: s.completado ? 'Completada'
    : s.estado === 'incompleta' ? 'Incompleta'
      : s.estado === 'abandonada' ? 'Abandonada'
        : 'Programada',
  estado: s.estado,
  resultado: s.resultado_evaluacion,
  notes: s.observaciones || '',
  ejercicio: s.ejercicio,
  professional: profesionalNombre || 'Equipo COSSMIL',
});

export const mapPrescripcionAEjercicio = (pe) => ({
  id: pe.id_ejercicio,
  id_prescripcion: pe.id_prescripcion,
  name: pe.ejercicios_catalogo?.nombre || `Ejercicio ${pe.id_ejercicio}`,
  series: pe.series ?? 3,
  reps: String(pe.repeticiones ?? 10),
  freq: frecuenciaLabel(pe.frecuencia_semanal ?? 3),
  instructions: pe.observaciones || pe.ejercicios_catalogo?.descripcion || '',
});

export const mapPlanARoutine = (plan, prescripciones) => {
  if (!plan) return null;
  return {
    id_plan: plan.id_plan,
    name: plan.objetivo_general || 'Plan terapéutico',
    duration: (plan.duracion_estimada_semanas || 2) * 7,
    weeks: plan.duracion_estimada_semanas,
    startDate: fmtDate(plan.fecha_inicio),
    endDate: fmtDate(plan.fecha_fin_estimada),
    instructions: plan.observaciones || '',
    estado: plan.estado,
    exercises: (prescripciones || []).map(mapPrescripcionAEjercicio),
  };
};

// ---------------------------------------------------------------------------
// Evaluación con goniómetro  ->  fila de `evaluaciones_goniometro`
// ---------------------------------------------------------------------------
export const mapEvaluacion = (e) => ({
  id: e.id_evaluacion,
  idPaciente: e.id_paciente,
  idPlan: e.id_plan,
  momento: e.momento,
  fecha: fmtDate(e.fecha),
  articulacion: e.articulacion,
  lado: e.lado,
  anguloMinimo: e.angulo_minimo,
  anguloMaximo: e.angulo_maximo,
  romGoniometro: e.rom_goniometro,
  anguloApp: e.angulo_app,
  idSesionReferencia: e.id_sesion_referencia,
  umbralClinico: e.umbral_clinico_grados,
  errorAbsoluto: e.error_absoluto,
  dentroUmbral: e.dentro_umbral,
  dolorEva: e.dolor_eva,
  instrumento: e.instrumento,
  posicionPaciente: e.posicion_paciente,
  observaciones: e.observaciones,
  idMedicoEvaluador: e.id_medico_evaluador,
});

// `vista_evaluacion_pre_post`: par inicial/final para un paciente y articulación.
export const mapEvaluacionPrePost = (v) => ({
  idPaciente: v.id_paciente,
  codigoAnonimo: v.codigo_anonimo,
  nombreCompleto: v.nombre_completo,
  gradoArtrosis: v.grado_artrosis_kl,
  articulacion: v.articulacion,
  lado: v.lado,
  fechaInicial: fmtDate(v.fecha_inicial),
  romInicial: v.rom_inicial,
  dolorInicial: v.dolor_inicial,
  fechaFinal: fmtDate(v.fecha_final),
  romFinal: v.rom_final,
  dolorFinal: v.dolor_final,
  gananciaRom: v.ganancia_rom,
  gananciaRomPorcentaje: v.ganancia_rom_porcentaje,
  reduccionDolor: v.reduccion_dolor,
  diasTratamiento: v.dias_de_tratamiento,
  sesionesRealizadas: v.sesiones_realizadas,
});


// ---------------------------------------------------------------------------
// Reportes en PDF (FASE 9): cada vista ya trae exactamente lo que le toca ver
// a quien pregunta (administrador: toda la unidad; profesional: lo suyo) —
// `security_invoker` (PASO 24) lo resuelve la base, acá solo se traduce.
// ---------------------------------------------------------------------------
export const mapReporteResumen = (r) => ({
  pacientesTotal: r.pacientes_total,
  pacientesActivos: r.pacientes_activos,
  enTratamiento: r.en_tratamiento,
  dadosDeAlta: r.dados_de_alta,
  abandonos: r.abandonos,
  klGrado2: r.kl_grado_2,
  klGrado3: r.kl_grado_3,
  profesionales: r.profesionales,
  planesActivos: r.planes_activos,
  ejerciciosEnCatalogo: r.ejercicios_en_catalogo,
  ejerciciosConVideo: r.ejercicios_con_video,
  sesionesTotal: r.sesiones_total,
  sesionesCompletadas: r.sesiones_completadas,
  sesionesUltimoMes: r.sesiones_ultimo_mes,
  repeticionesTotal: r.repeticiones_total,
  citasCumplidas: r.citas_cumplidas,
  citasConAusencia: r.citas_con_ausencia,
  evaluacionesTotal: r.evaluaciones_total,
  evaluacionesIniciales: r.evaluaciones_iniciales,
  evaluacionesFinales: r.evaluaciones_finales,
  gananciaRomPromedio: r.ganancia_rom_promedio,
  reduccionDolorPromedio: r.reduccion_dolor_promedio,
  errorCamaraPromedio: r.error_camara_promedio,
  acuerdoCamaraPorcentaje: r.acuerdo_camara_porcentaje,
});

// `vista_reporte_paciente`: la única de las seis que SÍ lleva nombre y CI —
// va a la historia clínica de un paciente puntual, no al anexo de la tesis.
export const mapReportePaciente = (r) => ({
  idPaciente: r.id_paciente,
  codigoAnonimo: r.codigo_anonimo,
  nombreCompleto: r.nombre_completo,
  edad: r.edad,
  sexo: generoLabel(r.sexo),
  gradoArtrosis: r.grado_artrosis_kl,
  articulacionPrincipal: r.articulacion_principal,
  diagnosticoPrevio: r.diagnostico_previo,
  fechaRegistro: fmtDate(r.fecha_registro),
  medicoTratante: r.medico_tratante,
  fisioterapeuta: r.fisioterapeuta,
  sesionesCompletadas: r.sesiones_completadas,
  citasCumplidas: r.citas_cumplidas,
  citasAusentes: r.citas_ausentes,
  dolorUltimoMes: r.dolor_ultimo_mes,
  mejorRomCamara: r.mejor_rom_camara,
  romInicial: r.rom_inicial,
  romFinal: r.rom_final,
  gananciaRom: r.ganancia_rom,
  dolorInicial: r.dolor_inicial,
  dolorFinal: r.dolor_final,
  reduccionDolor: r.reduccion_dolor,
  diasDeTratamiento: r.dias_de_tratamiento,
  objetivoGeneral: r.objetivo_general,
  fechaInicioPlan: fmtDate(r.fecha_inicio),
  duracionEstimadaSemanas: r.duracion_estimada_semanas,
  estadoPlan: r.estado_plan,
});

// `vista_reporte_evaluaciones`: la tabla del anexo de la tesis. A propósito
// NO se traduce `nombre_completo` del paciente: solo `codigo_anonimo` sale de
// acá, tal como pide el comité de ética.
export const mapReporteEvaluacionFila = (r) => ({
  idEvaluacion: r.id_evaluacion,
  codigoAnonimo: r.codigo_anonimo,
  edad: r.edad,
  sexo: generoLabel(r.sexo),
  gradoArtrosis: r.grado_artrosis_kl,
  momento: r.momento,
  fecha: fmtDate(r.fecha),
  articulacion: r.articulacion,
  lado: r.lado,
  anguloMinimo: r.angulo_minimo,
  anguloMaximo: r.angulo_maximo,
  romGoniometro: r.rom_goniometro,
  anguloApp: r.angulo_app,
  errorAbsoluto: r.error_absoluto,
  dentroUmbral: r.dentro_umbral,
  umbralClinico: r.umbral_clinico_grados,
  dolorEva: r.dolor_eva,
  instrumento: r.instrumento,
  posicionPaciente: r.posicion_paciente,
  evaluador: r.evaluador,
  observaciones: r.observaciones,
});

export const mapReporteAdherencia = (r) => {
  const porcentaje = r.sesiones_esperadas_hasta_hoy
    ? Math.min(100, Math.round((r.sesiones_realizadas / r.sesiones_esperadas_hasta_hoy) * 100))
    : null;
  return {
    idPaciente: r.id_paciente,
    codigoAnonimo: r.codigo_anonimo,
    nombreCompleto: r.nombre_completo,
    estadoTratamiento: r.estado_tratamiento,
    medicoTratante: r.medico_tratante,
    objetivoGeneral: r.objetivo_general,
    fechaInicio: fmtDate(r.fecha_inicio),
    duracionEstimadaSemanas: r.duracion_estimada_semanas,
    estadoPlan: r.estado_plan,
    ejerciciosPrescritos: r.ejercicios_prescritos,
    sesionesEsperadasPorSemana: r.sesiones_esperadas_por_semana,
    sesionesEsperadasHastaHoy: r.sesiones_esperadas_hasta_hoy,
    sesionesRealizadas: r.sesiones_realizadas,
    sesionesCorrectas: r.sesiones_correctas,
    ultimaSesion: fmtDate(r.ultima_sesion),
    citasPerdidas: r.citas_perdidas,
    adherenciaPorcentaje: porcentaje,
  };
};

export const mapReporteProfesional = (r) => ({
  idMedico: r.id_medico,
  nombreCompleto: r.nombre_completo,
  tipoProfesional: r.tipo_profesional,
  especialidad: r.especialidad,
  cedulaProfesional: r.cedula_profesional,
  consultorio: r.consultorio,
  horarioAtencion: r.horario_atencion,
  email: r.email,
  activo: r.activo,
  ultimoAcceso: r.ultimo_acceso,
  pacientesTotal: r.pacientes_total,
  pacientesActivos: r.pacientes_activos,
  pacientesComoFisio: r.pacientes_como_fisio,
  planesActivos: r.planes_activos,
  prescripcionesActivas: r.prescripciones_activas,
  sesionesSupervisadas: r.sesiones_supervisadas,
  evaluacionesHechas: r.evaluaciones_hechas,
  altasDadas: r.altas_dadas,
  notasClinicas: r.notas_clinicas,
  citasCumplidas: r.citas_cumplidas,
  citasConAusencia: r.citas_con_ausencia,
  citasPorVenir: r.citas_por_venir,
});

export const mapReporteUsuario = (r) => ({
  idUsuario: r.id_usuario,
  nombreUsuario: r.nombre_usuario,
  email: r.email,
  rol: ROL_LABEL[r.rol] || r.rol,
  activo: r.activo,
  tieneCuentaDeAcceso: r.tiene_cuenta_de_acceso,
  debeCambiarPassword: r.debe_cambiar_password,
  ultimoAcceso: r.ultimo_acceso,
  actividad: r.actividad,
  fechaDeAlta: fmtDate(r.fecha_de_alta),
  idMedico: r.id_medico,
  nombreProfesional: r.nombre_profesional,
  tipoProfesional: r.tipo_profesional,
  cedulaProfesional: r.cedula_profesional,
  especialidad: r.especialidad,
  codigoPaciente: r.codigo_paciente,
  modulosConcedidos: r.modulos_concedidos,
  pacientesACargo: r.pacientes_a_cargo,
});

// ---------------------------------------------------------------------------
// Alta del paciente (FASE 10): `vista_altas` ya trae el antes/después
// calculado (`vista_evaluacion_pre_post`) y `control_vencido` — los pacientes
// a los que hay que llamar.
// ---------------------------------------------------------------------------
export const mapAlta = (a) => ({
  id: a.id_alta,
  idPaciente: a.id_paciente,
  codigoAnonimo: a.codigo_anonimo,
  nombreCompleto: a.nombre_completo,
  articulacionPrincipal: a.articulacion_principal,
  gradoArtrosis: a.grado_artrosis_kl,
  estadoTratamiento: a.estado_tratamiento,
  fechaAlta: fmtDate(a.fecha_alta),
  tipoAlta: a.tipo_alta,
  estadoFuncional: a.estado_funcional,
  cumplioObjetivos: a.cumplio_objetivos,
  romAlcanzado: a.rom_alcanzado,
  dolorFinal: a.dolor_final,
  motivo: a.motivo,
  recomendaciones: a.recomendaciones,
  requiereControl: a.requiere_control,
  fechaControlSugerida: fmtDate(a.fecha_control_sugerida),
  controlVencido: a.control_vencido,
  medicoAlta: a.medico_alta,
  romInicial: a.rom_inicial,
  romFinal: a.rom_final,
  gananciaRom: a.ganancia_rom,
  reduccionDolor: a.reduccion_dolor,
  diasDeTratamiento: a.dias_de_tratamiento,
  sesionesRealizadas: a.sesiones_realizadas,
});
