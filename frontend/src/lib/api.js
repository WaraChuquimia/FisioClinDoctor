// =============================================================================
// Capa de datos CONECTADA a Supabase.
// -----------------------------------------------------------------------------
// CÓMO ACTIVARLA:
//   1. npm install @supabase/supabase-js
//   2. crear el archivo .env  (copia .env.example)
//   3. renombrar:  api.js -> api.demo.js   y   api.supabase.js -> api.js
//
// Tiene EXACTAMENTE las mismas funciones que la versión falsa, con los mismos
// nombres y los mismos parámetros, así que ningún componente cambia.
//
// -----------------------------------------------------------------------------
// LO QUE NO SE VE PERO ES LO MÁS IMPORTANTE
//
// Aquí no hay ni un solo "if (soy superusuario)". No hace falta: las consultas
// se mandan tal cual y la BASE decide qué devuelve. El Dr. Martin pide
// `select * from pacientes` y le llegan 3; el superusuario manda la MISMA
// consulta y le llegan 6. Eso son las políticas RLS.
//
// Por eso esconder un botón nunca fue la seguridad: la seguridad es que la
// base no entrega lo que no te toca.
// =============================================================================
import {
  mapPacienteBase, mapHistorial, mapSesion, mapEjercicio, mapMedico,
  mapPlanARoutine, fmtDate, frecuenciaSemanal,
  mapEvaluacion, mapEvaluacionPrePost,
  mapReporteResumen, mapReportePaciente, mapReporteEvaluacionFila,
  mapReporteAdherencia, mapReporteProfesional, mapReporteUsuario,
  mapAlta, mapReceta, mapHistoriaGeneral,
} from './mappers';
import { exigirConexion, anonKey } from './supabase';
import { MAX_VIDEO_MB } from './limites';

// -----------------------------------------------------------------------------
// Ayudantes
// -----------------------------------------------------------------------------
const sb = () => exigirConexion();

// Errores crudos de Postgres que se traducen a algo que un médico entienda.
// El técnico no se pierde: siempre queda en console.error para depurar.
const MENSAJES_ERROR_BD = [
  { patron: /row-level security policy/i,
    mensaje: 'Tu usuario no tiene permiso para esta acción. Revisa con el administrador que tengas ficha de profesional activa.' },
  { patron: /duplicate key.*numero_carnet/i,
    mensaje: 'Ya existe un paciente con ese carné.' },
  { patron: /violates foreign key/i,
    mensaje: 'El médico o fisioterapeuta elegido ya no existe.' },
];

// Toda consulta pasa por aquí: si Supabase devuelve error, se convierte en una
// excepción con un mensaje legible (los componentes ya muestran err.message).
function ok({ data, error }, queHacia) {
  if (error) {
    const detalle = error.message || error.hint || 'error desconocido';
    console.error(`${queHacia}:`, error);
    const traducido = MENSAJES_ERROR_BD.find((m) => m.patron.test(detalle));
    throw new Error(traducido ? traducido.mensaje : `${queHacia}: ${detalle}`);
  }
  return data;
}

const agrupar = (filas, clave) => {
  const mapa = new Map();
  for (const f of filas || []) {
    if (!mapa.has(f[clave])) mapa.set(f[clave], []);
    mapa.get(f[clave]).push(f);
  }
  return mapa;
};

const rom = (fila) => (fila?.rom_promedio != null ? `${Math.round(fila.rom_promedio)}°` : '—');

