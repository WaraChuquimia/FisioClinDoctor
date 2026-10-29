-- ============================================================================
--  FisioClin — BORRAR SOLO LOS DATOS DE PRUEBA
--  ---------------------------------------------------------------------------
--  NO toca la estructura: deja las tablas, funciones, vistas y permisos.
--  Úsalo solo si quieres volver a correr 02_datos.sql desde cero.
--
--  CUIDADO: esto borra TODO el contenido de esas tablas, no solo lo de prueba.
--  No lo corras si ya cargaste pacientes reales.
-- ============================================================================

truncate table
  public.altas_paciente,
  public.evaluaciones_goniometro,
  public.repeticiones_ejercicio,
  public.metricas_articulares,
  public.registro_dolor,
  public.adjuntos_clinicos,
  public.historial_clinico,
  public.sesiones,
  public.citas,
  public.prescripciones_ejercicio,
  public.planes_tratamiento,
  public.mensajes,
  public.notificaciones,
  public.reportes_generados,
  public.consentimiento_informado,
  public.documentos_identidad,
  public.dispositivos_push,
  public.pacientes,
  public.ejercicios_catalogo,
  public.medicos,
  public.fotos_perfil,
  public.preferencias_usuario,
  public.solicitudes_acceso,
  public.bitacora_auditoria,
  public.intentos_login,
  public.usuarios
restart identity cascade;

select 'Datos borrados. Ya puedes volver a correr 02_datos.sql' as resultado;