const limpiarNombreArchivo = (nombre) =>
  String(nombre || 'archivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);

// =============================================================================
// SESIÓN Y PERFIL
// =============================================================================
export async function actualizarPerfilMedico(datos) {
  // La base solo deja tocar la ficha propia (política fc_medicos_propio_update).
  // `tipo_profesional` y `cedula_profesional` no se mandan a propósito: de esos
  // depende quién puede firmar qué, y los cambia el superusuario.
  const { data: sesion } = await sb().from('vista_sesion_actual').select('id_medico').maybeSingle();
  if (!sesion?.id_medico) throw new Error('Tu usuario no tiene ficha de profesional.');

  const r = await sb().from('medicos')
    .update({
      nombre_completo: datos.nombre_completo,
      especialidad: datos.especialidad,
      telefono: datos.telefono,
      unidad: datos.unidad,
      biografia: datos.biografia,
      consultorio: datos.consultorio,
      horario_atencion: datos.horario_atencion,
    })
    .eq('id_medico', sesion.id_medico)
    .select()
    .single();
  return ok(r, 'No se pudo guardar tu perfil');
}

// El superusuario no tiene ficha en `medicos` (no atiende pacientes), así que
// su nombre para mostrar vive directo en `usuarios.nombre_completo`. Esta es
// la única parte de "Mi perfil" que le aplica a él.
export async function actualizarNombreUsuario(nombre) {
  const r = await sb().rpc('fn_actualizar_nombre_usuario', { p_nombre: nombre });
  return ok(r, 'No se pudo guardar tu nombre');
}

export async function subirAvatar(idUsuario, archivo) {
  const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
  const ruta = `perfiles/${idUsuario}-${Date.now()}.${ext}`;

  const sub = await sb().storage.from('avatares')
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  ok(sub, 'No se pudo subir la foto');

  const r = await sb().from('fotos_perfil').upsert({
    id_usuario: idUsuario,
    bucket: 'avatares',
    storage_path: ruta,
    mime_type: archivo.type,
    tamano_bytes: archivo.size,
    origen: 'galeria',
  }, { onConflict: 'id_usuario' });
  ok(r, 'No se pudo guardar la foto en tu ficha');

  // La foto ya quedó subida y registrada: si el enlace para VERLA falla (un
  // corte de red justo ahora), eso no debería borrar la subida. El llamador
  // decide cómo avisarlo si `url` vuelve vacío.
  return { storage_path: ruta, url: await urlFirmadaSuave('avatares', ruta) };
}

// Vuelve a las iniciales: borra el archivo del depósito y la fila que lo
// apunta. No es un error si ya no había foto (queda como si nunca hubiera
// existido); el `remove` de un archivo que no está no falla en Supabase.
export async function quitarAvatar(idUsuario, bucket, ruta) {
  if (ruta) await sb().storage.from(bucket || 'avatares').remove([ruta]);
  const r = await sb().from('fotos_perfil').delete().eq('id_usuario', idUsuario);
  ok(r, 'No se pudo quitar la foto de perfil');
  return { ok: true };
}

// Los depósitos son privados: un archivo solo se ve con un enlace temporal.
// A propósito NO se traga el error: antes devolvía `null` sin decir por qué,
// y quien llamaba no tenía forma de distinguir "no hay archivo" de "Supabase
// falló". Quien pida un enlace y no le importe el motivo (una miniatura, un
// avatar) lo atrapa con try/catch; quien SÍ tenga que mostrarlo (el visor de
// adjuntos) deja que suba y lo muestra tal cual.
export async function urlFirmada(bucket = 'avatares', ruta, segundos = 3600) {
  if (!ruta) return null;
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(ruta, segundos);
  if (error) throw new Error(error.message || 'No se pudo generar el enlace del archivo.');
  return data?.signedUrl || null;
}

// Para pantallas que ya tienen su propio "no hay nada que mostrar" (el avatar
// cae a las iniciales, el video queda en su estado sin_video/error) y no
// tienen por qué romperse porque falló, esta vez, pedir el enlace.
async function urlFirmadaSuave(bucket, ruta, segundos) {
  try {
    return await urlFirmada(bucket, ruta, segundos);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Subir un archivo mostrando avance real (%, MB subidos, tiempo estimado) y
// poder cancelarlo a mitad de camino.
//
// El `.upload()` normal de supabase-js manda el archivo con `fetch` y `fetch`
// no avisa cuánto lleva subido hasta que termina — por eso hoy solo hay una
// rueda girando. La única forma de escuchar el avance de verdad en el
// navegador es con `XMLHttpRequest` y su evento `progress`, así que en vez
// de `.upload()` se pide un enlace de subida firmado (`createSignedUploadUrl`)
// y se sube a mano contra ese enlace.
// -----------------------------------------------------------------------------
function subirConProgreso(signedUrl, archivo, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('content-type', archivo.type || 'application/octet-stream');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        // Supabase explica el motivo en el cuerpo ("mime type not supported",
        // "exceeded the maximum allowed size"...): sin esto solo se ve un 400.
        let motivo = '';
        try {
          const cuerpo = JSON.parse(xhr.responseText);
          motivo = cuerpo.message || cuerpo.error || '';
        } catch {
          motivo = xhr.responseText || '';
        }
        reject(new Error(`El depósito rechazó el archivo (código ${xhr.status}${motivo ? `: ${motivo}` : ''}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión mientras se subía el archivo.'));
    xhr.ontimeout = () => reject(new Error('La subida tardó demasiado y se cortó sola.'));
    xhr.onabort = () => {
      const err = new Error('Subida cancelada.');
      err.cancelado = true;
      reject(err);
    };

    if (signal) {
      if (signal.aborted) { xhr.abort(); return; }
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(archivo);
  });
}

// Pide el enlace de subida firmado y sube el archivo con avance real. El
// permiso para subir justo A ESA ruta va codificado en el propio enlace (el
// `token` que agrega `createSignedUploadUrl`); la cabecera `apikey` hay que
// ponerla a mano porque este pedido no pasa por el cliente de Supabase, que
// es quien la agrega siempre.
async function subirAlDeposito(bucket, ruta, archivo, opciones) {
  const { data: firmado, error } = await sb().storage.from(bucket).createSignedUploadUrl(ruta);
  if (error) throw new Error(error.message || 'No se pudo preparar la subida.');
  await subirConProgreso(firmado.signedUrl, archivo, opciones);
  return ruta;
}

export async function cargarPreferencias() {
  const { data: s } = await sb().from('vista_sesion_actual').select('id_usuario').maybeSingle();
  if (!s?.id_usuario) return {};
  const r = await sb().from('preferencias_usuario')
    .select('*').eq('id_usuario', s.id_usuario).maybeSingle();
  return ok(r, 'No se pudieron cargar tus preferencias') || {};
}

export async function guardarPreferencias(datos) {
  const { data: s } = await sb().from('vista_sesion_actual').select('id_usuario').maybeSingle();
  if (!s?.id_usuario) throw new Error('No hay sesión activa.');

  const r = await sb().from('preferencias_usuario')
    .upsert({ id_usuario: s.id_usuario, ...datos }, { onConflict: 'id_usuario' })
    .select().single();
  return ok(r, 'No se pudieron guardar tus preferencias');
}

// =============================================================================
// PACIENTES
// -----------------------------------------------------------------------------
// Una sola función arma la ficha completa de todos los pacientes visibles.
// Son 8 consultas en paralelo y el cruce se hace aquí, no en la base: traer
// 8 listas planas y juntarlas es más rápido que 8 consultas anidadas por
// paciente.
// =============================================================================
// -----------------------------------------------------------------------------
// TIEMPO REAL: avisa cuando cambia algo en las tablas indicadas (insertar,
// editar o borrar), para que la pantalla se vuelva a cargar sola. Devuelve la
// función para dejar de escuchar. RLS se sigue aplicando: solo llegan avisos
// de filas que esta sesión puede ver. Cada tabla tiene que estar en la
// publicación `supabase_realtime` (ver backend/sql/10_tiempo_real.sql).
// -----------------------------------------------------------------------------
export function suscribirCambios(tablas, onCambio, onEstado) {
  const canal = sb().channel(`cambios-${Date.now()}`);
  tablas.forEach((tabla) => {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) => onCambio(tabla, payload));
  });
  canal.subscribe((estado) => onEstado?.(estado));
  return () => { sb().removeChannel(canal); };
}

export async function cargarPacientes(onPartialError) {
  const c = sb();

  const pacientes = ok(
    await c.from('pacientes').select('*').order('nombre_completo'),
    'Pacientes',
  );
  const consultas = [
    ['Sesiones', c.from('vista_sesiones_detalle').select('*').order('fecha_hora', { ascending: false })
      .then((r) => ok(r, 'Sesiones'))],
    ['Progreso', c.from('vista_progreso_semanal').select('*').order('semana')
      .then((r) => ok(r, 'Progreso'))],
    ['Historial', c.from('historial_clinico').select('*').order('fecha_registro', { ascending: false })
      .then((r) => ok(r, 'Historial'))],
    ['Dolor', c.from('registro_dolor').select('*').order('fecha_registro')
      .then((r) => ok(r, 'Dolor'))],
    ['Planes', c.from('planes_tratamiento').select('*').order('fecha_inicio', { ascending: false })
      .then((r) => ok(r, 'Planes'))],
    ['Prescripciones', c.from('prescripciones_ejercicio')
      .select('*, ejercicios_catalogo(id_ejercicio, nombre, descripcion, articulacion_objetivo)')
      .eq('activo', true).then((r) => ok(r, 'Prescripciones'))],
    ['Adjuntos', c.from('adjuntos_clinicos').select('*, medicos(nombre_completo)')
      .order('creado_en', { ascending: false }).then((r) => ok(r, 'Adjuntos'))],
    ['Evaluaciones', c.from('evaluaciones_goniometro').select('*').order('fecha')
      .then((r) => ok(r, 'Evaluaciones'))],
    ['Comparación antes/después', c.from('vista_evaluacion_pre_post').select('*')
      .then((r) => ok(r, 'Comparación antes/después'))],
    ['Altas', c.from('vista_altas').select('*').order('fecha_alta', { ascending: false })
      .then((r) => ok(r, 'Altas'))],
    ['Recetas de medicamentos', c.from('recetas_medicamentos').select('*')
      .order('creado_en', { ascending: false }).then((r) => ok(r, 'Recetas de medicamentos'))],
    ['Historia clínica general', c.from('historia_clinica_general').select('*')
      .then((r) => ok(r, 'Historia clínica general'))],
  ];
  const resultados = await Promise.allSettled(consultas.map(([, consulta]) => consulta));
  const fallos = [];
  const datosRelacionados = resultados.map((resultado, indice) => {
    if (resultado.status === 'fulfilled') return resultado.value;
    fallos.push(consultas[indice][0]);
    return [];
  });
  if (fallos.length) {
    onPartialError?.(`No se cargaron datos complementarios de pacientes: ${fallos.join(', ')}.`);
  }

  const [
    sesiones, progreso, historial, dolor, planes, prescripciones, adjuntos,
    evaluaciones, evaluacionesPrePost, altas, recetas, historiasGenerales,
  ] = datosRelacionados;

  const porSesion = agrupar(sesiones, 'id_paciente');
  const porProgreso = agrupar(progreso, 'id_paciente');
  const porHistorial = agrupar(historial, 'id_paciente');
  const porDolor = agrupar(dolor, 'id_paciente');
  const porPlan = agrupar(planes, 'id_paciente');
  const porPresc = agrupar(prescripciones, 'id_paciente');
  const porAdjuntoHist = agrupar(adjuntos, 'id_historial');
  const porEvaluacion = agrupar(evaluaciones, 'id_paciente');
  const porPrePost = agrupar(evaluacionesPrePost, 'id_paciente');
  const porAltas = agrupar(altas, 'id_paciente');
  const porReceta = agrupar(recetas, 'id_paciente');
  const porHistoriaGeneral = new Map((historiasGenerales || []).map((h) => [h.id_paciente, h]));

  return pacientes.map((p) => {
    const id = p.id_paciente;
    const misSes = porSesion.get(id) || [];
    const misDol = porDolor.get(id) || [];
    const misPres = porPresc.get(id) || [];
    const semanas = porProgreso.get(id) || [];
    const planAct = (porPlan.get(id) || []).find((x) => x.estado === 'activo')
      || (porPlan.get(id) || [])[0] || null;

    const completadas = misSes.filter((s) => s.completado).length;
    const compliance = misSes.length
      ? Math.round(misSes.reduce((a, s) => a + Number(s.porcentaje_correctas ?? 90), 0) / misSes.length)
      : 100;
    const totalPrevisto = Math.max(
      misSes.length,
      (misPres.length || 1) * (planAct?.duracion_estimada_semanas || 4),
      4,
    );

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
      avatarPath: p.foto_rostro_path || null,

      history: (porHistorial.get(id) || []).map((h) => ({
        ...mapHistorial(h),
        id_historial: h.id_historial,
        files: (porAdjuntoHist.get(h.id_historial) || []).map((a) => ({
          id: a.id_adjunto,
          name: a.nombre_visible || a.nombre_original,
          nombreOriginal: a.nombre_original,
          nombreVisible: a.nombre_visible,
          type: a.mime_type,
          bucket: a.bucket,
          path: a.storage_path,
          size: a.tamano_bytes,
          tipoEstudio: a.tipo_estudio,
          creadoEn: a.creado_en,
          subidoPor: a.medicos?.nombre_completo || null,
        })),
      })),

      sessions: misSes.map((s) => ({
        ...mapSesion(s, s.supervisor),
        repeticiones: Number(s.repeticiones_totales || 0),
        repeticionesCorrectas: Number(s.repeticiones_correctas || 0),
        porcentajeCorrectas: s.porcentaje_correctas == null ? null : Number(s.porcentaje_correctas),
        anguloPromedio: s.angulo_promedio,
        romMaximo: s.rom_maximo,
        anguloGoniometro: s.angulo_goniometro,
        validadoOk: s.validado_ok,
        dolorAntes: s.dolor_antes,
        dolorDespues: s.dolor_despues,
        videoPath: s.video_storage_path,
        fechaHora: s.fecha_hora,   // cruda (ISO): para agrupar por mes
      })),

      routine: planAct
        ? {
            ...mapPlanARoutine(planAct, []),
            exercises: misPres
              .filter((x) => x.id_plan === planAct.id_plan)
              .map((x) => {
                const ej = x.ejercicios_catalogo || {};
                const realizadas = misSes.filter((s) => s.id_prescripcion === x.id_prescripcion).length;
                const esperadas = (x.frecuencia_semanal || 3) * (planAct.duracion_estimada_semanas || 4);
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
                  realizadas,
                  esperadas,
                  adherencia: esperadas ? Math.min(100, Math.round((realizadas / esperadas) * 100)) : 0,
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

      // Goniómetro: mediciones crudas (para saber si ya hay inicial/final de
      // cada articulación) y la comparación ya calculada por la base.
      evaluaciones: (porEvaluacion.get(id) || []).map(mapEvaluacion),
      evaluacionesPrePost: (porPrePost.get(id) || []).map(mapEvaluacionPrePost),

      // Altas (FASE 10): la más reciente primero (`vista_altas` ya viene
      // ordenada por fecha_alta desc). Vacío mientras el paciente sigue en
      // tratamiento.
      altas: (porAltas.get(id) || []).map((a) => ({ ...mapAlta(a), fechaAltaIso: a.fecha_alta })),

      medicamentos: (porReceta.get(id) || []).map(mapReceta),

      historiaGeneral: porHistoriaGeneral.has(id) ? mapHistoriaGeneral(porHistoriaGeneral.get(id)) : null,
    };
  });
}

// Lista de profesionales activos para el selector "¿de qué médico es este
// paciente?". Es la que llena el desplegable del modal de alta.
export async function cargarProfesionales() {
  const r = await sb().from('vista_profesionales').select('*');
  const filas = ok(r, 'No se pudieron cargar los profesionales');
  return {
    todos: filas,
    medicos: filas.filter((m) => m.tipo_profesional === 'medico_fisiatra'),
    fisioterapeutas: filas.filter((m) => m.tipo_profesional === 'fisioterapeuta'),
  };
}

// -----------------------------------------------------------------------------
// Registrar un paciente.
//
// El superusuario NO tiene ficha de médico, así que cuando registra a alguien
// tiene que decir a qué médico se lo asigna (`datos.id_medico_tratante`).
// Un médico normal puede elegirlo también, pero si no lo hace queda él.
// El registrador lo completa la base sola (trigger trg_completar_registrador).
// -----------------------------------------------------------------------------
export async function crearPaciente(datos, sesion) {
  const idMedico = sesion?.medico?.id_medico || null;
  const esSuperusuario = sesion?.user?.nombre_rol === 'superusuario';

  if (!esSuperusuario && !idMedico) {
    throw new Error('Tu usuario no tiene ficha de profesional. Pídele al administrador que la cree antes de registrar pacientes.');
  }

  const idTratante = datos.id_medico_tratante || idMedico;

  if (!idTratante) {
    throw new Error('Elige a qué médico se le asigna este paciente.');
  }

  const fila = {
    numero_carnet: datos.ci || `SIN-CI-${Date.now()}`,
    tipo_documento: datos.tipo_documento || 'ci',
    ci_expedido: datos.ci_expedido || null,
    nombre_completo: datos.name,
    fecha_nacimiento: datos.birthDate,
    sexo: datos.gender === 'Femenino' ? 'F' : 'M',
    grado_artrosis_kl: Number(datos.gradoArtrosis) || 2,
    articulacion_principal: datos.articulacion || 'rodilla',
    diagnostico_previo: datos.diagnosis || 'Artrosis en estudio',
    id_medico_tratante: idTratante,
    id_fisioterapeuta_asignado: datos.id_fisioterapeuta || null,
    // id_medico_registrador: lo completa la base sola (trigger trg_completar_registrador).
    // No se manda desde el navegador: es la base la que decide quién queda como registrador.
    telefono: datos.phone || null,
    email: datos.email || null,
    direccion: datos.address || null,
    contacto_emergencia_nombre: datos.contacto_nombre || null,
    contacto_emergencia_telefono: datos.contacto_telefono || null,
    origen_registro: 'manual',
    activo: true,
  };

  // `codigo_anonimo` lo pone la base sola (trigger trg_codigo_anonimo).
  const r = await sb().from('pacientes').insert(fila).select().single();
  return mapPacienteBase(ok(r, 'No se pudo registrar al paciente'));
}

export async function actualizarPaciente(idPaciente, datos) {
  const cambios = {};
  if (datos.name !== undefined) cambios.nombre_completo = datos.name;
  if (datos.phone !== undefined) cambios.telefono = datos.phone;
  if (datos.email !== undefined) cambios.email = datos.email || null;
  if (datos.address !== undefined) cambios.direccion = datos.address;
  if (datos.diagnosis !== undefined) cambios.diagnostico_previo = datos.diagnosis;
  if (datos.articulacion !== undefined) cambios.articulacion_principal = datos.articulacion;
  if (datos.gradoArtrosis !== undefined) cambios.grado_artrosis_kl = Number(datos.gradoArtrosis);
  if (datos.idMedicoTratante !== undefined) cambios.id_medico_tratante = datos.idMedicoTratante;
  if (datos.idFisioterapeuta !== undefined) cambios.id_fisioterapeuta_asignado = datos.idFisioterapeuta;

  const r = await sb().from('pacientes').update(cambios)
    .eq('id_paciente', idPaciente).select().single();
  return mapPacienteBase(ok(r, 'No se pudo actualizar al paciente'));
}

export async function cambiarEstadoPaciente(idPaciente, activo) {
  const r = await sb().from('pacientes').update({ activo })
    .eq('id_paciente', idPaciente).select().single();
  return mapPacienteBase(ok(r, 'No se pudo cambiar el estado del paciente'));
}

// =============================================================================
// EVALUACIONES CON GONIÓMETRO
// -----------------------------------------------------------------------------
// El ROM, el error contra la cámara y si entra en el umbral clínico los
// calcula la base sola (columnas generadas); acá solo se arma la fila con lo
// que el médico mide a mano. La entrada en el historial la escribe el
// trigger `trg_evaluacion_al_historial` — no hace falta pedirla aparte.
// =============================================================================
const filaEvaluacion = (datos) => ({
  id_plan: datos.id_plan || null,
  momento: datos.momento,
  fecha: datos.fecha || new Date().toISOString().slice(0, 10),
  articulacion: datos.articulacion,
  lado: datos.lado || 'derecho',
  angulo_minimo: Number(datos.angulo_minimo),
  angulo_maximo: Number(datos.angulo_maximo),
  angulo_app: datos.angulo_app === '' || datos.angulo_app == null ? null : Number(datos.angulo_app),
  id_sesion_referencia: datos.id_sesion_referencia || null,
  umbral_clinico_grados: datos.umbral_clinico_grados || 5.0,
  dolor_eva: datos.dolor_eva === '' || datos.dolor_eva == null ? null : Number(datos.dolor_eva),
  instrumento: datos.instrumento || 'Goniómetro universal',
  posicion_paciente: datos.posicion_paciente || null,
  observaciones: datos.observaciones || null,
});

export async function crearEvaluacion(idPaciente, datos, sesion) {
  const idMedico = sesion?.medico?.id_medico;
  if (!idMedico) throw new Error('Solo un profesional puede registrar evaluaciones.');

  const r = await sb().from('evaluaciones_goniometro').insert({
    id_paciente: idPaciente,
    ...filaEvaluacion(datos),
    id_medico_evaluador: idMedico,
  }).select().single();

  if (r.error) {
    if (/duplicate key|unique/i.test(r.error.message || '')) {
      throw new Error(`Ya existe una evaluación "${datos.momento}" para esa articulación y lado en este plan.`);
    }
    throw new Error(`No se pudo guardar la evaluación: ${r.error.message}`);
  }
  return mapEvaluacion(r.data);
}

export async function actualizarEvaluacion(idEvaluacion, datos) {
  const r = await sb().from('evaluaciones_goniometro')
    .update(filaEvaluacion(datos))
    .eq('id_evaluacion', idEvaluacion).select().single();
  return mapEvaluacion(ok(r, 'No se pudo actualizar la evaluación'));
}

// =============================================================================
// HISTORIAL CLÍNICO Y ADJUNTOS
// =============================================================================

// El panel manda etiquetas ("Evaluación", "Radiografía"); la base las traduce
// sola con el trigger trg_norm_tipo_historial, así que se mandan tal cual.
export async function crearNotaClinica(idPaciente, datos, archivos = [], sesion) {
  const idMedico = sesion?.medico?.id_medico;
  if (!idMedico) throw new Error('Solo un profesional puede escribir en el historial.');

  const r = await sb().from('historial_clinico').insert({
    id_paciente: idPaciente,
    id_medico: idMedico,
    tipo_entrada: datos.type || 'evolucion',
    titulo: datos.title || datos.type || 'Nota clínica',
    contenido: datos.note || '(sin texto, solo adjuntos)',
    fecha_registro: datos.date ? new Date(datos.date).toISOString() : new Date().toISOString(),
    visible_para_paciente: datos.visible !== false,
  }).select().single();

  const nota = ok(r, 'No se pudo guardar la nota clínica');

  for (const archivo of archivos || []) {
    await subirAdjunto(idPaciente, nota.id_historial, archivo, idMedico);
  }
  return mapHistorial(nota);
}

export async function actualizarNotaClinica(idHistorial, datos) {
  const r = await sb().from('historial_clinico').update({
    tipo_entrada: datos.type,
    titulo: datos.title || datos.type,
    contenido: datos.note,
    fecha_registro: datos.date ? new Date(datos.date).toISOString() : undefined,
  }).eq('id_historial', idHistorial).select().single();
  return mapHistorial(ok(r, 'No se pudo actualizar la nota'));
}

export async function subirAdjunto(idPaciente, idHistorial, archivo, idMedico) {
  const MAX = 15 * 1024 * 1024;
  if (archivo.size > MAX) throw new Error(`"${archivo.name}" pesa más de 15 MB.`);

  const ruta = `${idPaciente}/${Date.now()}-${limpiarNombreArchivo(archivo.name)}`;
  const sub = await sb().storage.from('adjuntos-clinicos')
    .upload(ruta, archivo, { contentType: archivo.type });
  ok(sub, `No se pudo subir "${archivo.name}"`);

  const esImagen = (archivo.type || '').startsWith('image/');
  const r = await sb().from('adjuntos_clinicos').insert({
    id_paciente: idPaciente,
    id_historial: idHistorial,
    storage_path: ruta,
    nombre_original: archivo.name,
    mime_type: archivo.type,
    tamano_bytes: archivo.size,
    tipo_estudio: esImagen ? 'radiografia' : 'informe',
    subido_por: idMedico || null,
  }).select().single();

  return ok(r, 'No se pudo registrar el adjunto');
}

export async function urlAdjunto(adjunto) {
  return urlFirmada(adjunto.bucket || 'adjuntos-clinicos', adjunto.path || adjunto.storage_path);
}

export async function eliminarAdjunto(idAdjunto, bucket, ruta) {
  await sb().storage.from(bucket || 'adjuntos-clinicos').remove([ruta]);
  const r = await sb().from('adjuntos_clinicos').delete().eq('id_adjunto', idAdjunto);
  ok(r, 'No se pudo eliminar el adjunto');
  return { ok: true };
}

// El nombre real del archivo (`nombre_original`) no se toca: sirve de
// respaldo si el que se le puso desde el visor no dice nada útil.
export async function renombrarAdjunto(idAdjunto, nombreVisible) {
  const r = await sb().from('adjuntos_clinicos')
    .update({ nombre_visible: nombreVisible?.trim() || null })
    .eq('id_adjunto', idAdjunto).select().single();
  return ok(r, 'No se pudo renombrar el adjunto');
}

export async function cambiarTipoAdjunto(idAdjunto, tipoEstudio) {
  const r = await sb().from('adjuntos_clinicos')
    .update({ tipo_estudio: tipoEstudio })
    .eq('id_adjunto', idAdjunto).select().single();
  return ok(r, 'No se pudo cambiar el tipo de estudio');
}

// Reemplaza el archivo pero conserva la fila (mismo id, mismo lugar en el
// historial): sube el nuevo con una ruta distinta, actualiza la ficha, y
// recién con eso hecho borra el archivo viejo del depósito. Si se borrara
// primero y la subida fallara, el adjunto se quedaría sin archivo.
export async function reemplazarAdjunto(idAdjunto, idPaciente, bucketViejo, rutaVieja, archivo) {
  const MAX = 15 * 1024 * 1024;
  if (archivo.size > MAX) throw new Error(`"${archivo.name}" pesa más de 15 MB.`);

  const rutaNueva = `${idPaciente}/${Date.now()}-${limpiarNombreArchivo(archivo.name)}`;
  const sub = await sb().storage.from('adjuntos-clinicos')
    .upload(rutaNueva, archivo, { contentType: archivo.type });
  ok(sub, `No se pudo subir "${archivo.name}"`);

  const r = await sb().from('adjuntos_clinicos').update({
    storage_path: rutaNueva,
    nombre_original: archivo.name,
    mime_type: archivo.type,
    tamano_bytes: archivo.size,
  }).eq('id_adjunto', idAdjunto).select().single();

  const fila = ok(r, 'El archivo se subió, pero no se pudo actualizar el adjunto');

  if (rutaVieja) await sb().storage.from(bucketViejo || 'adjuntos-clinicos').remove([rutaVieja]);

  return fila;
}

// =============================================================================
// CATÁLOGO DE EJERCICIOS
// =============================================================================
export async function cargarEjercicios() {
  // `ejercicios_catalogo` apunta DOS veces a `medicos` (quién lo creó, quién
  // subió el video): hay que decir por cuál FK ir, igual que con
  // `medicos`/`usuarios` — si no, Supabase no puede adivinar cuál seguir.
  const [filasRes, prescsRes] = await Promise.all([
    sb().from('ejercicios_catalogo')
      .select('*, medicos!ejercicios_catalogo_id_medico_creador_fkey(nombre_completo)')
      .order('codigo_fisioclin'),
    // Solo cuentan las ACTIVAS, y solo las de los pacientes que este usuario
    // puede ver (RLS de `prescripciones_ejercicio`): un fisioterapeuta ve
    // cuántos de SUS pacientes lo tienen recetado, no el total de la unidad.
    sb().from('prescripciones_ejercicio').select('id_ejercicio, id_paciente').eq('activo', true),
  ]);
  const filas = ok(filasRes, 'No se pudo cargar el catálogo');
  const prescs = ok(prescsRes, 'No se pudieron cargar las prescripciones activas');

  const pacientesPorEjercicio = new Map();
  for (const p of prescs || []) {
    if (!pacientesPorEjercicio.has(p.id_ejercicio)) pacientesPorEjercicio.set(p.id_ejercicio, new Set());
    pacientesPorEjercicio.get(p.id_ejercicio).add(p.id_paciente);
  }

  // El video guardado en el depósito necesita enlace temporal; el pegado a mano
  // ya es una dirección normal.
  return Promise.all(filas.map(async (row) => ({
    ...mapEjercicio(row),
    videoUrl: row.video_referencia_url
      || (row.video_storage_path ? await urlFirmadaSuave(row.video_bucket || 'ejercicios-videos', row.video_storage_path) : ''),
    videoPath: row.video_storage_path || null,
    videoBucket: row.video_bucket || 'ejercicios-videos',
    videoEstado: row.video_estado,
    creadoPor: row.medicos?.nombre_completo || null,
    creadoEn: row.creado_en,
    pacientesRecetados: pacientesPorEjercicio.get(row.id_ejercicio)?.size || 0,
  })));
}

// El enlace firmado dura 1 hora: si la pantalla queda abierta más tiempo, el
// que se cargó con la lista ya no sirve. Pedir uno fresco recién al darle play.
export async function urlVideoEjercicio(ejercicio) {
  if (!ejercicio?.videoPath) return ejercicio?.videoUrl || '';
  return urlFirmadaSuave(ejercicio.videoBucket || 'ejercicios-videos', ejercicio.videoPath);
}

// El catálogo es COMPARTIDO: lo ve todo el equipo y cualquiera puede crear,
// editar o borrar. El superusuario también, aunque no tenga ficha de médico.
export async function crearEjercicio(ej, sesion) {
  const idMedico = sesion?.medico?.id_medico || null;

  const r = await sb().from('ejercicios_catalogo').insert({
    codigo_fisioclin: ej.codigo || null,
    nombre: ej.name,
    descripcion: ej.instructions || null,
    articulacion_objetivo: ej.joint || 'rodilla',
    angulo_min_esperado: Number(ej.minAngle ?? 0),
    angulo_max_esperado: Number(ej.maxAngle ?? 120),
    duracion_estimada_segundos: Number(ej.duration ?? 30),
    video_referencia_url: ej.videoUrl || null,
    video_estado: ej.videoUrl ? 'listo' : 'sin_video',
    // Sin esto el paciente no puede usar la cámara con este ejercicio.
    clase_lstm: ej.camara || null,
    id_medico_creador: idMedico,
    activo: true,
  }).select().single();

  const fila = ok(r, 'No se pudo crear el ejercicio');
  return {
    ...mapEjercicio(fila),
    videoPath: fila.video_storage_path,
    videoBucket: fila.video_bucket,
    videoEstado: fila.video_estado,
    creadoPor: sesion?.user?.nombre_completo || sesion?.medico?.nombre_completo || null,
    creadoEn: fila.creado_en,
    pacientesRecetados: 0,
  };
}

export async function actualizarEjercicio(ej) {
  const cambios = {
    nombre: ej.name,
    descripcion: ej.instructions,
    articulacion_objetivo: ej.joint,
    angulo_min_esperado: Number(ej.minAngle ?? 0),
    angulo_max_esperado: Number(ej.maxAngle ?? 120),
    duracion_estimada_segundos: Number(ej.duration ?? 30),
    activo: ej.activo !== false,
  };
  // Movimiento para la cámara del paciente. Solo si vino del formulario.
  if (ej.camara !== undefined) cambios.clase_lstm = ej.camara || null;
  // `ej.videoUrl` solo se manda cuando el formulario tiene el campo de
  // enlace de YouTube (ver CatalogoEjercicios). Si no vino, no se toca —
  // así no se borra por accidente un video ya subido como archivo.
  if (ej.videoUrl !== undefined) {
    cambios.video_referencia_url = ej.videoUrl || null;
    if (ej.videoUrl) cambios.video_estado = 'listo';
  }

  const r = await sb().from('ejercicios_catalogo').update(cambios)
    .eq('id_ejercicio', ej.id).select().single();

  const fila = ok(r, 'No se pudo actualizar el ejercicio');
  return {
    ...mapEjercicio(fila),
    videoUrl: fila.video_referencia_url
      || (fila.video_storage_path ? await urlFirmadaSuave(fila.video_bucket || 'ejercicios-videos', fila.video_storage_path) : ''),
    videoPath: fila.video_storage_path,
    videoBucket: fila.video_bucket,
    videoEstado: fila.video_estado,
  };
}

// Borrar un ejercicio del catálogo. Cualquiera del equipo puede.
// Si ya está recetado a alguien, la base lo impide (la prescripción lo apunta):
// en ese caso se desactiva, que es lo correcto — borrarlo rompería el historial.
export async function eliminarEjercicio(idEjercicio, rutaVideo) {
  const r = await sb().from('ejercicios_catalogo').delete().eq('id_ejercicio', idEjercicio);

  if (r.error) {
    if (/foreign key|viola/i.test(r.error.message || '')) {
      await actualizarEjercicio({ id: idEjercicio, activo: false });
      return { ok: true, desactivado: true,
        mensaje: 'Ese ejercicio ya está recetado a pacientes, así que no se puede borrar. Se desactivó: deja de aparecer para recetar, pero el historial se mantiene.' };
    }
    throw new Error(`No se pudo borrar el ejercicio: ${r.error.message}`);
  }

  if (rutaVideo) await sb().storage.from('ejercicios-videos').remove([rutaVideo]);
  return { ok: true, desactivado: false, mensaje: 'Ejercicio eliminado del catálogo.' };
}

// Quitar solo el video, dejando el ejercicio.
export async function quitarVideoEjercicio(idEjercicio, rutaVideo) {
  if (rutaVideo) await sb().storage.from('ejercicios-videos').remove([rutaVideo]);
  const r = await sb().from('ejercicios_catalogo').update({
    video_storage_path: null,
    video_nombre_original: null,
    video_mime_type: null,
    video_tamano_bytes: null,
    video_estado: 'sin_video',
    video_fecha_subida: null,
  }).eq('id_ejercicio', idEjercicio).select().single();
  const fila = ok(r, 'No se pudo quitar el video');
  return { ...mapEjercicio(fila), videoUrl: '', videoPath: null, videoBucket: fila.video_bucket, videoEstado: fila.video_estado };
}

// Subir el VIDEO de un ejercicio. El depósito acepta hasta MAX_VIDEO_MB.
// `opciones.onProgress(cargado, total)` avisa el avance real y
// `opciones.signal` (un AbortController.signal) permite cancelarla a mitad
// de camino — ambos hacen falta para la barra de progreso y el botón
// "Cancelar" del Arreglo 7.
export async function subirVideoEjercicio(idEjercicio, archivo, sesion, opciones = {}) {
  const MAX = MAX_VIDEO_MB * 1024 * 1024;
  if (archivo.size > MAX) {
    const pesoMb = Math.round((archivo.size / (1024 * 1024)) * 10) / 10;
    throw new Error(`El video pesa ${pesoMb} MB y el máximo es ${MAX_VIDEO_MB} MB. Comprímelo a 720p antes de subirlo.`);
  }

  const ruta = `${idEjercicio}/${Date.now()}-${limpiarNombreArchivo(archivo.name)}`;

  // Para poder devolver el estado del video a lo que tenía si se cancela
  // (no a "error", que sugeriría que algo salió mal) hace falta saber cómo
  // estaba antes de tocar nada.
  const { data: previo } = await sb().from('ejercicios_catalogo')
    .select('video_estado').eq('id_ejercicio', idEjercicio).maybeSingle();
  const estadoAnterior = previo?.video_estado || 'sin_video';

  await sb().from('ejercicios_catalogo')
    .update({ video_estado: 'subiendo' }).eq('id_ejercicio', idEjercicio);

  try {
    await subirAlDeposito('ejercicios-videos', ruta, archivo, opciones);
  } catch (err) {
    await sb().from('ejercicios_catalogo')
      .update({ video_estado: err?.cancelado ? estadoAnterior : 'error' }).eq('id_ejercicio', idEjercicio);
    if (err?.cancelado) throw err;
    throw new Error(`No se pudo subir el video: ${err.message}`);
  }

  const r = await sb().from('ejercicios_catalogo').update({
    video_bucket: 'ejercicios-videos',
    video_storage_path: ruta,
    video_nombre_original: archivo.name,
    video_mime_type: archivo.type,
    video_tamano_bytes: archivo.size,
    video_estado: 'listo',
    video_fecha_subida: new Date().toISOString(),
    id_medico_subio_video: sesion?.medico?.id_medico || null,
  }).eq('id_ejercicio', idEjercicio).select().single();

  const fila = ok(r, 'No se pudo guardar el video');
  return {
    ...mapEjercicio(fila),
    videoUrl: await urlFirmadaSuave('ejercicios-videos', ruta),
    videoPath: ruta,
    videoBucket: 'ejercicios-videos',
    videoEstado: fila.video_estado,
  };
}

// =============================================================================
// PLAN Y PRESCRIPCIONES
// =============================================================================
export async function guardarRutina(idPaciente, rutina, sesion) {
  const idMedico = sesion?.medico?.id_medico;
  if (!idMedico) throw new Error('Solo un profesional puede prescribir.');

  const semanas = Number(rutina.weeks) || Math.ceil((rutina.duration || 14) / 7);
  let idPlan = rutina.id_plan;

  if (idPlan) {
    const r = await sb().from('planes_tratamiento').update({
      objetivo_general: rutina.name,
      duracion_estimada_semanas: semanas,
      fecha_inicio: rutina.startDate || new Date().toISOString().slice(0, 10),
      observaciones: rutina.instructions || null,
    }).eq('id_plan', idPlan).select().single();
    ok(r, 'No se pudo actualizar el plan');
  } else {
    // Solo puede haber UN plan activo por paciente (`cargarPacientes` elige el
    // plan por `estado === 'activo'`). Sin este cierre, un plan viejo se queda
    // "activo" para siempre y la app puede seguir leyendo su duración vieja en
    // vez de la del plan recién creado.
    const cerrar = await sb().from('planes_tratamiento')
      .update({ estado: 'completado', fecha_fin_real: new Date().toISOString().slice(0, 10) })
      .eq('id_paciente', idPaciente).eq('estado', 'activo');
    ok(cerrar, 'No se pudo cerrar el plan activo anterior');

    const r = await sb().from('planes_tratamiento').insert({
      id_paciente: idPaciente,
      id_medico_responsable: idMedico,
      objetivo_general: rutina.name || 'Plan terapéutico',
      duracion_estimada_semanas: semanas,
      fecha_inicio: rutina.startDate || new Date().toISOString().slice(0, 10),
      observaciones: rutina.instructions || null,
      estado: 'activo',
    }).select().single();
    idPlan = ok(r, 'No se pudo crear el plan').id_plan;
  }

  // Las prescripciones viejas no se borran: se apagan. Así las sesiones ya
  // grabadas siguen apuntando a algo y el historial no se rompe.
  const apagar = await sb().from('prescripciones_ejercicio')
    .update({ activo: false }).eq('id_plan', idPlan).eq('activo', true);
  ok(apagar, 'No se pudieron cerrar las prescripciones anteriores');

  const nuevas = (rutina.exercises || []).map((e) => ({
    id_paciente: idPaciente,
    id_plan: idPlan,
    id_ejercicio: e.id,
    id_medico_prescriptor: idMedico,
    series: Number(e.series) || 3,
    repeticiones: Number(e.reps) || 10,
    frecuencia_semanal: frecuenciaSemanal(e.freq),
    observaciones: e.instructions || null,
    activo: true,
  }));

  if (nuevas.length) {
    const r = await sb().from('prescripciones_ejercicio').insert(nuevas);
    ok(r, 'No se pudieron guardar los ejercicios de la rutina');
  }

  return { id_plan: idPlan, prescripciones: nuevas.length };
}

export async function cambiarEstadoPlan(idPlan, estado) {
  const r = await sb().from('planes_tratamiento')
    .update({ estado, fecha_fin_real: estado === 'completado' ? new Date().toISOString().slice(0, 10) : null })
    .eq('id_plan', idPlan).select().single();
  return ok(r, 'No se pudo cambiar el estado del plan');
}

export async function quitarPrescripcion(idPrescripcion) {
  const r = await sb().from('prescripciones_ejercicio')
    .update({ activo: false, fecha_fin: new Date().toISOString().slice(0, 10) })
    .eq('id_prescripcion', idPrescripcion).select().single();
  return ok(r, 'No se pudo quitar el ejercicio');
}

// -----------------------------------------------------------------------------
// Receta de medicamentos
// -----------------------------------------------------------------------------
export async function crearRecetaMedicamento(idPaciente, datos, sesion) {
  const idMedico = sesion?.medico?.id_medico;
  if (!idMedico) throw new Error('Solo un profesional puede recetar.');

  const r = await sb().from('recetas_medicamentos').insert({
    id_paciente: idPaciente,
    id_medico_prescriptor: idMedico,
    nombre_medicamento: datos.nombre,
    dosis: datos.dosis,
    frecuencia: datos.frecuencia,
    fecha_fin: datos.fechaFin || null,
    indicaciones: datos.indicaciones || null,
  }).select().single();

  return mapReceta(ok(r, 'No se pudo guardar la receta'));
}

export async function suspenderRecetaMedicamento(idReceta) {
  const r = await sb().from('recetas_medicamentos')
    .update({ activa: false }).eq('id_receta', idReceta).select().single();
  return mapReceta(ok(r, 'No se pudo suspender la receta'));
}

export async function eliminarRecetaMedicamento(idReceta) {
  const r = await sb().from('recetas_medicamentos').delete().eq('id_receta', idReceta);
  ok(r, 'No se pudo eliminar la receta');
}

// -----------------------------------------------------------------------------
// Historia clínica general (ficha de ingreso, formato papel)
// -----------------------------------------------------------------------------
export async function guardarHistoriaGeneral(idPaciente, datos, sesion) {
  const idMedico = sesion?.medico?.id_medico;
  if (!idMedico) throw new Error('Solo un profesional puede completar la historia clínica.');

  const r = await sb().from('historia_clinica_general').upsert(
    {
      id_paciente: idPaciente,
      id_medico_registra: idMedico,
      anamnesis_informante: datos.informante || 'paciente',
      anamnesis_confiable: datos.confiable !== false,
      motivo_consulta: datos.motivoConsulta,
      enfermedad_actual: datos.enfermedadActual || null,
      antecedentes_patologicos: datos.antecedentesPatologicos || null,
      tratamiento_actual: datos.tratamientoActual || null,
      habitos: datos.habitos || null,
      habitos_higienicos: datos.habitosHigienicos || null,
      examen_fisico: datos.examenFisico || null,
    },
    { onConflict: 'id_paciente' },
  ).select().single();

  return mapHistoriaGeneral(ok(r, 'No se pudo guardar la historia clínica general'));
}

// =============================================================================
// AGENDA
// =============================================================================
function citaSalida(c) {
  const p = c.pacientes || {};
  const m = c.medicos || {};
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
  let q = sb().from('citas')
    .select('*, pacientes(nombre_completo, codigo_anonimo, telefono, articulacion_principal, diagnostico_previo), medicos(nombre_completo)')
    .order('fecha_hora');
  if (desde) q = q.gte('fecha_hora', new Date(desde).toISOString());

  const filas = ok(await q, 'No se pudo cargar la agenda');
  return filas.map(citaSalida);
}

export async function programarCita(datos) {
  const { data: s } = await sb().from('vista_sesion_actual').select('id_usuario, id_medico').maybeSingle();

  const r = await sb().from('citas').insert({
    id_paciente: Number(datos.id_paciente),
    id_medico: datos.id_medico || s?.id_medico,
    id_plan: datos.id_plan || null,
    fecha_hora: datos.fecha_hora,
    duracion_minutos: Number(datos.duracion_minutos) || 45,
    tipo: datos.tipo || 'control',
    modalidad: datos.modalidad || 'presencial',
    motivo: datos.motivo || 'Control',
    lugar: datos.lugar || 'Unidad de Medicina Física y Rehabilitación - COSSMIL',
    indicaciones: datos.indicaciones || null,
    estado: 'programada',
    creada_por: s?.id_usuario || null,
  }).select().single();

  if (r.error && /citas_sin_solape/i.test(r.error.message || '')) {
    throw new Error('Ese médico ya tiene otra cita a esa hora. Elige otro horario.');
  }
  return { id_cita: ok(r, 'No se pudo agendar la cita').id_cita };
}

export async function reprogramarCita(idCita, nuevaFecha) {
  const r = await sb().from('citas')
    .update({ fecha_hora: nuevaFecha, estado: 'programada', recordatorio_enviado: false })
    .eq('id_cita', idCita).select().single();

  if (r.error && /citas_sin_solape/i.test(r.error.message || '')) {
    throw new Error('Ese horario ya está ocupado. Elige otro.');
  }
  return ok(r, 'No se pudo reprogramar la cita');
}

export async function cerrarCita(idCita, estado, observaciones) {
  const r = await sb().from('citas')
    .update({ estado, observaciones_cierre: observaciones || null })
    .eq('id_cita', idCita).select().single();
  return ok(r, 'No se pudo cerrar la cita');
}

// =============================================================================
// NOTIFICACIONES Y MENSAJES
// =============================================================================
function haceCuantoTxt(valor) {
  const min = Math.floor((Date.now() - new Date(valor).getTime()) / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

export async function cargarNotificaciones(limite = 50) {
  const r = await sb().from('notificaciones').select('*')
    .order('fecha_creacion', { ascending: false }).limit(limite);
  const filas = ok(r, 'No se pudieron cargar los avisos');

  return filas.map((n) => ({
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
  const { data: s } = await sb().from('vista_sesion_actual').select('id_usuario').maybeSingle();
  let q = sb().from('notificaciones')
    .update({ leida: true, fecha_lectura: new Date().toISOString() })
    .eq('id_usuario', s?.id_usuario)
    .eq('leida', false);
  if (ids) q = q.in('id_notificacion', ids);
  ok(await q, 'No se pudieron marcar los avisos');
  return { ok: true };
}

// Va por función de la base: ella comprueba que el paciente sea tuyo. No hay
// forma de escribirle a un paciente ajeno cambiando un número en el navegador.
export async function enviarMensajePaciente(idPaciente, titulo, mensaje, severidad = 'info') {
  const r = await sb().rpc('fn_mensaje_a_paciente', {
    p_id_paciente: idPaciente,
    p_asunto: titulo,
    p_cuerpo: mensaje,
    p_severidad: severidad,
  });
  ok(r, 'No se pudo enviar el mensaje');
  return { ok: true };
}

export async function enviarMensajeMasivo(idsPaciente, titulo, mensaje, severidad = 'info') {
  const resultados = await Promise.allSettled(
    (idsPaciente || []).map((id) => enviarMensajePaciente(id, titulo, mensaje, severidad)),
  );
  const enviados = resultados.filter((x) => x.status === 'fulfilled').length;
  const fallidos = resultados.length - enviados;
  if (enviados === 0 && fallidos > 0) throw new Error('No se pudo enviar ningún mensaje.');
  return { ok: true, enviados, fallidos };
}

export async function cargarMensajes(idPaciente = null) {
  let q = sb().from('mensajes').select('*').order('creado_en', { ascending: false }).limit(200);
  if (idPaciente) q = q.eq('id_paciente', idPaciente);
  return ok(await q, 'No se pudieron cargar los mensajes');
}

export async function ejecutarRevisionAlertas() {
  const r = await sb().rpc('fn_revision_alertas');
  return ok(r, 'No se pudo ejecutar la revisión de alertas');
}

// =============================================================================
// SUPERUSUARIO
// =============================================================================
export async function cargarUsuarios() {
  const r = await sb().from('vista_usuarios_admin').select('*').order('id_usuario');
  return ok(r, 'No se pudieron cargar los usuarios');
}

export async function cargarMedicos() {
  // `usuarios!medicos_id_usuario_fkey` y no `usuarios` a secas: la tabla
  // `medicos` apunta DOS VECES a `usuarios` (por `id_usuario` y por
  // `actualizado_por`), así que hay que decirle cuál de las dos seguir. Sin
  // esto responde "more than one relationship was found" y se cae Mi Perfil.
  const r = await sb().from('medicos')
    .select('*, usuarios!medicos_id_usuario_fkey(id_usuario, email, activo, rol)')
    .order('nombre_completo');
  const filas = ok(r, 'No se pudieron cargar los profesionales');
  return filas.map((m) => ({
    ...mapMedico(m),
    biografia: m.biografia || '',
    consultorio: m.consultorio || '',
    horario_atencion: m.horario_atencion || '',
  }));
}

// `vista_usuarios_admin` (la que alimenta a GestionUsuarios) no trae
// `especialidad` ni `telefono` — son de detalle del perfil, no de la lista.
// Antes de abrir "Editar perfil" hay que pedirlos aparte: si el formulario
// arrancara con esos campos en blanco, guardar sin querer los borraría.
export async function cargarFichaMedico(idMedico) {
  const r = await sb().from('medicos')
    .select('nombre_completo, cedula_profesional, especialidad, telefono')
    .eq('id_medico', idMedico).single();
  return ok(r, 'No se pudo cargar la ficha del profesional');
}

// Va por función de la base: ella exige ser superusuario. Que este botón esté
// escondido en el panel NO es la seguridad.
export async function definirModulos(idUsuario, modulos) {
  const r = await sb().rpc('fn_definir_modulos', {
    p_id_usuario: idUsuario,
    p_modulos: modulos,
  });
  return ok(r, 'No se pudieron cambiar los permisos');
}

export async function cambiarEstadoUsuario(idUsuario, activo) {
  const r = await sb().from('usuarios').update({ activo })
    .eq('id_usuario', idUsuario).select().single();
  return ok(r, 'No se pudo cambiar el estado del usuario');
}

// -----------------------------------------------------------------------------
// El superusuario corrige la ficha de CUALQUIER profesional (a diferencia de
// `actualizarPerfilMedico`, que la política `fc_medicos_propio_update` solo
// deja usar sobre la ficha propia). La política `p_super_todo` es la que
// habilita esto: le da al superusuario acceso total a `usuarios` y `medicos`,
// la misma que ya usa `cambiarEstadoUsuario` de arriba.
// -----------------------------------------------------------------------------
export async function actualizarProfesionalComoAdmin(usuario, datos) {
  if (usuario.id_medico) {
    const r = await sb().from('medicos').update({
      nombre_completo: datos.nombre_completo,
      especialidad: datos.especialidad || null,
      cedula_profesional: datos.cedula_profesional,
      telefono: datos.telefono || null,
    }).eq('id_medico', usuario.id_medico).select().single();
    ok(r, 'No se pudo actualizar la ficha del profesional');
  } else {
    // El superusuario no tiene ficha en `medicos`: su nombre vive en `usuarios`.
    const r = await sb().from('usuarios').update({
      nombre_completo: datos.nombre_completo,
    }).eq('id_usuario', usuario.id_usuario).select().single();
    ok(r, 'No se pudo actualizar el nombre');
  }

  // El correo es a la vez el de acceso (Supabase Auth) y el de la ficha: va
  // por la Edge Function de `cambiarEmailDeOtro`, que mantiene ambos en
  // sincronía, y solo si de verdad cambió.
  if (datos.email && datos.email.toLowerCase() !== (usuario.email || '').toLowerCase()) {
    await cambiarEmailDeOtro(usuario.id_usuario, datos.email);
  }
}

export async function crearProfesional(datos) {
  const usuario = (datos.email || '').split('@')[0]
    .toLowerCase().replace(/[^a-z0-9._]/g, '') || `prof${Date.now()}`;

  const ru = await sb().from('usuarios').insert({
    nombre_usuario: usuario,
    email: (datos.email || '').toLowerCase(),
    rol: datos.tipo_profesional,
    activo: true,
    debe_cambiar_password: true,
    modulos_permitidos: datos.modulos || {},
    // Para un médico esto queda redundante con `medicos.nombre_completo` (que
    // manda), pero para un superusuario es el ÚNICO lugar donde vive su nombre.
    nombre_completo: datos.nombre_completo || null,
  }).select().single();
  const u = ok(ru, 'No se pudo crear el usuario');

  // El superusuario no atiende pacientes: no lleva ficha en `medicos`
  // (esa tabla solo admite tipo_profesional medico_fisiatra/fisioterapeuta).
  if (datos.tipo_profesional === 'superusuario') {
    return { id_usuario: u.id_usuario, id_medico: null };
  }

  const rm = await sb().from('medicos').insert({
    id_usuario: u.id_usuario,
    nombre_completo: datos.nombre_completo,
    tipo_profesional: datos.tipo_profesional,
    especialidad: datos.especialidad || 'Medicina Física y Rehabilitación',
    cedula_profesional: datos.cedula_profesional || `SIN-CEDULA-${u.id_usuario}`,
    telefono: datos.telefono || null,
  }).select().single();
  const m = ok(rm, 'Se creó el usuario pero no la ficha profesional');

  return { id_usuario: u.id_usuario, id_medico: m.id_medico };
}

// -----------------------------------------------------------------------------
// Ponerle una contraseña a OTRA persona (crearle la cuenta, cambiársela)
// exige la llave `service_role`, y esa llave NUNCA puede estar en el
// navegador: con ella se salta toda la seguridad — RLS incluido. Por eso
// esto no se hace acá: se llama a la Edge Function `gestionar-usuario`, que
// corre en el servidor de Supabase y sí tiene esa llave.
//
// `functions.invoke()` de supabase-js, cuando la función responde con un
// código que no es 2xx, mete el motivo real adentro de `error.context` (la
// Response cruda) en vez de en `error.message` — que se queda con un
// genérico "Edge Function returned a non-2xx status code". Sin leer el
// cuerpo a mano, cualquier error de la función (contraseña corta, correo
// repetido, lo que sea) se vería igual de misterioso.
// -----------------------------------------------------------------------------
async function mensajeDeFuncion(error) {
  try {
    const cuerpo = await error?.context?.json?.();
    return cuerpo?.error || null;
  } catch {
    return null;
  }
}

async function invocarGestionUsuario(body) {
  const { data, error } = await sb().functions.invoke('gestionar-usuario', { body });
  if (error) throw new Error((await mensajeDeFuncion(error)) || error.message || 'No se pudo completar la operación.');
  if (data?.error) throw new Error(data.error);
  return data;
}

// Crea la cuenta de ACCESO (Supabase Auth) de un profesional, con contraseña
// desde el primer momento — a diferencia del enlace por correo, esto lo deja
// listo para entrar de inmediato y hace que aparezca en Authentication → Users.
// Si la ficha en `usuarios`/`medicos` ya existe (el caso normal: se llama
// después de `crearProfesional()`, o desde el botón "Crear cuenta" de
// alguien que nunca tuvo acceso), la función solo agrega la cuenta de Auth.
// Si no existe todavía, la crea de una — por eso puede recibir también
// tipo_profesional/cedula/telefono/especialidad.
export async function crearCuentaAcceso({
  email, password, nombre, tipo_profesional, cedula, telefono, especialidad,
}) {
  return invocarGestionUsuario({
    accion: 'crear',
    email,
    password,
    nombre_completo: nombre,
    tipo_profesional,
    cedula,
    telefono,
    especialidad,
  });
}

// Para cuando alguien olvida su contraseña y no le llega el correo de
// recuperación (o directamente no revisa ese correo).
export async function cambiarPasswordDeOtro(idUsuario, nueva) {
  return invocarGestionUsuario({ accion: 'cambiar_password', id_usuario: idUsuario, nueva });
}

// Cambia el correo de acceso Y el de la ficha juntos (la Edge Function se
// encarga de mantenerlos sincronizados).
export async function cambiarEmailDeOtro(idUsuario, nuevoEmail) {
  return invocarGestionUsuario({ accion: 'cambiar_email', id_usuario: idUsuario, nuevo_email: nuevoEmail });
}

export async function forzarCambioPassword(idUsuario, motivo) {
  const r = await sb().rpc('fn_forzar_cambio_password', {
    p_id_usuario: idUsuario,
    p_motivo: motivo || null,
  });
  const data = ok(r, 'No se pudo forzar el cambio de contraseña');
  if (data?.email) {
    await sb().auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/#recuperar`,
    });
  }
  return data;
}

// =============================================================================
// SOLICITUDES DE ACCESO
// =============================================================================
export async function cargarSolicitudes(estado = 'pendiente') {
  let q = sb().from('solicitudes_acceso').select('*')
    .order('fecha_solicitud', { ascending: false });
  if (estado) q = q.eq('estado', estado);

  const filas = ok(await q, 'No se pudieron cargar las solicitudes');
  return filas.map((s) => {
    const dias = Math.floor((Date.now() - new Date(s.fecha_solicitud).getTime()) / 86400000);
    return {
      ...s,
      antiguedad: dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`,
    };
  });
}

export async function aprobarSolicitud(idSolicitud, _idSuper, _nombre, opciones = {}) {
  const r = await sb().rpc('fn_aprobar_solicitud', {
    p_id_solicitud: idSolicitud,
    p_rol: opciones.rol || 'medico_fisiatra',
    p_tipo: opciones.tipo || 'medico_fisiatra',
    p_cedula: opciones.cedula || null,
    p_especialidad: opciones.especialidad || 'Medicina Física y Rehabilitación',
    p_modulos: opciones.modulos || null,
  });
  return ok(r, 'No se pudo aprobar la solicitud');
}

export async function rechazarSolicitud(idSolicitud, _idSuper, motivo) {
  const r = await sb().rpc('fn_rechazar_solicitud', {
    p_id_solicitud: idSolicitud,
    p_motivo: motivo || null,
  });
  return ok(r, 'No se pudo rechazar la solicitud');
}

// =============================================================================
// AUDITORÍA
// =============================================================================
export async function cargarBitacora(limite = 200) {
  const r = await sb().from('bitacora_auditoria')
    .select('*, usuarios(nombre_usuario, email)')
    .order('fecha', { ascending: false }).limit(limite);

  const filas = ok(r, 'No se pudo cargar la auditoría');
  return filas.map((b) => ({
    ...b,
    autor: b.usuarios?.nombre_usuario || 'Sistema',
  }));
}

// =============================================================================
// REPORTES EN PDF (FASE 9)
// -----------------------------------------------------------------------------
// La consulta es EXACTAMENTE la misma para el administrador y para el
// profesional: cada `vista_reporte_*` corre con los permisos de quien
// pregunta (security_invoker, PASO 24), así que acá no hay ni un filtro por
// rol. Lo único que varía es qué tan atrás mira `vista_reporte_evaluaciones`,
// porque es la única con una columna de fecha por fila.
// =============================================================================
export async function cargarReporteResumen() {
  const r = await sb().from('vista_reporte_resumen').select('*').maybeSingle();
  const fila = ok(r, 'No se pudo cargar el resumen de la unidad');
  return fila ? mapReporteResumen(fila) : null;
}

export async function cargarReportePaciente(idPaciente) {
  const r = await sb().from('vista_reporte_paciente').select('*')
    .eq('id_paciente', idPaciente).maybeSingle();
  const fila = ok(r, 'No se pudo cargar el reporte del paciente');
  return fila ? mapReportePaciente(fila) : null;
}

export async function cargarReporteEvaluaciones(desde, hasta) {
  let q = sb().from('vista_reporte_evaluaciones').select('*').order('fecha');
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  return ok(await q, 'No se pudo cargar el reporte de evaluaciones').map(mapReporteEvaluacionFila);
}

export async function cargarReporteAdherencia() {
  const r = await sb().from('vista_reporte_adherencia').select('*').order('nombre_completo');
  return ok(r, 'No se pudo cargar el reporte de adherencia').map(mapReporteAdherencia);
}

export async function cargarReporteProfesionales() {
  const r = await sb().from('vista_reporte_profesionales').select('*').order('nombre_completo');
  return ok(r, 'No se pudo cargar el reporte de profesionales').map(mapReporteProfesional);
}

export async function cargarReporteUsuarios() {
  const r = await sb().from('vista_reporte_usuarios').select('*').order('nombre_usuario');
  return ok(r, 'No se pudo cargar el reporte de usuarios y accesos').map(mapReporteUsuario);
}

// Historial de PDF ya generados. Trae metadatos nomás — el enlace de
// descarga se pide recién al hacer clic (subirReportePDF/urlReporte), no acá:
// un enlace firmado que nadie usa es una llave abierta de más.
export async function cargarReportesGenerados(idPaciente = null) {
  let q = sb().from('reportes_generados')
    .select('*, medicos(nombre_completo), pacientes(codigo_anonimo)')
    .order('fecha_generacion', { ascending: false })
    .limit(50);
  if (idPaciente) q = q.eq('id_paciente', idPaciente);

  const filas = ok(await q, 'No se pudieron cargar los reportes generados');
  return filas.map((r) => ({
    id: r.id_reporte,
    tipo: r.tipo_reporte,
    paciente: r.pacientes?.codigo_anonimo || null,
    generadoPor: r.medicos?.nombre_completo || '—',
    desde: r.rango_fecha_inicio,
    hasta: r.rango_fecha_fin,
    fechaGeneracion: r.fecha_generacion,
    ruta: r.ruta_archivo_pdf,
  }));
}

// Sube el PDF ya armado al depósito privado `reportes` y deja constancia con
// `fn_registrar_reporte` (ella misma exige ser el profesional o el
// superusuario, y que el paciente —si hay uno— sea visible para quien pide).
export async function subirReportePDF(blobPdf, nombreArchivo, { idPaciente = null, desde = null, hasta = null, tipo }) {
  const ruta = `${tipo}/${Date.now()}-${limpiarNombreArchivo(nombreArchivo)}`;

  const sub = await sb().storage.from('reportes').upload(ruta, blobPdf, { contentType: 'application/pdf' });
  ok(sub, 'No se pudo subir el PDF');

  const r = await sb().rpc('fn_registrar_reporte', {
    p_id_paciente: idPaciente,
    p_ruta_pdf: ruta,
    p_desde: desde,
    p_hasta: hasta,
    p_tipo: tipo,
  });
  const idReporte = ok(r, 'El PDF se subió pero no se pudo registrar');
  return { id_reporte: idReporte, ruta };
}

export async function urlReporte(ruta) {
  return urlFirmada('reportes', ruta);
}

// =============================================================================
// ALTA DEL PACIENTE (FASE 10)
// -----------------------------------------------------------------------------
// `fn_dar_alta` es quien manda: exige que exista la evaluación FINAL con
// goniómetro (o `p_forzar = true`, a propósito, para abandonos y derivaciones)
// y hace ella sola las cuatro cosas del alta — cambia el estado del paciente,
// cierra el plan, lo escribe en el historial y avisa al paciente
// (trigger `trg_procesar_alta`). Acá no se repite nada de esa lógica.
// =============================================================================
export async function darAlta(idPaciente, datos) {
  const r = await sb().rpc('fn_dar_alta', {
    p_id_paciente: idPaciente,
    p_tipo_alta: datos.tipo_alta,
    p_estado_funcional: datos.estado_funcional,
    p_motivo: datos.motivo,
    p_recomendaciones: datos.recomendaciones || null,
    p_requiere_control: Boolean(datos.requiere_control),
    p_fecha_control: datos.requiere_control ? (datos.fecha_control || null) : null,
    p_forzar: Boolean(datos.forzar),
  });

  if (r.error) {
    const mensaje = r.error.message || 'error desconocido';
    const err = new Error(mensaje);
    // La base rechaza el alta si falta la evaluación FINAL (a propósito: sin
    // esa medición, el alta es una opinión). El panel usa esta marca para
    // ofrecer las dos salidas que pide el plan, en vez de un error genérico.
    err.faltaEvaluacionFinal = /evaluacion final/i.test(mensaje);
    throw err;
  }
  return r.data; // { id_alta, con_evaluacion_final }
}

// El paciente vuelve: reactiva el tratamiento y deja constancia en el
// historial. Si `articulacion` viene y es DISTINTA a la que ya tenía (p. ej.
// tuvo alta de cadera y reingresa por rodilla), la base deja el diagnóstico
// viejo como antecedente y actualiza la ficha con el nuevo — sin eso, el
// Resumen del paciente seguiría mostrando la articulación anterior.
export async function reabrirTratamiento(idPaciente, motivo, articulacion, diagnostico) {
  const r = await sb().rpc('fn_reabrir_tratamiento', {
    p_id_paciente: idPaciente,
    p_motivo: motivo || null,
    p_articulacion: articulacion ? articulacion.toLowerCase() : null,
    p_diagnostico: diagnostico || null,
  });
  return ok(r, 'No se pudo reabrir el tratamiento');
}

// El tablero de altas (puede vivir dentro del módulo de Evaluaciones): quién
// terminó, cuánto ganó, y sobre todo quién tiene un control vencido — esos
// son los pacientes a los que hay que llamar.
export async function cargarAltas() {
  const r = await sb().from('vista_altas').select('*').order('fecha_alta', { ascending: false });
  return ok(r, 'No se pudieron cargar las altas').map(mapAlta);
}
