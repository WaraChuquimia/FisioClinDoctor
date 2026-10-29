-- ============================================================================
--  FisioClin — ARCHIVO 1 de 2:  LA BASE DE DATOS COMPLETA, DESDE CERO
--  Panel del médico y del superusuario — COSSMIL
-- ============================================================================
--
--  CÓMO SE USA
--    1. Supabase -> SQL Editor -> New query
--    2. Pega ESTE archivo completo y dale RUN
--    3. Cuando termine, abre OTRA consulta y corre el ARCHIVO 2 (los datos)
--
--  Esto CREA TODO desde cero. No necesitas ningún archivo anterior.
--  Si ya tenías tablas con estos nombres, NO las toca ni las borra: las
--  respeta y sigue (todo va con `if not exists`).
--
--  El archivo 2 va en una consulta APARTE, no pegado abajo de este.
--
-- ----------------------------------------------------------------------------
--  QUÉ CREA
--
--    PARTE A   Las 3 listas cerradas y las 20 tablas base
--    PASO 0-24 Todo lo demás: login, contraseñas, goniómetro, altas,
--              reportes, seguridad, avisos automáticos y auditoría
--
--    Total: 28 tablas, 15 vistas, ~40 funciones, 6 depósitos de archivos.
-- ============================================================================


-- ============================================================================
--  PARTE A.1 — EXTENSIONES
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;


-- ============================================================================
--  PARTE A.2 — LAS 3 LISTAS CERRADAS (ENUM)
--  ---------------------------------------------------------------------------
--  Se crean con TODOS los valores que el sistema necesita. Al crearse aquí
--  mismo, se pueden usar sin problema en el resto del archivo.
-- ============================================================================
do $enums$
begin
  if not exists (select 1 from pg_type where typname = 'rol_sistema') then
    create type public.rol_sistema as enum (
      'superusuario',      -- control total: usuarios, accesos y auditoría
      'medico_fisiatra',   -- diagnostica, valida clínicamente y ajusta el plan
      'fisioterapeuta',    -- ejecuta y supervisa las sesiones
      'paciente'           -- usa la app del celular; NO entra a este panel
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'tipo_profesional') then
    create type public.tipo_profesional as enum (
      'medico_fisiatra',
      'fisioterapeuta'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'articulacion') then
    create type public.articulacion as enum (
      'rodilla', 'cadera', 'tobillo', 'pie',
      'hombro', 'codo', 'muneca', 'columna', 'cuello'
    );
  end if;
end $enums$;


-- ============================================================================
--  PARTE A.3 — NORMALIZADOR DE CI
--  Tiene que existir ANTES que `pacientes`: esa tabla lo usa en una columna
--  calculada.
-- ============================================================================
create or replace function public.fn_normalizar_ci(p_texto text)
returns text language sql immutable as $fn$
  select nullif(upper(regexp_replace(coalesce(p_texto, ''), '[^0-9A-Za-z]', '', 'g')), '')
$fn$;


-- ============================================================================
--  PARTE A.4 — LAS 20 TABLAS BASE
--  ---------------------------------------------------------------------------
--  Van en orden de dependencia: cada tabla se crea después de aquellas a las
--  que apunta.
-- ============================================================================

-- --- 1. usuarios: la raíz de todo -------------------------------------------
-- Toda persona del sistema es primero un usuario. Si además atiende pacientes,
-- tendrá una fila en `medicos`; si es paciente, una en `pacientes`.
create table if not exists public.usuarios (
  id_usuario            integer generated always as identity primary key,
  auth_user_id          uuid unique references auth.users(id),
  nombre_usuario        varchar(60)  not null unique,
  email                 varchar(150) not null unique,
  password_hash         varchar(255),
  rol                   public.rol_sistema not null,
  activo                boolean not null default true,
  debe_cambiar_password boolean not null default false,
  modulos_permitidos    jsonb   not null default '{}'::jsonb
                          check (jsonb_typeof(modulos_permitidos) = 'object'),
  ultimo_acceso         timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       integer references public.usuarios(id_usuario)
);

-- --- 2. medicos: la ficha profesional ---------------------------------------
create table if not exists public.medicos (
  id_medico          integer generated always as identity primary key,
  id_usuario         integer not null unique references public.usuarios(id_usuario),
  nombre_completo    varchar(150) not null,
  tipo_profesional   public.tipo_profesional not null,
  especialidad       varchar(120) not null default 'Medicina Física y Rehabilitación',
  cedula_profesional varchar(40)  not null unique,
  telefono           varchar(30),
  unidad             varchar(150) default 'Unidad de Medicina Física y Rehabilitación - COSSMIL',
  biografia          text,
  consultorio        varchar(80),
  horario_atencion   varchar(120),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  actualizado_por    integer references public.usuarios(id_usuario)
);

-- --- 3. pacientes ------------------------------------------------------------
-- `id_medico_registrador` puede ir vacío: lo completa solo el trigger
-- `trg_completar_registrador` (el superusuario no tiene ficha de médico).
create table if not exists public.pacientes (
  id_paciente                integer generated always as identity primary key,
  id_usuario                 integer unique references public.usuarios(id_usuario),
  codigo_anonimo             varchar(20) unique,
  numero_carnet              varchar(30) not null unique,
  numero_carnet_normalizado  text generated always as (public.fn_normalizar_ci(numero_carnet)) stored,
  tipo_documento             varchar(30) not null default 'ci'
    check (tipo_documento in ('ci', 'ci_extranjero', 'pasaporte', 'libreta_servicio_militar')),
  ci_complemento             varchar(5),
  ci_expedido                char(2)
    check (ci_expedido is null or ci_expedido in ('LP','SC','CB','OR','PT','TJ','CH','BE','PD','EX')),
  nombre_completo            varchar(200) not null,
  nombres                    varchar(100),
  apellido_paterno           varchar(60),
  apellido_materno           varchar(60),
  fecha_nacimiento           date not null
    check (fecha_nacimiento > '1900-01-01' and fecha_nacimiento < current_date),
  sexo                       char(1) not null check (sexo in ('M', 'F')),

  -- El estudio se centra en los grados 2 y 3, pero la base acepta 0 a 4 para
  -- no reventar con un paciente fuera de rango: se marca aparte.
  grado_artrosis_kl          smallint not null check (grado_artrosis_kl between 0 and 4),
  dentro_del_estudio         boolean generated always as (grado_artrosis_kl in (2, 3)) stored,

  articulacion_principal     public.articulacion not null,
  diagnostico_previo         text not null,

  id_medico_tratante         integer not null references public.medicos(id_medico),
  id_fisioterapeuta_asignado integer references public.medicos(id_medico),
  id_medico_registrador      integer references public.medicos(id_medico),

  telefono                   varchar(30),
  email                      varchar(150)
    check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  direccion                  text,
  contacto_emergencia_nombre   varchar(150),
  contacto_emergencia_telefono varchar(30),
  foto_rostro_path           text,

  origen_registro            varchar(30) not null default 'manual'
    check (origen_registro in ('manual', 'ocr_carnet', 'importacion', 'autoregistro')),

  -- En qué punto del tratamiento está. Lo mueve el alta (PASO 22).
  estado_tratamiento         varchar(20) not null default 'en_tratamiento'
    check (estado_tratamiento in ('en_tratamiento', 'de_alta', 'alta_temporal',
                                  'suspendido', 'abandono', 'derivado')),

  fecha_registro             date not null default current_date,
  activo                     boolean not null default true,
  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now(),
  actualizado_por            integer references public.usuarios(id_usuario)
);

-- --- 4. documentos_identidad: lo que deja el OCR del carnet ------------------
-- `id_paciente` va nulo a propósito: se puede escanear el carnet ANTES de
-- crear al paciente.
create table if not exists public.documentos_identidad (
  id_documento       bigint generated always as identity primary key,
  id_paciente        integer references public.pacientes(id_paciente),
  tipo_documento     varchar(30) not null default 'ci'
    check (tipo_documento in ('ci', 'ci_extranjero', 'pasaporte', 'libreta_servicio_militar')),
  numero_documento   varchar(30) not null,
  numero_normalizado text generated always as (public.fn_normalizar_ci(numero_documento)) stored,
  complemento        varchar(5),
  expedido           char(2),
  nombres            varchar(100) not null,
  apellido_paterno   varchar(60),
  apellido_materno   varchar(60),
  fecha_nacimiento   date not null
    check (fecha_nacimiento > '1900-01-01' and fecha_nacimiento < current_date),
  sexo               char(1) check (sexo is null or sexo in ('M', 'F')),
  fecha_emision      date,
  fecha_vencimiento  date,
  foto_rostro_path   text,
  foto_anverso_path  text,
  foto_reverso_path  text,
  metodo_captura     varchar(20) not null default 'ocr'
    check (metodo_captura in ('ocr', 'manual', 'mrz', 'pdf417', 'nfc')),
  confianza_ocr      numeric(4,3) check (confianza_ocr is null or (confianza_ocr between 0 and 1)),
  texto_ocr_crudo    text,
  campos_ocr         jsonb,
  requiere_revision  boolean not null default false,
  verificado_por     integer references public.medicos(id_medico),
  fecha_verificacion timestamptz,
  creado_por         integer references public.medicos(id_medico),
  creado_en          timestamptz not null default now()
);

-- --- 5. fotos_perfil ---------------------------------------------------------
create table if not exists public.fotos_perfil (
  id_usuario      integer primary key references public.usuarios(id_usuario),
  bucket          varchar(50) not null default 'avatares',
  storage_path    text not null,
  mime_type       varchar(50) not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  tamano_bytes    integer not null check (tamano_bytes > 0 and tamano_bytes <= 5242880),
  ancho           smallint,
  alto            smallint,
  origen          varchar(20) not null default 'galeria'
    check (origen in ('galeria', 'camara', 'carnet', 'importacion')),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  actualizado_por integer references public.usuarios(id_usuario)
);

-- --- 6. solicitudes_acceso ---------------------------------------------------
-- Quien entra con Google por primera vez cae aquí, NO en `usuarios`: hasta que
-- el superusuario apruebe, no tiene cuenta. Por eso el tipo y la cédula pueden
-- ir vacíos: los completa el superusuario al aprobar.
create table if not exists public.solicitudes_acceso (
  id_solicitud            integer generated always as identity primary key,
  nombre_completo         varchar(150) not null,
  tipo_profesional        public.tipo_profesional,
  cedula_profesional      varchar(40),
  email                   varchar(150) not null,
  telefono                varchar(30),
  estado                  varchar(20) not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  origen                  varchar(20) not null default 'formulario'
    check (origen in ('formulario', 'google', 'manual')),
  auth_user_id            uuid,
  foto_url                text,
  fecha_solicitud         timestamptz not null default now(),
  id_superusuario_revisor integer references public.usuarios(id_usuario),
  id_usuario_creado       integer references public.usuarios(id_usuario),
  fecha_revision          timestamptz,
  observaciones           text
);

-- Único solo entre las solicitudes vivas: un rechazado SÍ puede volver a pedir.
create unique index if not exists ux_solicitudes_cedula_viva
  on public.solicitudes_acceso (cedula_profesional)
  where estado in ('pendiente', 'aprobada') and cedula_profesional is not null;

create unique index if not exists ux_solicitudes_email_pendiente
  on public.solicitudes_acceso (lower(email)) where estado = 'pendiente';

-- --- 7. planes_tratamiento ---------------------------------------------------
create table if not exists public.planes_tratamiento (
  id_plan                   integer generated always as identity primary key,
  id_paciente               integer not null references public.pacientes(id_paciente),
  id_medico_responsable     integer not null references public.medicos(id_medico),
  objetivo_general          text not null,
  fecha_inicio              date not null default current_date,
  duracion_estimada_semanas smallint not null check (duracion_estimada_semanas > 0),
  fecha_fin_estimada        date generated always as (fecha_inicio + (duracion_estimada_semanas * 7)) stored,
  fecha_fin_real            date,
  categoria_duracion        varchar(30) generated always as (
    case when duracion_estimada_semanas <= 4  then 'un_mes_o_menos'
         when duracion_estimada_semanas <= 12 then 'de_1_a_3_meses'
         else 'mas_de_3_meses' end) stored,
  estado                    varchar(20) not null default 'activo'
    check (estado in ('activo', 'completado', 'suspendido', 'abandonado')),
  observaciones             text,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  actualizado_por           integer references public.usuarios(id_usuario)
);

-- --- 8. ejercicios_catalogo --------------------------------------------------
-- OJO con los dos códigos, que no son lo mismo:
--   · `codigo_fisioclin` -> el código del catálogo de la unidad (ROD-01)
--   · `clase_lstm`       -> las 3 letras que enlazan con la clase del modelo
--                           de reconocimiento (fisioclin_clases.json)
-- Antes eran una sola columna de 3 caracteres y se pisaban los dos usos.
create table if not exists public.ejercicios_catalogo (
  id_ejercicio               integer generated always as identity primary key,
  codigo_fisioclin           varchar(20) unique,
  clase_lstm                 varchar(3),
  nombre                     varchar(150) not null,
  descripcion                text,
  articulacion_objetivo      public.articulacion not null,
  angulo_min_esperado        numeric(5,1) not null,
  angulo_max_esperado        numeric(5,1) not null,
  duracion_estimada_segundos smallint not null default 30,
  id_medico_creador          integer references public.medicos(id_medico),
  activo                     boolean not null default true,

  video_bucket               varchar(50) not null default 'ejercicios-videos',
  video_storage_path         text,
  video_referencia_url       text,
  video_poster_path          text,
  video_nombre_original      varchar(200),
  video_mime_type            varchar(50)
    check (video_mime_type is null or video_mime_type in
           ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/3gpp')),
  video_tamano_bytes         bigint check (video_tamano_bytes is null or
                                (video_tamano_bytes > 0 and video_tamano_bytes <= 104857600)),
  video_duracion_segundos    numeric(6,2),
  video_ancho                smallint,
  video_alto                 smallint,
  video_checksum_sha256      char(64),
  video_estado               varchar(20) not null default 'sin_video'
    check (video_estado in ('sin_video', 'subiendo', 'procesando', 'listo', 'error')),
  video_fecha_subida         timestamptz,
  id_medico_subio_video      integer references public.medicos(id_medico),
  video_disponible           boolean generated always as
                               (video_storage_path is not null or video_referencia_url is not null) stored,

  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now(),
  actualizado_por            integer references public.usuarios(id_usuario)
);

-- --- 9. prescripciones_ejercicio ---------------------------------------------
create table if not exists public.prescripciones_ejercicio (
  id_prescripcion       integer generated always as identity primary key,
  id_paciente           integer not null references public.pacientes(id_paciente),
  id_plan               integer not null references public.planes_tratamiento(id_plan),
  id_ejercicio          integer not null references public.ejercicios_catalogo(id_ejercicio),
  id_medico_prescriptor integer not null references public.medicos(id_medico),
  series                smallint not null default 3,
  repeticiones          smallint not null default 10,
  frecuencia_semanal    smallint not null default 3,
  fecha_inicio          date not null default current_date,
  fecha_fin             date,
  activo                boolean not null default true,
  observaciones         text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       integer references public.usuarios(id_usuario)
);

-- --- 10. sesiones: cada grabación con la cámara ------------------------------
create table if not exists public.sesiones (
  id_sesion                  integer generated always as identity primary key,
  id_paciente                integer not null references public.pacientes(id_paciente),
  id_profesional_supervisor  integer references public.medicos(id_medico),
  id_prescripcion            integer references public.prescripciones_ejercicio(id_prescripcion),
  id_ejercicio               integer references public.ejercicios_catalogo(id_ejercicio),
  ejercicio                  varchar(150) not null,
  fecha_hora                 timestamptz not null default now(),
  duracion_segundos          integer,

  dispositivo_captura        varchar(80),
  resolucion_video           varchar(20) default '1280x720',
  distancia_paciente_metros  numeric(4,2),
  fps_captura                smallint,
  resultado_calibracion      varchar(20)
    check (resultado_calibracion is null or
           resultado_calibracion in ('exitosa', 'fallida', 'requiere_ajuste')),
  id_profesional_calibrador  integer references public.medicos(id_medico),
  fecha_calibracion          timestamptz,
  observaciones_calibracion  text,

  video_paciente_url         text,
  video_storage_path         text,
  frames_totales             integer,
  frames_procesados          integer not null default 0,
  estado                     varchar(20) not null default 'procesando'
    check (estado in ('procesando', 'completada', 'incompleta', 'abandonada', 'error')),
  completado                 boolean not null default false,
  resultado_evaluacion       varchar(20) not null default 'pendiente'
    check (resultado_evaluacion in ('pendiente', 'correcto', 'parcial', 'incorrecto')),
  observaciones              text,
  creado_en                  timestamptz not null default now()
);

-- --- 11. metricas_articulares: lo que midió la cámara ------------------------
create table if not exists public.metricas_articulares (
  id_metrica              integer generated always as identity primary key,
  id_sesion               integer not null references public.sesiones(id_sesion),
  articulacion            public.articulacion not null,
  lado                    varchar(15)
    check (lado is null or lado in ('izquierdo', 'derecho', 'bilateral')),
  angulo_maximo           numeric(5,1) not null,
  angulo_minimo           numeric(5,1) not null,
  rom                     numeric(5,1) generated always as (angulo_maximo - angulo_minimo) stored,
  velocidad_angular_prom  numeric(6,2),
  simetria_bilateral      numeric(5,2),
  clasificacion_limitacion varchar(20) not null default 'sin_clasificar'
    check (clasificacion_limitacion in ('normal', 'leve', 'moderada', 'severa', 'sin_clasificar')),
  landmarks_json          jsonb not null,
  angulos_json            jsonb not null,
  fecha_calculo           timestamptz not null default now(),

  angulo_goniometro       numeric(5,1),
  umbral_clinico_grados   numeric(4,1) not null default 5.0,
  error_absoluto          numeric(5,1) generated always as (abs(angulo_maximo - angulo_goniometro)) stored,
  dentro_umbral_clinico   boolean generated always as
                            (abs(angulo_maximo - angulo_goniometro) <= umbral_clinico_grados) stored,
  id_medico_validador     integer references public.medicos(id_medico),
  fecha_validacion        timestamptz,
  observaciones_validacion text
);

-- --- 12. repeticiones_ejercicio ----------------------------------------------
create table if not exists public.repeticiones_ejercicio (
  id_repeticion          integer generated always as identity primary key,
  id_sesion              integer not null references public.sesiones(id_sesion),
  numero_repeticion      smallint not null check (numero_repeticion > 0),
  angulo_alcanzado       numeric(5,1) not null,
  duracion_segundos      numeric(5,2),
  calidad_ejecucion      varchar(20) not null default 'pendiente'
    check (calidad_ejecucion in ('pendiente', 'correcta', 'parcial', 'dudosa', 'incorrecta')),
  observacion_automatica varchar(200),
  timestamp_inicio       timestamptz,
  timestamp_fin          timestamptz,
  detalle_json           jsonb,
  unique (id_sesion, numero_repeticion)
);

-- --- 13. registro_dolor (EVA 0-10) -------------------------------------------
create table if not exists public.registro_dolor (
  id_registro_dolor integer generated always as identity primary key,
  id_paciente       integer not null references public.pacientes(id_paciente),
  id_sesion         integer references public.sesiones(id_sesion),
  momento           varchar(20) not null
    check (momento in ('antes_sesion', 'despues_sesion', 'independiente')),
  nivel_dolor       smallint not null check (nivel_dolor between 0 and 10),
  articulacion      public.articulacion,
  fecha_registro    timestamptz not null default now(),
  observaciones     text
);

-- --- 14. historial_clinico ---------------------------------------------------
create table if not exists public.historial_clinico (
  id_historial          integer generated always as identity primary key,
  id_paciente           integer not null references public.pacientes(id_paciente),
  id_medico             integer not null references public.medicos(id_medico),
  fecha_registro        timestamptz not null default now(),
  tipo_entrada          varchar(30) not null default 'evolucion'
    check (tipo_entrada in ('evolucion', 'diagnostico', 'indicacion', 'cambio_tratamiento',
                            'observacion_general', 'radiografia', 'estudio',
                            'evaluacion_inicial', 'evaluacion_final', 'alta_medica')),
  titulo                varchar(200) not null,
  contenido             text not null,
  id_sesion_relacionada integer references public.sesiones(id_sesion),
  visible_para_paciente boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       integer references public.usuarios(id_usuario)
);

-- --- 15. notificaciones ------------------------------------------------------
-- `id_usuario` puede ir vacío: un paciente sin cuenta en la app igual tiene
-- que poder recibir el aviso en su ficha.
create table if not exists public.notificaciones (
  id_notificacion integer generated always as identity primary key,
  id_usuario      integer references public.usuarios(id_usuario),
  id_paciente     integer references public.pacientes(id_paciente),
  id_remitente    integer references public.usuarios(id_usuario),
  tipo            varchar(40) not null
    check (tipo in ('recordatorio_sesion', 'alerta_clinica', 'acceso_aprobado', 'acceso_rechazado',
                    'nueva_prescripcion', 'nueva_nota_clinica', 'sistema',
                    'cita_programada', 'cita_reprogramada', 'cita_cancelada', 'cita_incumplida',
                    'mensaje_profesional', 'mensaje_medico', 'dolor_alto', 'tecnica_deficiente',
                    'sesion_evaluada', 'adherencia_baja', 'solicitud_acceso')),
  categoria       varchar(20) not null default 'sistema'
    check (categoria in ('sistema', 'adherencia', 'dolor', 'tecnica', 'prescripcion',
                         'documento', 'video', 'mensaje', 'cita', 'clinico')),
  severidad       varchar(20) not null default 'info'
    check (severidad in ('info', 'aviso', 'alerta')),
  titulo          varchar(200) not null,
  mensaje         text not null,
  accion_ruta     text,
  clave_evento    text,
  leida           boolean not null default false,
  fecha_creacion  timestamptz not null default now(),
  fecha_lectura   timestamptz,
  enviada_push    boolean not null default false,
  fecha_push      timestamptz,
  constraint notificaciones_destino_check check (id_usuario is not null or id_paciente is not null)
);

create unique index if not exists ux_notif_clave_evento
  on public.notificaciones (clave_evento) where clave_evento is not null;

-- --- 16. dispositivos_push ---------------------------------------------------
create table if not exists public.dispositivos_push (
  id_dispositivo bigint generated always as identity primary key,
  id_usuario     integer not null references public.usuarios(id_usuario),
  token_expo     text not null unique,
  plataforma     varchar(15) not null default 'android'
    check (plataforma in ('android', 'ios', 'web')),
  activo         boolean not null default true,
  ultimo_uso     timestamptz not null default now(),
  creado_en      timestamptz not null default now()
);

-- --- 17. reportes_generados --------------------------------------------------
create table if not exists public.reportes_generados (
  id_reporte          integer generated always as identity primary key,
  id_paciente         integer references public.pacientes(id_paciente),
  id_medico_generador integer not null references public.medicos(id_medico),
  tipo_reporte        varchar(20) not null default 'individual'
    check (tipo_reporte in ('individual', 'general', 'usuarios', 'profesionales',
                            'evaluaciones', 'adherencia', 'auditoria')),
  rango_fecha_inicio  date,
  rango_fecha_fin     date,
  ruta_archivo_pdf    text not null,
  fecha_generacion    timestamptz not null default now()
);

-- --- 18. citas ---------------------------------------------------------------
create table if not exists public.citas (
  id_cita              integer generated always as identity primary key,
  id_paciente          integer not null references public.pacientes(id_paciente),
  id_medico            integer not null references public.medicos(id_medico),
  id_plan              integer references public.planes_tratamiento(id_plan),
  fecha_hora           timestamptz not null,
  duracion_minutos     smallint not null default 45 check (duracion_minutos between 5 and 480),
  tipo                 varchar(30) not null default 'control'
    check (tipo in ('control', 'evaluacion_inicial', 'terapia', 'reevaluacion', 'alta')),
  modalidad            varchar(20) not null default 'presencial'
    check (modalidad in ('presencial', 'domiciliaria', 'remota')),
  motivo               varchar(200),
  lugar                varchar(150) default 'Unidad de Medicina Física y Rehabilitación - COSSMIL',
  indicaciones         text,
  estado               varchar(20) not null default 'programada'
    check (estado in ('programada', 'confirmada', 'cumplida', 'ausente', 'cancelada', 'reprogramada')),
  id_sesion_resultante integer references public.sesiones(id_sesion),
  observaciones_cierre text,
  recordatorio_enviado boolean not null default false,
  creada_por           integer references public.usuarios(id_usuario),
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  actualizado_por      integer references public.usuarios(id_usuario),

  -- Hora de fin de la cita. Es una columna normal y no calculada a propósito:
  -- sumarle un intervalo a una fecha CON ZONA HORARIA no es "inmutable" para
  -- Postgres (el resultado cambia según la zona), y un índice exige que lo
  -- sea. Por eso la calcula un trigger y se guarda ya resuelta.
  fecha_fin            timestamptz
);

-- Rellena `fecha_fin` sola, para que nadie tenga que acordarse.
create or replace function public.fn_fin_de_cita()
returns trigger language plpgsql as $fn$
begin
  new.fecha_fin := new.fecha_hora + make_interval(mins => new.duracion_minutos);
  return new;
end $fn$;

drop trigger if exists trg_fin_de_cita on public.citas;
create trigger trg_fin_de_cita
  before insert or update of fecha_hora, duracion_minutos on public.citas
  for each row execute function public.fn_fin_de_cita();

-- Y ahora sí: dos citas del mismo médico a la misma hora son imposibles.
alter table public.citas drop constraint if exists citas_sin_solape;
alter table public.citas add constraint citas_sin_solape
  exclude using gist (
    id_medico with =,
    tstzrange(fecha_hora, fecha_fin) with &&
  ) where (estado in ('programada', 'confirmada'));

-- --- 19. preferencias_usuario (accesibilidad de la app del paciente) ---------
create table if not exists public.preferencias_usuario (
  id_usuario            integer primary key references public.usuarios(id_usuario),
  tamano_letra          varchar(15) not null default 'normal'
    check (tamano_letra in ('pequena', 'normal', 'grande', 'muy_grande')),
  alto_contraste        boolean not null default false,
  tema                  varchar(15) not null default 'claro'
    check (tema in ('claro', 'oscuro', 'sistema')),
  audio_guia            boolean not null default true,
  audio_correccion      boolean not null default true,
  audio_conteo          boolean not null default true,
  volumen               smallint not null default 80 check (volumen between 0 and 100),
  voz                   varchar(30) not null default 'es-BO',
  velocidad_voz         numeric(3,2) not null default 1.00 check (velocidad_voz between 0.5 and 2.0),
  vibracion             boolean not null default true,
  notificaciones_push   boolean not null default true,
  recordatorio_diario   boolean not null default true,
  hora_recordatorio     time not null default '09:00',
  idioma                varchar(5) not null default 'es'
    check (idioma in ('es', 'ay', 'qu', 'en')),
  actualizado_en        timestamptz not null default now()
);

-- --- 20. bitacora_auditoria --------------------------------------------------
create table if not exists public.bitacora_auditoria (
  id_evento     bigint generated always as identity primary key,
  id_usuario    integer references public.usuarios(id_usuario),
  rol           text,
  accion        varchar(30) not null
    check (accion in ('insert', 'update', 'delete', 'login', 'logout', 'rpc', 'acceso_denegado',
                      'revision_alertas', 'aprobacion_acceso', 'rechazo_acceso', 'cambio_permisos',
                      'recuperacion_password', 'cambio_password', 'reset_forzado', 'login_bloqueado')),
  tabla         varchar(60) not null,
  id_registro   text,
  datos_antes   jsonb,
  datos_despues jsonb,
  detalle       text,
  fecha         timestamptz not null default now()
);


-- ============================================================================
--  FIN DE LA PARTE A. Las 20 tablas base ya existen.
--  Lo que sigue crea las 8 tablas nuevas y todo el resto del sistema.
-- ============================================================================


-- ============================================================================
--  PASO 0.A — Extensiones y esquema de ayuda
-- ============================================================================
create extension if not exists btree_gist;
create schema if not exists app;


-- ============================================================================
--  PASO 0.A — Funciones de ayuda para poder modificar la base sin conocer
--             los nombres internos que Postgres le puso a cada restricción.
-- ============================================================================

-- Borra los CHECK que afectan a UNA sola columna de una tabla.
create or replace function public.fn_soltar_checks(p_tabla regclass, p_columna text)
returns void language plpgsql as $fn$
declare
  v_attnum smallint;
  c record;
begin
  select attnum into v_attnum
    from pg_attribute
   where attrelid = p_tabla and attname = p_columna and not attisdropped;
  if v_attnum is null then return; end if;

  for c in
    select conname from pg_constraint
     where conrelid = p_tabla and contype = 'c'
       and conkey = array[v_attnum]::smallint[]
  loop
    execute format('alter table %s drop constraint %I', p_tabla::text, c.conname);
  end loop;
end $fn$;

-- Agrega valores a un ENUM sin saber cómo se llama el tipo: lo deduce
-- mirando la columna.
create or replace function public.fn_agregar_valores_enum(
  p_tabla regclass, p_columna text, p_valores text[])
returns void language plpgsql as $fn$
declare
  v_tipo regtype;
  v text;
begin
  select atttypid::regtype into v_tipo
    from pg_attribute
   where attrelid = p_tabla and attname = p_columna and not attisdropped;
  if v_tipo is null then return; end if;

  foreach v in array p_valores loop
    begin
      execute format('alter type %s add value if not exists %L', v_tipo::text, v);
    exception when others then
      raise notice 'No se pudo agregar el valor "%" a %: %', v, v_tipo::text, sqlerrm;
    end;
  end loop;
end $fn$;

-- Normalizador de CI. Si tu base ya lo tiene, se respeta el que está:
-- las columnas generadas de `pacientes` dependen de él y cambiarlo las rompe.
do $ci$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'fn_normalizar_ci') then
    execute $crea$
      create function public.fn_normalizar_ci(p_texto text)
      returns text language sql immutable as $cuerpo$
        select nullif(upper(regexp_replace(coalesce(p_texto, ''), '[^0-9A-Za-z]', '', 'g')), '')
      $cuerpo$;
    $crea$;
  end if;
end $ci$;

-- Quita tildes y pasa a minúsculas. Sirve para aceptar "Evaluación" y
-- guardarlo como "evaluacion".
create or replace function public.fn_sin_tildes(p_texto text)
returns text language sql immutable as $fn$
  select lower(translate(coalesce(p_texto, ''), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))
$fn$;


-- ¿Qué valores le faltan a una lista cerrada (ENUM)?
-- Si la columna no es una lista cerrada sino texto libre, devuelve vacío.
create or replace function public.fn_faltan_valores_enum(
  p_tabla regclass, p_columna text, p_valores text[])
returns text[] language plpgsql stable as $fn$
declare
  v_tipo    oid;
  v_es_enum boolean;
  v_faltan  text[];
begin
  select a.atttypid into v_tipo
    from pg_attribute a
   where a.attrelid = p_tabla and a.attname = p_columna and not a.attisdropped;
  if v_tipo is null then return array[]::text[]; end if;

  select t.typtype = 'e' into v_es_enum from pg_type t where t.oid = v_tipo;
  if not v_es_enum then return array[]::text[]; end if;

  select coalesce(array_agg(v), array[]::text[]) into v_faltan
    from unnest(p_valores) v
   where not exists (select 1 from pg_enum e where e.enumtypid = v_tipo and e.enumlabel = v);

  return v_faltan;
end $fn$;


-- ============================================================================
--  PASO 0.B — LISTAS CERRADAS (ENUM)
--  ---------------------------------------------------------------------------
--  Tu base usa tres listas cerradas y yo no puedo ver qué valores tienen.
--  Aquí se agregan todos los que el panel necesita. Si ya existían, no pasa
--  nada: se ignoran.
--
--  Por esto mismo los datos van en un archivo aparte: Postgres NO deja
--  agregar un valor a una lista y usarlo en la misma corrida. Al estar
--  separados, cuando corras el archivo B los valores ya están guardados.
-- ============================================================================

select public.fn_agregar_valores_enum('public.usuarios', 'rol',
  array['superusuario', 'medico_fisiatra', 'fisioterapeuta', 'paciente']);

select public.fn_agregar_valores_enum('public.medicos', 'tipo_profesional',
  array['medico_fisiatra', 'fisioterapeuta']);

select public.fn_agregar_valores_enum('public.solicitudes_acceso', 'tipo_profesional',
  array['medico_fisiatra', 'fisioterapeuta']);

select public.fn_agregar_valores_enum('public.pacientes', 'articulacion_principal',
  array['rodilla', 'cadera', 'tobillo', 'pie', 'hombro', 'codo', 'columna',
        'muneca', 'cuello']);

select public.fn_agregar_valores_enum('public.ejercicios_catalogo', 'articulacion_objetivo',
  array['rodilla', 'cadera', 'tobillo', 'pie', 'hombro', 'codo', 'columna',
        'muneca', 'cuello']);

select public.fn_agregar_valores_enum('public.registro_dolor', 'articulacion',
  array['rodilla', 'cadera', 'tobillo', 'pie', 'hombro', 'codo', 'columna',
        'muneca', 'cuello']);


-- ============================================================================
--  PASO 1 — LOS 8 CHOQUES. Aquí se arreglan uno por uno.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CHOQUE 1 y 2 — notificaciones.tipo y notificaciones.categoria
--   El panel escribe: mensaje_medico, dolor_alto, tecnica_deficiente,
--   sesion_evaluada, y la categoría "clinico". La base los rechazaba.
-- ---------------------------------------------------------------------------
select public.fn_soltar_checks('public.notificaciones', 'tipo');
select public.fn_soltar_checks('public.notificaciones', 'categoria');

update public.notificaciones set tipo = lower(tipo), categoria = lower(categoria);

alter table public.notificaciones
  add constraint notificaciones_tipo_check check (tipo in (
    'recordatorio_sesion', 'alerta_clinica', 'acceso_aprobado', 'acceso_rechazado',
    'nueva_prescripcion', 'nueva_nota_clinica', 'sistema',
    'cita_programada', 'cita_reprogramada', 'cita_cancelada', 'cita_incumplida',
    'mensaje_profesional',
    -- nuevos, los que usa el panel del médico:
    'mensaje_medico', 'dolor_alto', 'tecnica_deficiente', 'sesion_evaluada',
    'adherencia_baja', 'solicitud_acceso'
  ));

alter table public.notificaciones
  add constraint notificaciones_categoria_check check (categoria in (
    'sistema', 'adherencia', 'dolor', 'tecnica', 'prescripcion',
    'documento', 'video', 'mensaje', 'cita',
    -- nuevo:
    'clinico'
  ));

-- ---------------------------------------------------------------------------
-- CHOQUE 3 — notificaciones.id_usuario era NOT NULL
--   Un paciente sin cuenta no tenía a quién notificar y el INSERT reventaba.
--   Ahora puede ir nulo, pero exige que al menos haya usuario o paciente.
-- ---------------------------------------------------------------------------
alter table public.notificaciones alter column id_usuario drop not null;

alter table public.notificaciones drop constraint if exists notificaciones_destino_check;
alter table public.notificaciones
  add constraint notificaciones_destino_check
  check (id_usuario is not null or id_paciente is not null);

-- Además: saber QUIÉN mandó el aviso (antes no se guardaba).
alter table public.notificaciones
  add column if not exists id_remitente integer references public.usuarios(id_usuario);

-- ---------------------------------------------------------------------------
-- CHOQUE 4 — registro_dolor.momento
--   El panel manda "antes" / "despues"; la base exige "antes_sesion".
--   Se arregla con un trigger que traduce solo, sin tocar el panel.
-- ---------------------------------------------------------------------------
create or replace function public.fn_norm_momento_dolor()
returns trigger language plpgsql as $fn$
begin
  new.momento := case public.fn_sin_tildes(new.momento)
    when 'antes'   then 'antes_sesion'
    when 'despues' then 'despues_sesion'
    when 'durante' then 'independiente'
    else public.fn_sin_tildes(new.momento)
  end;
  return new;
end $fn$;

drop trigger if exists trg_norm_momento_dolor on public.registro_dolor;
create trigger trg_norm_momento_dolor
  before insert or update on public.registro_dolor
  for each row execute function public.fn_norm_momento_dolor();

-- ---------------------------------------------------------------------------
-- CHOQUE 5 — historial_clinico.tipo_entrada
--   Faltaban "radiografia" y "estudio", y el panel manda las etiquetas con
--   mayúscula y tilde ("Evaluación"). Se agregan valores + traductor.
-- ---------------------------------------------------------------------------
select public.fn_soltar_checks('public.historial_clinico', 'tipo_entrada');

create or replace function public.fn_norm_tipo_historial()
returns trigger language plpgsql as $fn$
begin
  new.tipo_entrada := case public.fn_sin_tildes(new.tipo_entrada)
    when 'evaluacion'  then 'diagnostico'
    when 'control'     then 'observacion_general'
    when 'observacion' then 'observacion_general'
    else public.fn_sin_tildes(new.tipo_entrada)
  end;
  return new;
end $fn$;

drop trigger if exists trg_norm_tipo_historial on public.historial_clinico;
create trigger trg_norm_tipo_historial
  before insert or update on public.historial_clinico
  for each row execute function public.fn_norm_tipo_historial();

alter table public.historial_clinico
  add constraint historial_clinico_tipo_entrada_check check (tipo_entrada in (
    'evolucion', 'diagnostico', 'indicacion', 'cambio_tratamiento',
    'observacion_general',
    -- nuevos, los que ofrece el panel:
    'radiografia', 'estudio'
  ));

-- ---------------------------------------------------------------------------
-- CHOQUE 6 — bitacora_auditoria.accion
--   El panel muestra INSERT / UPDATE / REVISION_ALERTAS en mayúsculas.
-- ---------------------------------------------------------------------------
select public.fn_soltar_checks('public.bitacora_auditoria', 'accion');

update public.bitacora_auditoria set accion = lower(accion);

create or replace function public.fn_norm_accion_bitacora()
returns trigger language plpgsql as $fn$
begin
  new.accion := lower(new.accion);
  return new;
end $fn$;

drop trigger if exists trg_norm_accion_bitacora on public.bitacora_auditoria;
create trigger trg_norm_accion_bitacora
  before insert or update on public.bitacora_auditoria
  for each row execute function public.fn_norm_accion_bitacora();

alter table public.bitacora_auditoria
  add constraint bitacora_auditoria_accion_check check (accion in (
    'insert', 'update', 'delete', 'login', 'logout', 'rpc', 'acceso_denegado',
    'revision_alertas', 'aprobacion_acceso', 'rechazo_acceso', 'cambio_permisos'
  ));

-- ---------------------------------------------------------------------------
-- CHOQUE 7 — pacientes.grado_artrosis_kl solo aceptaba 2 y 3
--   El estudio se centra en grados 2 y 3, pero la base no debe reventar si
--   llega un 1 o un 4: se marca aparte con "dentro_del_estudio".
-- ---------------------------------------------------------------------------
select public.fn_soltar_checks('public.pacientes', 'grado_artrosis_kl');

alter table public.pacientes
  add constraint pacientes_grado_artrosis_kl_check
  check (grado_artrosis_kl between 0 and 4);

alter table public.pacientes
  add column if not exists dentro_del_estudio boolean
  generated always as (grado_artrosis_kl in (2, 3)) stored;

-- ---------------------------------------------------------------------------
-- CHOQUE 8 — pacientes.email NO EXISTÍA
--   El formulario de alta lo pide y la ficha lo muestra.
-- ---------------------------------------------------------------------------
alter table public.pacientes add column if not exists email varchar(150);

-- ---------------------------------------------------------------------------
-- EXTRA — ¿PARA QUÉ MÉDICO SE ESTÁ REGISTRANDO ESTE PACIENTE?
--   El superusuario no atiende pacientes: no tiene ficha en `medicos`. Por eso
--   cuando ÉL registra a alguien hay que decirle a qué médico se lo asigna.
--
--   Este trigger resuelve las tres situaciones:
--     · lo registra un médico  -> el registrador es él mismo
--     · lo registra el super   -> el registrador es el médico tratante elegido
--     · no se eligió tratante  -> se rechaza con un mensaje claro
-- ---------------------------------------------------------------------------
create or replace function public.fn_completar_registrador()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_yo integer := app.id_medico();
begin
  if new.id_medico_tratante is null then
    raise exception 'Falta elegir el médico tratante del paciente.';
  end if;

  if new.id_medico_registrador is null then
    new.id_medico_registrador := coalesce(v_yo, new.id_medico_tratante);
  end if;

  -- El fisioterapeuta asignado tiene que ser realmente fisioterapeuta, y el
  -- tratante un médico. Si no, se cruzan los roles sin que nadie se entere.
  if new.id_fisioterapeuta_asignado is not null then
    if not exists (select 1 from public.medicos
                    where id_medico = new.id_fisioterapeuta_asignado
                      and tipo_profesional::text = 'fisioterapeuta') then
      raise exception 'El fisioterapeuta asignado no es un fisioterapeuta.';
    end if;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_completar_registrador on public.pacientes;
create trigger trg_completar_registrador
  before insert or update of id_medico_tratante, id_fisioterapeuta_asignado
  on public.pacientes
  for each row execute function public.fn_completar_registrador();

-- Ya no es obligatorio mandarlo: el trigger lo completa.
alter table public.pacientes alter column id_medico_registrador drop not null;

-- Mismo motivo en el catálogo: el superusuario no tiene ficha de médico, así
-- que "quién creó el ejercicio" puede ir vacío cuando lo crea él.
alter table public.ejercicios_catalogo alter column id_medico_creador drop not null;

-- Lista de profesionales para el selector "¿de qué médico es este paciente?".
-- Es una vista aparte para que el panel no tenga que leer la tabla `usuarios`.
-- `avatar_bucket`/`avatar_path` van AL FINAL de la lista a propósito: un
-- `create or replace view` en una base que ya tiene esta vista solo admite
-- AGREGAR columnas al final, no insertarlas en el medio — si no, falla con
-- "cannot change name of view column" contra una base ya desplegada.
create or replace view public.vista_profesionales as
select
  m.id_medico,
  m.nombre_completo,
  m.tipo_profesional::text as tipo_profesional,
  m.especialidad,
  m.cedula_profesional,
  m.consultorio,
  u.activo,
  (select count(*) from public.pacientes p
    where p.id_medico_tratante = m.id_medico and p.activo) as pacientes_a_cargo,
  fp.bucket       as avatar_bucket,
  fp.storage_path as avatar_path
from public.medicos m
join public.usuarios u on u.id_usuario = m.id_usuario
left join public.fotos_perfil fp on fp.id_usuario = m.id_usuario
where u.activo
order by m.tipo_profesional, m.nombre_completo;

alter table public.pacientes drop constraint if exists pacientes_email_check;
alter table public.pacientes
  add constraint pacientes_email_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$');


-- ============================================================================
--  PASO 2 — TABLAS NUEVAS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1  catalogo_modulos
--      La lista oficial de módulos. Antes `modulos_permitidos` era texto libre
--      y un error de tipeo apagaba un módulo sin que nadie se enterara.
-- ---------------------------------------------------------------------------
create table if not exists public.catalogo_modulos (
  clave               varchar(40) primary key,
  etiqueta            varchar(80) not null,
  grupo               varchar(40) not null default 'General',
  orden               smallint    not null default 0,
  solo_superusuario   boolean     not null default false,
  por_defecto_medico  boolean     not null default true,
  por_defecto_fisio   boolean     not null default true,
  activo              boolean     not null default true
);

-- ---------------------------------------------------------------------------
-- 4.2  adjuntos_clinicos
--      Radiografías, estudios, fotos y PDF del paciente (hasta 15 MB).
--      El panel ya tiene la pantalla; no había dónde guardarlos.
-- ---------------------------------------------------------------------------
create table if not exists public.adjuntos_clinicos (
  id_adjunto       bigint generated always as identity primary key,
  id_paciente      integer not null references public.pacientes(id_paciente),
  id_historial     integer references public.historial_clinico(id_historial) on delete cascade,
  bucket           varchar(50)  not null default 'adjuntos-clinicos',
  storage_path     text         not null,
  nombre_original  varchar(200) not null,
  -- Nombre que el equipo le pone desde el visor ("Rodilla derecha, control
  -- de marzo"). `nombre_original` no se toca: es el nombre real del archivo
  -- que se subió, y sirve de respaldo si nadie lo renombró.
  nombre_visible   varchar(200),
  mime_type        varchar(100) not null
    check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','application/pdf')),
  tamano_bytes     integer      not null check (tamano_bytes > 0 and tamano_bytes <= 15728640),
  tipo_estudio     varchar(30)  not null default 'otro'
    check (tipo_estudio in ('radiografia','resonancia','tomografia','ecografia','laboratorio','informe','foto','otro')),
  descripcion      text,
  subido_por       integer references public.medicos(id_medico),
  creado_en        timestamptz  not null default now(),
  unique (bucket, storage_path)
);

-- ---------------------------------------------------------------------------
-- 4.3  mensajes
--      Conversación real médico <-> paciente y médico <-> médico.
--      Antes se forzaba dentro de `notificaciones`, que no tiene remitente
--      ni permite responder.
-- ---------------------------------------------------------------------------
create table if not exists public.mensajes (
  id_mensaje        bigint generated always as identity primary key,
  id_remitente      integer not null references public.usuarios(id_usuario),
  id_destinatario   integer references public.usuarios(id_usuario),
  id_paciente       integer references public.pacientes(id_paciente),
  id_respuesta_a    bigint  references public.mensajes(id_mensaje),
  asunto            varchar(150) not null,
  cuerpo            text         not null,
  severidad         varchar(20)  not null default 'info'
    check (severidad in ('info','aviso','alerta')),
  canal             varchar(20)  not null default 'panel'
    check (canal in ('panel','app','push','email')),
  leido             boolean      not null default false,
  fecha_lectura     timestamptz,
  creado_en         timestamptz  not null default now(),
  constraint mensajes_destino_check check (id_destinatario is not null or id_paciente is not null)
);

-- ---------------------------------------------------------------------------
-- 4.4  consentimiento_informado
--      Obligatorio para tratar datos clínicos reales y para la tesis.
-- ---------------------------------------------------------------------------
create table if not exists public.consentimiento_informado (
  id_consentimiento bigint generated always as identity primary key,
  id_paciente       integer not null references public.pacientes(id_paciente),
  version           varchar(20) not null default '1.0',
  acepta_tratamiento    boolean not null default false,
  acepta_grabacion_video boolean not null default false,
  acepta_uso_investigacion boolean not null default false,
  metodo            varchar(20) not null default 'firma_fisica'
    check (metodo in ('firma_fisica','firma_digital','app')),
  archivo_bucket    varchar(50),
  archivo_path      text,
  fecha_aceptacion  timestamptz not null default now(),
  registrado_por    integer references public.medicos(id_medico),
  observaciones     text
);

-- ---------------------------------------------------------------------------
-- 4.5  intentos_login
--      Para poder bloquear tras varios intentos fallidos y para auditar.
-- ---------------------------------------------------------------------------
create table if not exists public.intentos_login (
  id_intento   bigint generated always as identity primary key,
  identificador varchar(150) not null,   -- usuario o correo tecleado
  exito        boolean not null,
  motivo       varchar(80),
  ip           inet,
  user_agent   text,
  fecha        timestamptz not null default now()
);


-- ============================================================================
--  PASO 3 — SOLICITUDES DE ACCESO: preparadas para el alta con Google
-- ============================================================================

-- El registro con Google llega SIN cédula y SIN tipo profesional: eso lo
-- completa el superusuario al aprobar. Por eso dejan de ser obligatorios.
alter table public.solicitudes_acceso alter column tipo_profesional   drop not null;
alter table public.solicitudes_acceso alter column cedula_profesional drop not null;

-- El UNIQUE total impedía que un rechazado volviera a solicitar NUNCA.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.solicitudes_acceso'::regclass and contype = 'u'
  loop
    execute format('alter table public.solicitudes_acceso drop constraint %I', c.conname);
  end loop;
end $$;

-- Único solo entre las que siguen vivas: un rechazado sí puede volver a pedir.
create unique index if not exists ux_solicitudes_cedula_viva
  on public.solicitudes_acceso (cedula_profesional)
  where estado in ('pendiente', 'aprobada') and cedula_profesional is not null;

create unique index if not exists ux_solicitudes_email_pendiente
  on public.solicitudes_acceso (lower(email))
  where estado = 'pendiente';

alter table public.solicitudes_acceso
  add column if not exists auth_user_id     uuid,
  add column if not exists origen           varchar(20) not null default 'formulario',
  add column if not exists id_usuario_creado integer references public.usuarios(id_usuario),
  add column if not exists foto_url         text;

alter table public.solicitudes_acceso drop constraint if exists solicitudes_origen_check;
alter table public.solicitudes_acceso
  add constraint solicitudes_origen_check check (origen in ('formulario','google','manual'));


-- ============================================================================
--  PASO 4 — BUCKETS DE ARCHIVOS (fotos, videos, adjuntos)
--  Aquí se responde tu pregunta de los videos: el límite queda en 100 MB.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatares', 'avatares', false, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic']),

  ('ejercicios-videos', 'ejercicios-videos', false, 104857600,   -- 100 MB
   array['video/mp4','video/quicktime','video/webm','video/x-matroska','video/3gpp']),

  ('adjuntos-clinicos', 'adjuntos-clinicos', false, 15728640,   -- 15 MB
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),

  ('videos-sesiones', 'videos-sesiones', false, 104857600,   -- 100 MB
   array['video/mp4','video/quicktime','video/webm']),

  ('documentos-identidad', 'documentos-identidad', false, 5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================================
--  PASO 5 — QUIÉN SOY: funciones que responden sobre el usuario conectado
-- ============================================================================

create or replace function app.id_usuario() returns integer
language sql stable security definer set search_path = public as $fn$
  select u.id_usuario from public.usuarios u
   where u.auth_user_id = auth.uid() and u.activo limit 1;
$fn$;

create or replace function app.rol() returns text
language sql stable security definer set search_path = public as $fn$
  select u.rol::text from public.usuarios u
   where u.auth_user_id = auth.uid() and u.activo limit 1;
$fn$;

create or replace function app.es_super() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(app.rol() = 'superusuario', false);
$fn$;

create or replace function app.id_medico() returns integer
language sql stable security definer set search_path = public as $fn$
  select m.id_medico from public.medicos m
   where m.id_usuario = app.id_usuario() limit 1;
$fn$;

-- ¿Este paciente es visible para quien está conectado?
create or replace function app.paciente_visible(p_id_paciente integer) returns boolean
language sql stable security definer set search_path = public as $fn$
  select app.es_super()
      or exists (
        select 1 from public.pacientes p
         where p.id_paciente = p_id_paciente
           and ( p.id_medico_tratante          = app.id_medico()
              or p.id_fisioterapeuta_asignado  = app.id_medico()
              or p.id_medico_registrador       = app.id_medico()
              or p.id_usuario                  = app.id_usuario() ));
$fn$;


-- ============================================================================
--  PASO 6 — PERMISOS POR MÓDULO
-- ============================================================================

create or replace function public.fn_permisos(p_id_usuario integer) returns jsonb
language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_object_agg(cm.clave,
    case
      when u.rol::text = 'paciente'                then false  -- no entra al panel
      when u.rol::text = 'superusuario'            then true
      when cm.solo_superusuario                    then false
      when jsonb_typeof(u.modulos_permitidos -> cm.clave) = 'boolean'
                                                   then (u.modulos_permitidos -> cm.clave)::text::boolean
      when u.rol::text = 'fisioterapeuta'          then cm.por_defecto_fisio
      else cm.por_defecto_medico
    end), '{}'::jsonb)
  from public.usuarios u
  cross join public.catalogo_modulos cm
  where u.id_usuario = p_id_usuario and cm.activo;
$fn$;

-- Solo el superusuario puede cambiar permisos, y solo con claves válidas.
create or replace function public.fn_definir_modulos(p_id_usuario integer, p_modulos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  k text;
  v_antes jsonb;
begin
  if not app.es_super() then
    raise exception 'Solo el superusuario puede cambiar permisos';
  end if;

  for k in select jsonb_object_keys(p_modulos) loop
    if not exists (select 1 from public.catalogo_modulos where clave = k) then
      raise exception 'El módulo "%" no existe en catalogo_modulos', k;
    end if;
  end loop;

  select modulos_permitidos into v_antes from public.usuarios where id_usuario = p_id_usuario;

  update public.usuarios
     set modulos_permitidos = coalesce(modulos_permitidos, '{}'::jsonb) || p_modulos,
         actualizado_por    = app.id_usuario()
   where id_usuario = p_id_usuario;

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, datos_antes, datos_despues, detalle)
  values (app.id_usuario(), app.rol(), 'cambio_permisos', 'usuarios', p_id_usuario::text,
          jsonb_build_object('modulos', v_antes), jsonb_build_object('modulos', p_modulos),
          'Cambio de módulos permitidos');

  return public.fn_permisos(p_id_usuario);
end $fn$;


-- ============================================================================
--  PASO 7 — LOGIN
--  ---------------------------------------------------------------------------
--  Cómo queda el ingreso:
--
--   A) MÉDICO YA ACEPTADO -> usuario + contraseña
--      El panel llama a fn_email_de_usuario('dr.martin') para traducir el
--      usuario a correo, y luego hace el login normal de Supabase.
--
--   B) REGISTRO CON GOOGLE -> no entra de una
--      Al entrar con Google por primera vez NO se crea usuario: se crea una
--      SOLICITUD pendiente. El panel le muestra "tu solicitud está en revisión".
--      Cuando el superusuario la aprueba, ya entra solo con su Google.
-- ============================================================================

-- --- A) traducir usuario -> correo (para el login con contraseña) ----------
create or replace function public.fn_email_de_usuario(p_identificador text)
returns text language sql stable security definer set search_path = public as $fn$
  select u.email
    from public.usuarios u
   where u.activo
     and ( lower(u.nombre_usuario) = lower(trim(p_identificador))
        or lower(u.email)          = lower(trim(p_identificador)) )
   limit 1;
$fn$;

-- --- B) alguien entra por primera vez con Google ---------------------------
create or replace function public.fn_auth_usuario_nuevo()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario integer;
  v_nombre     text;
begin
  -- ¿Ya existe un usuario con ese correo? (el superusuario lo dio de alta antes)
  select id_usuario into v_id_usuario
    from public.usuarios where lower(email) = lower(new.email);

  if v_id_usuario is not null then
    update public.usuarios
       set auth_user_id = new.id
     where id_usuario = v_id_usuario and auth_user_id is null;
    return new;
  end if;

  -- No existe: NO se le crea cuenta. Se abre una solicitud pendiente.
  v_nombre := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1));

  insert into public.solicitudes_acceso
    (nombre_completo, email, estado, origen, auth_user_id, foto_url, observaciones)
  values
    (v_nombre, new.email, 'pendiente', 'google', new.id,
     new.raw_user_meta_data ->> 'avatar_url',
     'Alta automática al entrar con Google. Falta asignar tipo profesional y cédula.')
  on conflict do nothing;

  -- Avisar a todos los superusuarios.
  insert into public.notificaciones (id_usuario, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  select s.id_usuario, 'solicitud_acceso', 'sistema', 'aviso',
         'Nueva solicitud de acceso',
         v_nombre || ' (' || new.email || ') pidió acceso con Google.',
         '/solicitudes'
    from public.usuarios s
   where s.rol::text = 'superusuario' and s.activo;

  return new;
end $fn$;

drop trigger if exists trg_auth_usuario_nuevo on auth.users;
create trigger trg_auth_usuario_nuevo
  after insert on auth.users
  for each row execute function public.fn_auth_usuario_nuevo();

-- --- Estado de mi solicitud (para el que entró con Google y aún no tiene cuenta)
create or replace function public.fn_estado_solicitud()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select jsonb_build_object(
        'estado', s.estado, 'fecha', s.fecha_solicitud,
        'observaciones', s.observaciones, 'nombre', s.nombre_completo)
       from public.solicitudes_acceso s
      where s.auth_user_id = auth.uid()
      order by s.fecha_solicitud desc limit 1),
    jsonb_build_object('estado', 'sin_solicitud'));
$fn$;

-- --- La sesión que el panel lee al arrancar --------------------------------
create or replace view public.vista_sesion_actual as
select
  u.id_usuario,
  u.auth_user_id,
  u.nombre_usuario,
  u.email,
  u.rol::text            as nombre_rol,
  u.activo,
  u.debe_cambiar_password,
  u.ultimo_acceso,
  public.fn_permisos(u.id_usuario) as permissions,
  m.id_medico,
  m.nombre_completo,
  m.tipo_profesional::text as tipo_profesional,
  m.especialidad,
  m.unidad,
  m.consultorio,
  m.horario_atencion,
  fp.bucket              as avatar_bucket,
  fp.storage_path        as avatar_path,
  to_jsonb(pu.*) - 'id_usuario' as preferencias
from public.usuarios u
left join public.medicos m             on m.id_usuario  = u.id_usuario
left join public.fotos_perfil fp       on fp.id_usuario = u.id_usuario
left join public.preferencias_usuario pu on pu.id_usuario = u.id_usuario
where u.auth_user_id = auth.uid()
  and u.activo
  and u.rol::text <> 'paciente';   -- el panel es herramienta clínica interna

-- --- La sesión de la APP DEL PACIENTE (móvil), que es otra cosa ------------
create or replace view public.vista_sesion_paciente as
select
  u.id_usuario, u.auth_user_id, u.nombre_usuario, u.email,
  u.rol::text as nombre_rol, u.activo,
  p.id_paciente, p.codigo_anonimo, p.nombre_completo,
  p.articulacion_principal::text as articulacion_principal,
  p.grado_artrosis_kl,
  to_jsonb(pu.*) - 'id_usuario' as preferencias
from public.usuarios u
join public.pacientes p                  on p.id_usuario  = u.id_usuario
left join public.preferencias_usuario pu on pu.id_usuario = u.id_usuario
where u.auth_user_id = auth.uid() and u.activo;

-- --- Dejar constancia del ingreso ------------------------------------------
create or replace function public.fn_registrar_login()
returns void language plpgsql security definer set search_path = public as $fn$
declare v_id integer := app.id_usuario();
begin
  if v_id is null then return; end if;
  update public.usuarios set ultimo_acceso = now() where id_usuario = v_id;
  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (v_id, app.rol(), 'login', 'usuarios', v_id::text, 'Ingreso al panel');
end $fn$;

-- --- Solicitud desde el formulario público (sin cuenta todavía) ------------
create or replace function public.fn_solicitar_acceso(
  p_nombre text, p_email text, p_tipo text, p_cedula text, p_telefono text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_id   integer;
  v_tipo public.solicitudes_acceso.tipo_profesional%type;
begin
  if exists (select 1 from public.usuarios where lower(email) = lower(p_email)) then
    raise exception 'Ese correo ya tiene una cuenta en el sistema';
  end if;

  v_tipo := p_tipo;   -- texto -> enum

  insert into public.solicitudes_acceso
    (nombre_completo, email, tipo_profesional, cedula_profesional, telefono, estado, origen)
  values (p_nombre, lower(p_email), v_tipo, p_cedula, p_telefono, 'pendiente', 'formulario')
  returning id_solicitud into v_id;

  insert into public.notificaciones (id_usuario, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  select s.id_usuario, 'solicitud_acceso', 'sistema', 'aviso',
         'Nueva solicitud de acceso', p_nombre || ' solicitó acceso al sistema.', '/solicitudes'
    from public.usuarios s where s.rol::text = 'superusuario' and s.activo;

  return jsonb_build_object('id_solicitud', v_id, 'estado', 'pendiente');
end $fn$;

-- --- El superusuario APRUEBA -----------------------------------------------
create or replace function public.fn_aprobar_solicitud(
  p_id_solicitud integer,
  p_rol          text default 'medico_fisiatra',
  p_tipo         text default 'medico_fisiatra',
  p_cedula       text default null,
  p_especialidad text default 'Medicina Física y Rehabilitación',
  p_modulos      jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  s            public.solicitudes_acceso;
  v_id_usuario integer;
  v_id_medico  integer;
  v_usuario    text;
  v_rol        public.usuarios.rol%type;
  v_tipo       public.medicos.tipo_profesional%type;
begin
  if not app.es_super() then
    raise exception 'Solo el superusuario puede aprobar solicitudes';
  end if;

  select * into s from public.solicitudes_acceso where id_solicitud = p_id_solicitud;
  if not found then raise exception 'La solicitud % no existe', p_id_solicitud; end if;
  if s.estado <> 'pendiente' then raise exception 'La solicitud ya fue %', s.estado; end if;

  -- nombre de usuario a partir del correo, sin repetir
  v_usuario := regexp_replace(lower(split_part(s.email, '@', 1)), '[^a-z0-9._]', '', 'g');
  while exists (select 1 from public.usuarios where nombre_usuario = v_usuario) loop
    v_usuario := v_usuario || floor(random() * 10)::text;
  end loop;

  v_rol  := p_rol;                                       -- texto -> enum
  v_tipo := coalesce(p_tipo, s.tipo_profesional::text);  -- texto -> enum

  insert into public.usuarios
    (auth_user_id, nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos, actualizado_por)
  values
    (s.auth_user_id, v_usuario, lower(s.email), v_rol, true,
     s.auth_user_id is null,      -- si entró por Google no hay contraseña que cambiar
     coalesce(p_modulos, '{}'::jsonb), app.id_usuario())
  returning id_usuario into v_id_usuario;

  insert into public.medicos
    (id_usuario, nombre_completo, tipo_profesional, especialidad, cedula_profesional, telefono, actualizado_por)
  values
    (v_id_usuario, s.nombre_completo,
     v_tipo,
     p_especialidad,
     coalesce(p_cedula, s.cedula_profesional, 'SIN-CEDULA-' || v_id_usuario::text),
     s.telefono, app.id_usuario())
  returning id_medico into v_id_medico;

  update public.solicitudes_acceso
     set estado = 'aprobada', fecha_revision = now(),
         id_superusuario_revisor = app.id_usuario(), id_usuario_creado = v_id_usuario
   where id_solicitud = p_id_solicitud;

  insert into public.notificaciones (id_usuario, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values (v_id_usuario, 'acceso_aprobado', 'sistema', 'info',
          'Acceso aprobado',
          'Tu acceso a FisioClin fue aprobado. Ya puedes ingresar al panel.', '/inicio');

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (app.id_usuario(), app.rol(), 'aprobacion_acceso', 'solicitudes_acceso',
          p_id_solicitud::text, 'Aprobada: ' || s.nombre_completo);

  return jsonb_build_object('id_usuario', v_id_usuario, 'id_medico', v_id_medico,
                            'nombre_usuario', v_usuario,
                            'entra_con_google', s.auth_user_id is not null);
end $fn$;

-- --- El superusuario RECHAZA -----------------------------------------------
create or replace function public.fn_rechazar_solicitud(p_id_solicitud integer, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare s public.solicitudes_acceso;
begin
  if not app.es_super() then raise exception 'Solo el superusuario puede rechazar solicitudes'; end if;

  update public.solicitudes_acceso
     set estado = 'rechazada', fecha_revision = now(),
         id_superusuario_revisor = app.id_usuario(),
         observaciones = coalesce(p_motivo, observaciones)
   where id_solicitud = p_id_solicitud
  returning * into s;

  if not found then raise exception 'La solicitud % no existe', p_id_solicitud; end if;

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (app.id_usuario(), app.rol(), 'rechazo_acceso', 'solicitudes_acceso',
          p_id_solicitud::text, 'Rechazada: ' || coalesce(p_motivo, 'sin motivo'));

  return jsonb_build_object('ok', true);
end $fn$;


-- ============================================================================
--  PASO 8 — MENSAJES Y ALERTAS
-- ============================================================================

create or replace function public.fn_mensaje_a_paciente(
  p_id_paciente integer, p_asunto text, p_cuerpo text, p_severidad text default 'info')
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario_pac integer;
  v_id_mensaje     bigint;
begin
  if not app.paciente_visible(p_id_paciente) then
    raise exception 'Ese paciente no está a tu cargo';
  end if;

  select id_usuario into v_id_usuario_pac from public.pacientes where id_paciente = p_id_paciente;

  insert into public.mensajes (id_remitente, id_destinatario, id_paciente, asunto, cuerpo, severidad)
  values (app.id_usuario(), v_id_usuario_pac, p_id_paciente, p_asunto, p_cuerpo, p_severidad)
  returning id_mensaje into v_id_mensaje;

  insert into public.notificaciones
    (id_usuario, id_paciente, id_remitente, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values
    (v_id_usuario_pac, p_id_paciente, app.id_usuario(), 'mensaje_medico', 'mensaje',
     p_severidad, p_asunto, p_cuerpo, '/mensajes');

  return jsonb_build_object('id_mensaje', v_id_mensaje);
end $fn$;

-- Revisión automática de alertas (adherencia, dolor alto, técnica, ausencias)
create or replace function public.fn_revision_alertas()
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_dolor integer := 0; v_tecnica integer := 0; v_citas integer := 0;
begin
  -- 1) dolor alto sostenido (media >= 6 en las últimas 72 h)
  with malos as (
    select rd.id_paciente, round(avg(rd.nivel_dolor), 1) as media
      from public.registro_dolor rd
     where rd.fecha_registro > now() - interval '72 hours'
     group by rd.id_paciente having avg(rd.nivel_dolor) >= 6
  )
  insert into public.notificaciones (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta, clave_evento)
  select m.id_usuario, x.id_paciente, 'dolor_alto', 'dolor', 'alerta',
         'Dolor elevado sostenido',
         p.nombre_completo || ' reporta EVA ' || x.media || '/10 de media en 72 h.',
         '/pacientes', 'dolor:' || x.id_paciente || ':' || current_date
    from malos x
    join public.pacientes p on p.id_paciente = x.id_paciente
    join public.medicos   m on m.id_medico   = p.id_medico_tratante
   where not exists (select 1 from public.notificaciones n
                      where n.clave_evento = 'dolor:' || x.id_paciente || ':' || current_date);
  get diagnostics v_dolor = row_count;

  -- 2) técnica deficiente (menos del 70 % correcto en la última semana)
  with flojas as (
    select s.id_paciente, s.id_sesion, s.ejercicio
      from public.sesiones s
     where s.fecha_hora > now() - interval '7 days'
       and s.resultado_evaluacion = 'incorrecto'
  )
  insert into public.notificaciones (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta, clave_evento)
  select m.id_usuario, f.id_paciente, 'tecnica_deficiente', 'tecnica', 'alerta',
         'Técnica deficiente',
         p.nombre_completo || ': ejecución incorrecta en "' || f.ejercicio || '".',
         '/sesiones', 'tecnica:' || f.id_sesion
    from flojas f
    join public.pacientes p on p.id_paciente = f.id_paciente
    join public.medicos   m on m.id_medico   = p.id_medico_tratante
   where not exists (select 1 from public.notificaciones n where n.clave_evento = 'tecnica:' || f.id_sesion);
  get diagnostics v_tecnica = row_count;

  -- 3) citas vencidas sin cerrar
  insert into public.notificaciones (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta, clave_evento)
  select m.id_usuario, c.id_paciente, 'cita_incumplida', 'cita', 'aviso',
         'Cita sin cerrar',
         p.nombre_completo || ' tenía cita el ' || to_char(c.fecha_hora, 'DD/MM HH24:MI') || ' y sigue abierta.',
         '/citas', 'cita:' || c.id_cita
    from public.citas c
    join public.pacientes p on p.id_paciente = c.id_paciente
    join public.medicos   m on m.id_medico   = c.id_medico
   where c.fecha_hora < now() - interval '2 hours'
     and c.estado in ('programada', 'confirmada')
     and not exists (select 1 from public.notificaciones n where n.clave_evento = 'cita:' || c.id_cita);
  get diagnostics v_citas = row_count;

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, detalle)
  values (app.id_usuario(), app.rol(), 'revision_alertas', 'notificaciones',
          'Generadas ' || (v_dolor + v_tecnica + v_citas) || ' alertas');

  return jsonb_build_object('dolor_alto', v_dolor, 'tecnica', v_tecnica,
                            'recordatorios_cita', v_citas,
                            'total', v_dolor + v_tecnica + v_citas);
end $fn$;


-- ============================================================================
--  PASO 9 — VISTAS QUE EL PANEL YA ESPERA
-- ============================================================================

-- Mismo motivo que en `vista_profesionales`: las columnas nuevas van al
-- final para que el `create or replace view` no rompa contra una base ya
-- desplegada (solo se pueden AGREGAR columnas al final, no insertarlas).
create or replace view public.vista_usuarios_admin as
select
  u.id_usuario, u.rol::text as rol, u.email, u.nombre_usuario, u.activo,
  u.debe_cambiar_password, u.ultimo_acceso, u.modulos_permitidos,
  m.id_medico, m.nombre_completo as medico_nombre, m.cedula_profesional,
  p.nombre_completo as paciente_nombre,
  (u.auth_user_id is not null) as tiene_cuenta_auth,
  (select count(*) from public.pacientes pa
    where pa.id_medico_tratante = m.id_medico and pa.activo) as pacientes_a_cargo,
  fp.bucket       as avatar_bucket,
  fp.storage_path as avatar_path
from public.usuarios u
left join public.medicos   m on m.id_usuario = u.id_usuario
left join public.pacientes p on p.id_usuario = u.id_usuario
left join public.fotos_perfil fp on fp.id_usuario = u.id_usuario;

create or replace view public.vista_sesiones_detalle as
select
  s.id_sesion, s.id_paciente, s.id_prescripcion, s.id_ejercicio, s.ejercicio,
  s.fecha_hora, s.estado, s.completado, s.resultado_evaluacion, s.observaciones,
  s.duracion_segundos, s.video_storage_path,
  med.nombre_completo as supervisor,
  count(r.id_repeticion)                                              as repeticiones_totales,
  count(r.id_repeticion) filter (where r.calidad_ejecucion = 'correcta') as repeticiones_correctas,
  case when count(r.id_repeticion) = 0 then null
       else round(100.0 * count(r.id_repeticion) filter (where r.calidad_ejecucion = 'correcta')
                  / count(r.id_repeticion)) end                       as porcentaje_correctas,
  round(avg(r.angulo_alcanzado), 1)                                   as angulo_promedio,
  max(ma.rom)                                                         as rom_maximo,
  max(ma.angulo_maximo)                                               as angulo_maximo,
  max(ma.angulo_goniometro)                                           as angulo_goniometro,
  bool_and(ma.dentro_umbral_clinico)                                  as validado_ok,
  (select rd.nivel_dolor from public.registro_dolor rd
    where rd.id_sesion = s.id_sesion and rd.momento = 'antes_sesion' limit 1)    as dolor_antes,
  (select rd.nivel_dolor from public.registro_dolor rd
    where rd.id_sesion = s.id_sesion and rd.momento = 'despues_sesion' limit 1)  as dolor_despues
from public.sesiones s
left join public.repeticiones_ejercicio r on r.id_sesion = s.id_sesion
left join public.metricas_articulares   ma on ma.id_sesion = s.id_sesion
left join public.medicos               med on med.id_medico = s.id_profesional_supervisor
group by s.id_sesion, med.nombre_completo;

create or replace view public.vista_progreso_semanal as
select
  p.id_paciente,
  date_trunc('week', x.fecha)::date as semana,
  round(avg(x.dolor)::numeric, 1)   as dolor_promedio,
  round(avg(x.rom)::numeric, 1)     as rom_promedio,
  count(distinct x.id_sesion)       as sesiones
from public.pacientes p
join lateral (
  select s.id_sesion, s.fecha_hora as fecha,
         (select avg(rd.nivel_dolor) from public.registro_dolor rd where rd.id_sesion = s.id_sesion) as dolor,
         (select avg(ma.rom)         from public.metricas_articulares ma where ma.id_sesion = s.id_sesion) as rom
    from public.sesiones s
   where s.id_paciente = p.id_paciente
) x on true
group by p.id_paciente, date_trunc('week', x.fecha);


-- ============================================================================
--  PASO 10 — ARREGLOS SUELTOS DE LA BASE
-- ============================================================================

-- 12.1  actualizado_en nunca se actualizaba: ahora sí, en todas las tablas.
create or replace function public.fn_tocar_actualizado_en()
returns trigger language plpgsql as $fn$
begin
  new.actualizado_en := now();
  return new;
end $fn$;

do $$
declare t record;
begin
  for t in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'actualizado_en'
  loop
    execute format('drop trigger if exists trg_tocar_actualizado on public.%I', t.table_name);
    execute format('create trigger trg_tocar_actualizado before update on public.%I
                    for each row execute function public.fn_tocar_actualizado_en()', t.table_name);
  end loop;
end $$;

-- 12.2  No se podía repetir el número de repetición dentro de una sesión.
create unique index if not exists ux_repeticion_por_sesion
  on public.repeticiones_ejercicio (id_sesion, numero_repeticion);

-- 12.3  Lo de las citas solapadas ya quedó resuelto en la PARTE A, junto con
--       la tabla (hizo falta una columna `fecha_fin` y un trigger, porque un
--       índice no admite expresiones que dependan de la zona horaria).
--       Aquí solo se rellena `fecha_fin` en las citas que ya existieran.
update public.citas
   set fecha_fin = fecha_hora + make_interval(mins => duracion_minutos)
 where fecha_fin is null;

-- 12.4  Índices que faltaban (las consultas del panel los necesitan).
create index if not exists ix_sesiones_paciente_fecha    on public.sesiones (id_paciente, fecha_hora desc);
create index if not exists ix_citas_medico_fecha         on public.citas (id_medico, fecha_hora);
create index if not exists ix_citas_paciente_fecha       on public.citas (id_paciente, fecha_hora);
create index if not exists ix_notif_usuario_leida        on public.notificaciones (id_usuario, leida, fecha_creacion desc);
create index if not exists ix_presc_plan_activo          on public.prescripciones_ejercicio (id_plan) where activo;
create index if not exists ix_pacientes_tratante         on public.pacientes (id_medico_tratante) where activo;
create index if not exists ix_historial_paciente_fecha   on public.historial_clinico (id_paciente, fecha_registro desc);
create index if not exists ix_dolor_paciente_fecha       on public.registro_dolor (id_paciente, fecha_registro desc);
create index if not exists ix_metricas_sesion            on public.metricas_articulares (id_sesion);
create index if not exists ix_repeticiones_sesion        on public.repeticiones_ejercicio (id_sesion);
create index if not exists ix_mensajes_paciente          on public.mensajes (id_paciente, creado_en desc);
create index if not exists ix_adjuntos_paciente          on public.adjuntos_clinicos (id_paciente, creado_en desc);
create index if not exists ix_planes_paciente_estado     on public.planes_tratamiento (id_paciente, estado);

-- 12.5  Evitar avisos duplicados (fn_revision_alertas usa clave_evento).
create unique index if not exists ux_notif_clave_evento
  on public.notificaciones (clave_evento) where clave_evento is not null;

-- 12.6  Validar que modulos_permitidos solo use claves del catálogo.
create or replace function public.fn_validar_modulos()
returns trigger language plpgsql as $fn$
declare k text;
begin
  if (select count(*) from public.catalogo_modulos) = 0 then return new; end if;
  for k in select jsonb_object_keys(coalesce(new.modulos_permitidos, '{}'::jsonb)) loop
    if not exists (select 1 from public.catalogo_modulos where clave = k) then
      raise exception 'El módulo "%" no existe en catalogo_modulos', k;
    end if;
  end loop;
  return new;
end $fn$;

drop trigger if exists trg_validar_modulos on public.usuarios;
create trigger trg_validar_modulos
  before insert or update of modulos_permitidos on public.usuarios
  for each row execute function public.fn_validar_modulos();


-- ============================================================================
--  PASO 11 — SEGURIDAD (RLS)
--  Sin esto, cualquier usuario conectado podría leer TODAS las historias
--  clínicas. Con esto, un médico solo ve a SUS pacientes.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'usuarios','medicos','pacientes','documentos_identidad','fotos_perfil',
    'solicitudes_acceso','planes_tratamiento','ejercicios_catalogo',
    'prescripciones_ejercicio','sesiones','metricas_articulares',
    'repeticiones_ejercicio','registro_dolor','historial_clinico',
    'notificaciones','dispositivos_push','reportes_generados','citas',
    'preferencias_usuario','bitacora_auditoria','catalogo_modulos',
    'adjuntos_clinicos','mensajes','consentimiento_informado','intentos_login']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists p_super_todo on public.%I', t);
    execute format('create policy p_super_todo on public.%I for all
                    using (app.es_super()) with check (app.es_super())', t);
  end loop;
end $$;

-- --- lectura básica que todo profesional necesita ---------------------------
drop policy if exists p_usuarios_propio on public.usuarios;
create policy p_usuarios_propio on public.usuarios for select
  using (auth_user_id = auth.uid());

drop policy if exists p_medicos_leer on public.medicos;
create policy p_medicos_leer on public.medicos for select
  using (app.id_usuario() is not null);

drop policy if exists p_medicos_propio_update on public.medicos;
create policy p_medicos_propio_update on public.medicos for update
  using (id_usuario = app.id_usuario()) with check (id_usuario = app.id_usuario());

drop policy if exists p_catalogo_modulos_leer on public.catalogo_modulos;
create policy p_catalogo_modulos_leer on public.catalogo_modulos for select
  using (app.id_usuario() is not null);

drop policy if exists p_ejercicios_leer on public.ejercicios_catalogo;
create policy p_ejercicios_leer on public.ejercicios_catalogo for select
  using (app.id_usuario() is not null);

-- ---------------------------------------------------------------------------
-- CATÁLOGO DE EJERCICIOS: COMPARTIDO Y ABIERTO
--   Lo ve TODO el que entra al panel (médicos, fisioterapeutas y el
--   superusuario) y CUALQUIERA de ellos puede crear, editar y borrar.
--   Es un catálogo común de la unidad, no la propiedad de cada médico.
--
--   Nota: borrar un ejercicio que ya está recetado lo impide la base (la
--   prescripción lo apunta). En ese caso hay que desactivarlo, no borrarlo.
-- ---------------------------------------------------------------------------
drop policy if exists p_ejercicios_escribir on public.ejercicios_catalogo;
drop policy if exists p_ejercicios_alta on public.ejercicios_catalogo;
drop policy if exists p_ejercicios_editar on public.ejercicios_catalogo;

create policy p_ejercicios_escribir on public.ejercicios_catalogo for all
  using (app.id_usuario() is not null)
  with check (app.id_usuario() is not null);

-- --- todo lo que cuelga del paciente ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'planes_tratamiento','prescripciones_ejercicio','sesiones','registro_dolor',
    'historial_clinico','citas','adjuntos_clinicos','documentos_identidad',
    'reportes_generados','consentimiento_informado']
  loop
    execute format('drop policy if exists p_por_paciente on public.%I', t);
    -- id_paciente nulo = registro general (reporte global, OCR sin paciente aún):
    -- lo ve cualquier profesional; el resto, solo quien tiene al paciente a cargo.
    execute format('create policy p_por_paciente on public.%I for all
                    using (case when id_paciente is null then app.id_medico() is not null
                                else app.paciente_visible(id_paciente) end)
                    with check (case when id_paciente is null then app.id_medico() is not null
                                else app.paciente_visible(id_paciente) end)', t);
  end loop;
end $$;

-- Registrar intentos de login aunque todavía no haya sesión.
drop policy if exists p_intentos_insert on public.intentos_login;
create policy p_intentos_insert on public.intentos_login for insert
  to anon, authenticated with check (true);

-- --- pacientes --------------------------------------------------------------
-- Un médico solo ve a los suyos, y al registrar uno tiene que quedar él como
-- registrador (no puede dar de alta a nombre de otro).
-- El superusuario entra por la política p_super_todo: él SÍ puede registrar un
-- paciente eligiendo a qué médico se lo asigna.
drop policy if exists p_pacientes_visibles on public.pacientes;
drop policy if exists p_pacientes_leer on public.pacientes;
drop policy if exists p_pacientes_alta on public.pacientes;
drop policy if exists p_pacientes_editar on public.pacientes;

create policy p_pacientes_leer on public.pacientes for select
  using (app.paciente_visible(id_paciente));

create policy p_pacientes_alta on public.pacientes for insert
  with check (app.id_medico() is not null and id_medico_registrador = app.id_medico());

create policy p_pacientes_editar on public.pacientes for update
  using (app.paciente_visible(id_paciente))
  with check (app.paciente_visible(id_paciente));

-- --- lo que cuelga de la sesión --------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['metricas_articulares','repeticiones_ejercicio']
  loop
    execute format('drop policy if exists p_por_sesion on public.%I', t);
    execute format('create policy p_por_sesion on public.%I for all
                    using (exists (select 1 from public.sesiones s
                                    where s.id_sesion = %I.id_sesion
                                      and app.paciente_visible(s.id_paciente)))
                    with check (exists (select 1 from public.sesiones s
                                    where s.id_sesion = %I.id_sesion
                                      and app.paciente_visible(s.id_paciente)))', t, t, t);
  end loop;
end $$;

-- --- cosas personales de cada usuario --------------------------------------
do $$
declare t text;
begin
  foreach t in array array['preferencias_usuario','fotos_perfil','dispositivos_push']
  loop
    execute format('drop policy if exists p_propio on public.%I', t);
    execute format('create policy p_propio on public.%I for all
                    using (id_usuario = app.id_usuario())
                    with check (id_usuario = app.id_usuario())', t);
  end loop;
end $$;

drop policy if exists p_notif_propias on public.notificaciones;
create policy p_notif_propias on public.notificaciones for all
  using (id_usuario = app.id_usuario() or app.paciente_visible(id_paciente))
  with check (id_remitente = app.id_usuario() or app.id_medico() is not null);

drop policy if exists p_mensajes_propios on public.mensajes;
create policy p_mensajes_propios on public.mensajes for all
  using (id_remitente = app.id_usuario()
      or id_destinatario = app.id_usuario()
      or app.paciente_visible(id_paciente))
  with check (id_remitente = app.id_usuario());

-- --- solicitudes: el formulario público puede INSERTAR sin estar logueado ---
drop policy if exists p_solicitud_publica on public.solicitudes_acceso;
create policy p_solicitud_publica on public.solicitudes_acceso for insert
  to anon, authenticated with check (estado = 'pendiente');

drop policy if exists p_solicitud_propia on public.solicitudes_acceso;
create policy p_solicitud_propia on public.solicitudes_acceso for select
  using (auth_user_id = auth.uid());

-- --- permisos de ejecución de las funciones --------------------------------
grant usage on schema app to anon, authenticated;
grant execute on function public.fn_email_de_usuario(text) to anon, authenticated;
grant execute on function public.fn_solicitar_acceso(text, text, text, text, text) to anon, authenticated;
grant execute on function public.fn_estado_solicitud() to authenticated;
grant execute on function public.fn_registrar_login() to authenticated;
grant execute on function public.fn_permisos(integer) to authenticated;
grant execute on function public.fn_definir_modulos(integer, jsonb) to authenticated;
grant execute on function public.fn_aprobar_solicitud(integer, text, text, text, text, jsonb) to authenticated;
grant execute on function public.fn_rechazar_solicitud(integer, text) to authenticated;
grant execute on function public.fn_mensaje_a_paciente(integer, text, text, text) to authenticated;
grant execute on function public.fn_revision_alertas() to authenticated;
-- Las tablas nuevas necesitan permiso explícito (RLS sigue mandando encima).
grant select, insert, update, delete on
  public.adjuntos_clinicos, public.mensajes, public.consentimiento_informado
  to authenticated;
grant select on public.catalogo_modulos to anon, authenticated;
grant insert on public.intentos_login to anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select on public.vista_sesion_actual to authenticated;
grant select on public.vista_usuarios_admin to authenticated;
grant select on public.vista_sesiones_detalle to authenticated;
grant select on public.vista_progreso_semanal to authenticated;


-- ============================================================================
--  PASO 11.B — PERMISOS SOBRE LOS ARCHIVOS (Storage)
--  ---------------------------------------------------------------------------
--  Los datos de las TABLAS ya estaban protegidos; los ARCHIVOS no. Sin esto,
--  cualquier usuario conectado podria descargar la radiografia de cualquier
--  paciente con solo adivinar el nombre del archivo.
--
--  La regla mira la PRIMERA CARPETA de la ruta: si el archivo esta en
--  "104/rx-tobillo.jpg", comprueba que el paciente 104 sea tuyo.
-- ============================================================================
create or replace function app.carpeta_paciente_visible(p_nombre text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare v_carpeta text;
begin
  v_carpeta := (storage.foldername(p_nombre))[1];
  if v_carpeta is null or v_carpeta !~ '^[0-9]+$' then
    return app.es_super();       -- ruta con formato raro: solo el admin
  end if;
  return app.paciente_visible(v_carpeta::integer);
end $fn$;

-- Limpiar cualquier regla anterior demasiado abierta.
do $$
declare b text;
begin
  foreach b in array array['avatares','ejercicios-videos','adjuntos-clinicos',
                           'videos-sesiones','documentos-identidad']
  loop
    execute format('drop policy if exists %I on storage.objects',
                   'p_' || replace(b, '-', '_') || '_rw');
  end loop;
end $$;

-- a) ARCHIVOS DE PACIENTE: radiografias, videos de sesion y documentos.
--    Solo quien tiene a ese paciente a cargo.
do $$
declare b text;
begin
  foreach b in array array['adjuntos-clinicos','videos-sesiones','documentos-identidad']
  loop
    execute format('drop policy if exists %I on storage.objects',
                   'p_' || replace(b, '-', '_') || '_paciente');
    execute format($p$create policy %I on storage.objects for all to authenticated
                     using (bucket_id = %L and app.carpeta_paciente_visible(name))
                     with check (bucket_id = %L and app.carpeta_paciente_visible(name))$p$,
                   'p_' || replace(b, '-', '_') || '_paciente', b, b);
  end loop;
end $$;

-- b) VIDEOS DEL CATALOGO: compartidos.
--    Los ve todo el equipo y cualquiera puede subir, reemplazar o borrar.
--    No son datos de un paciente concreto: son material de la unidad.
drop policy if exists p_ejercicios_videos_todos on storage.objects;
create policy p_ejercicios_videos_todos on storage.objects for all to authenticated
  using (bucket_id = 'ejercicios-videos' and app.id_usuario() is not null)
  with check (bucket_id = 'ejercicios-videos' and app.id_usuario() is not null);

-- c) AVATARES: cada quien sube el suyo, pero todo el equipo los ve
--    (aparecen en las tarjetas de "Medicos").
drop policy if exists p_avatares_leer on storage.objects;
create policy p_avatares_leer on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and app.id_usuario() is not null);

drop policy if exists p_avatares_propio on storage.objects;
create policy p_avatares_propio on storage.objects for all to authenticated
  using (
    bucket_id = 'avatares'
    and (app.es_super()
         or split_part(split_part(name, '/', 2), '-', 1) = app.id_usuario()::text)
  )
  with check (
    bucket_id = 'avatares'
    and split_part(split_part(name, '/', 2), '-', 1) = app.id_usuario()::text
  );


-- ============================================================================
--  PASO 12 — CONTRASEÑAS: recuperar, cambiar, forzar y bloquear
--  ---------------------------------------------------------------------------
--  QUÉ RESUELVE
--    1. "¿Olvidaste tu contraseña?"  -> el propio médico pide el correo de
--       recuperación, sin pasar por el administrador.
--    2. Cambio de contraseña          -> queda registrado y apaga el aviso de
--       "debes cambiar tu contraseña".
--    3. El superusuario puede FORZAR  -> obliga a alguien a cambiarla.
--    4. Bloqueo por intentos fallidos -> 5 fallos en 15 minutos y se bloquea
--       15 minutos.
--
--  IMPORTANTE: la contraseña en sí NUNCA se guarda aquí. La guarda Supabase
--  Auth, cifrada. Esta tabla solo registra QUIÉN pidió qué y CUÁNDO.
-- ============================================================================


-- ============================================================================
--  1. La bitácora tenía que aceptar las acciones nuevas
-- ============================================================================
select public.fn_soltar_checks('public.bitacora_auditoria', 'accion');

alter table public.bitacora_auditoria
  add constraint bitacora_auditoria_accion_check check (accion in (
    'insert', 'update', 'delete', 'login', 'logout', 'rpc', 'acceso_denegado',
    'revision_alertas', 'aprobacion_acceso', 'rechazo_acceso', 'cambio_permisos',
    -- nuevas, de este script:
    'recuperacion_password', 'cambio_password', 'reset_forzado', 'login_bloqueado'
  ));


-- ============================================================================
--  2. Tabla de recuperaciones
-- ============================================================================
create table if not exists public.recuperaciones_password (
  id_recuperacion  bigint generated always as identity primary key,
  id_usuario       integer references public.usuarios(id_usuario),
  email            varchar(150) not null,
  origen           varchar(20)  not null default 'usuario'
    check (origen in ('usuario', 'superusuario', 'primer_ingreso')),
  estado           varchar(20)  not null default 'solicitada'
    check (estado in ('solicitada', 'usada', 'expirada', 'cancelada')),
  solicitado_por   integer references public.usuarios(id_usuario),
  ip               inet,
  user_agent       text,
  fecha_solicitud  timestamptz not null default now(),
  fecha_uso        timestamptz,
  observaciones    text
);

create index if not exists ix_recuperaciones_email
  on public.recuperaciones_password (lower(email), fecha_solicitud desc);

create index if not exists ix_intentos_identificador
  on public.intentos_login (lower(identificador), fecha desc);


-- ============================================================================
--  3. "¿Olvidaste tu contraseña?"
--     Lo llama alguien que NO ha iniciado sesión.
--     Siempre responde lo mismo, exista o no el correo: así nadie puede
--     averiguar qué correos están registrados probando uno por uno.
-- ============================================================================
create or replace function public.fn_solicitar_recuperacion(
  p_email      text,
  p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario integer;
  v_recientes  integer;
begin
  select id_usuario into v_id_usuario
    from public.usuarios
   where lower(email) = lower(trim(p_email)) and activo;

  -- Freno anti-abuso: máximo 3 pedidos por hora para el mismo correo.
  select count(*) into v_recientes
    from public.recuperaciones_password
   where lower(email) = lower(trim(p_email))
     and fecha_solicitud > now() - interval '1 hour';

  if v_recientes >= 3 then
    return jsonb_build_object(
      'ok', true,
      'mensaje', 'Si el correo existe, ya te enviamos las instrucciones. Revisa tu bandeja.');
  end if;

  insert into public.recuperaciones_password (id_usuario, email, origen, user_agent)
  values (v_id_usuario, lower(trim(p_email)), 'usuario', p_user_agent);

  if v_id_usuario is not null then
    insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
    values (v_id_usuario, 'sistema', 'recuperacion_password', 'usuarios',
            v_id_usuario::text, 'Solicitó recuperar su contraseña');
  end if;

  -- Ojo: la respuesta es idéntica exista o no el correo. A propósito.
  return jsonb_build_object(
    'ok', true,
    'mensaje', 'Si el correo existe, te enviamos las instrucciones. Revisa tu bandeja.');
end $fn$;


-- ============================================================================
--  4. La contraseña ya se cambió
--     Lo llama el panel DESPUÉS de que Supabase aceptó la contraseña nueva.
--     Es SECURITY DEFINER porque un médico normal no tiene permiso para
--     escribir en `usuarios` (y así debe ser): esta función lo hace por él,
--     pero solo sobre su propia fila.
-- ============================================================================
create or replace function public.fn_password_cambiada()
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_id integer := app.id_usuario();
begin
  if v_id is null then
    raise exception 'No hay sesión activa';
  end if;

  update public.usuarios
     set debe_cambiar_password = false
   where id_usuario = v_id;

  update public.recuperaciones_password
     set estado = 'usada', fecha_uso = now()
   where id_usuario = v_id and estado = 'solicitada';

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (v_id, app.rol(), 'cambio_password', 'usuarios', v_id::text,
          'Cambió su contraseña');

  return jsonb_build_object('ok', true);
end $fn$;


-- ============================================================================
--  5. El superusuario OBLIGA a alguien a cambiar su contraseña
--     (por ejemplo: cuenta recién creada, o sospecha de que se filtró)
--     Marca la cuenta y deja el aviso; el correo de reseteo lo dispara el
--     panel con resetPasswordForEmail.
-- ============================================================================
create or replace function public.fn_forzar_cambio_password(
  p_id_usuario integer,
  p_motivo     text default null)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_email text;
begin
  if not app.es_super() then
    raise exception 'Solo el superusuario puede forzar el cambio de contraseña';
  end if;

  update public.usuarios
     set debe_cambiar_password = true,
         actualizado_por       = app.id_usuario()
   where id_usuario = p_id_usuario
  returning email into v_email;

  if v_email is null then
    raise exception 'El usuario % no existe', p_id_usuario;
  end if;

  insert into public.recuperaciones_password
    (id_usuario, email, origen, solicitado_por, observaciones)
  values (p_id_usuario, v_email, 'superusuario', app.id_usuario(),
          coalesce(p_motivo, 'Reinicio solicitado por el administrador'));

  insert into public.notificaciones
    (id_usuario, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values (p_id_usuario, 'sistema', 'sistema', 'aviso',
          'Debes cambiar tu contraseña',
          coalesce(p_motivo, 'El administrador pidió que cambies tu contraseña la próxima vez que ingreses.'),
          '/perfil');

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (app.id_usuario(), app.rol(), 'reset_forzado', 'usuarios', p_id_usuario::text,
          coalesce(p_motivo, 'Reinicio de contraseña forzado'));

  return jsonb_build_object('ok', true, 'email', v_email);
end $fn$;


-- ============================================================================
--  6. Bloqueo por intentos fallidos
--     5 fallos en 15 minutos -> bloqueado 15 minutos.
-- ============================================================================
create or replace function public.fn_esta_bloqueado(p_identificador text)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_fallos  integer;
  v_ultimo  timestamptz;
begin
  select count(*), max(fecha) into v_fallos, v_ultimo
    from public.intentos_login
   where lower(identificador) = lower(trim(p_identificador))
     and not exito
     and fecha > now() - interval '15 minutes';

  if v_fallos >= 5 then
    return jsonb_build_object(
      'bloqueado', true,
      'fallos', v_fallos,
      'minutos_restantes',
        greatest(1, ceil(extract(epoch from (v_ultimo + interval '15 minutes' - now())) / 60))::int);
  end if;

  return jsonb_build_object('bloqueado', false, 'fallos', v_fallos);
end $fn$;

-- Registrar cada intento (lo llama el panel, tenga sesión o no).
create or replace function public.fn_registrar_intento(
  p_identificador text,
  p_exito         boolean,
  p_motivo        text default null,
  p_user_agent    text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.intentos_login (identificador, exito, motivo, user_agent)
  values (trim(p_identificador), p_exito, p_motivo, p_user_agent);

  -- Si acaba de llegar al quinto fallo, queda constancia en la auditoría.
  if not p_exito then
    if (select count(*) from public.intentos_login
         where lower(identificador) = lower(trim(p_identificador))
           and not exito and fecha > now() - interval '15 minutes') = 5 then
      insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
      values (null, 'anonimo', 'login_bloqueado', 'intentos_login', null,
              'Cuenta bloqueada 15 min por 5 intentos fallidos: ' || trim(p_identificador));
    end if;
  end if;
end $fn$;

-- Limpieza: los intentos viejos no sirven para nada y ocupan espacio.
create or replace function public.fn_limpiar_intentos_viejos()
returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_borrados integer;
begin
  delete from public.intentos_login where fecha < now() - interval '30 days';
  get diagnostics v_borrados = row_count;

  update public.recuperaciones_password
     set estado = 'expirada'
   where estado = 'solicitada' and fecha_solicitud < now() - interval '24 hours';

  return v_borrados;
end $fn$;


-- ============================================================================
--  7. Seguridad de la tabla nueva
-- ============================================================================
alter table public.recuperaciones_password enable row level security;

drop policy if exists p_super_todo on public.recuperaciones_password;
create policy p_super_todo on public.recuperaciones_password for all
  using (app.es_super()) with check (app.es_super());

drop policy if exists p_recuperacion_propia on public.recuperaciones_password;
create policy p_recuperacion_propia on public.recuperaciones_password for select
  using (id_usuario = app.id_usuario());


-- ============================================================================
--  8. Permisos de ejecución
--     Las tres primeras las puede llamar alguien SIN sesión: es justamente
--     el momento del login.
-- ============================================================================
grant execute on function public.fn_solicitar_recuperacion(text, text) to anon, authenticated;
grant execute on function public.fn_esta_bloqueado(text)                to anon, authenticated;
grant execute on function public.fn_registrar_intento(text, boolean, text, text) to anon, authenticated;
grant execute on function public.fn_password_cambiada()                 to authenticated;
grant execute on function public.fn_forzar_cambio_password(integer, text) to authenticated;
grant execute on function public.fn_limpiar_intentos_viejos()           to authenticated;

grant select on public.recuperaciones_password to authenticated;

-- ============================================================================
--  PASO 13 — CÓDIGO DE PACIENTE AUTOMÁTICO
--  ---------------------------------------------------------------------------
--  El panel ya no tiene que inventarlo: si llega vacío, la base pone el
--  siguiente (PAC-0001, PAC-0002, ...). Así dos médicos registrando al mismo
--  tiempo no pueden pisarse el código.
-- ============================================================================
alter table public.pacientes alter column codigo_anonimo drop not null;

create or replace function public.fn_codigo_anonimo()
returns trigger language plpgsql as $fn$
declare v_siguiente integer;
begin
  if new.codigo_anonimo is not null and trim(new.codigo_anonimo) <> '' then
    return new;
  end if;

  select coalesce(max(substring(codigo_anonimo from 'PAC-([0-9]+)')::integer), 0) + 1
    into v_siguiente
    from public.pacientes
   where codigo_anonimo ~ '^PAC-[0-9]+$';

  new.codigo_anonimo := 'PAC-' || lpad(v_siguiente::text, 4, '0');
  return new;
end $fn$;

drop trigger if exists trg_codigo_anonimo on public.pacientes;
create trigger trg_codigo_anonimo
  before insert on public.pacientes
  for each row execute function public.fn_codigo_anonimo();


-- ============================================================================
--  PASO 14 — AVISO AL PACIENTE CUANDO SE LE RECETA UN EJERCICIO
--  ---------------------------------------------------------------------------
--  El panel dice "el paciente ya fue notificado" al guardar una rutina.
--  Hasta ahora era mentira. Ahora lo hace la base sola.
-- ============================================================================
create or replace function public.fn_avisar_prescripcion()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario integer;
  v_ejercicio  text;
begin
  select id_usuario into v_id_usuario from public.pacientes where id_paciente = new.id_paciente;
  select nombre     into v_ejercicio  from public.ejercicios_catalogo where id_ejercicio = new.id_ejercicio;

  insert into public.notificaciones
    (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values
    (v_id_usuario, new.id_paciente, 'nueva_prescripcion', 'prescripcion', 'info',
     'Nuevo ejercicio en tu rutina',
     'Tu profesional te indicó "' || coalesce(v_ejercicio, 'un ejercicio') || '": ' ||
     new.series || ' series de ' || new.repeticiones || ' repeticiones, ' ||
     new.frecuencia_semanal || ' veces por semana.',
     '/rutina');

  return new;
end $fn$;

drop trigger if exists trg_avisar_prescripcion on public.prescripciones_ejercicio;
create trigger trg_avisar_prescripcion
  after insert on public.prescripciones_ejercicio
  for each row when (new.activo) execute function public.fn_avisar_prescripcion();


-- ============================================================================
--  PASO 15 — AVISO AL PACIENTE CUANDO SE MUEVE SU CITA
-- ============================================================================
create or replace function public.fn_avisar_cita()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario integer;
  v_tipo       varchar(40);
  v_titulo     text;
  v_cuando     text := to_char(new.fecha_hora at time zone 'America/La_Paz', 'DD/MM/YYYY "a las" HH24:MI');
begin
  select id_usuario into v_id_usuario from public.pacientes where id_paciente = new.id_paciente;

  if tg_op = 'INSERT' then
    v_tipo := 'cita_programada';  v_titulo := 'Tienes una cita programada';
  elsif new.estado = 'cancelada' and coalesce(old.estado, '') <> 'cancelada' then
    v_tipo := 'cita_cancelada';   v_titulo := 'Tu cita fue cancelada';
  elsif new.fecha_hora <> old.fecha_hora then
    v_tipo := 'cita_reprogramada'; v_titulo := 'Tu cita cambió de fecha';
  elsif new.estado = 'ausente' and coalesce(old.estado, '') <> 'ausente' then
    v_tipo := 'cita_incumplida';  v_titulo := 'No asististe a tu cita';
  else
    return new;   -- cualquier otro cambio no se avisa
  end if;

  insert into public.notificaciones
    (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values
    (v_id_usuario, new.id_paciente, v_tipo, 'cita',
     case when v_tipo in ('cita_cancelada', 'cita_incumplida') then 'aviso' else 'info' end,
     v_titulo,
     coalesce(new.motivo, 'Control') || ' — ' || v_cuando || '. ' || coalesce(new.lugar, ''),
     '/citas');

  return new;
end $fn$;

drop trigger if exists trg_avisar_cita_alta on public.citas;
create trigger trg_avisar_cita_alta
  after insert on public.citas
  for each row execute function public.fn_avisar_cita();

drop trigger if exists trg_avisar_cita_cambio on public.citas;
create trigger trg_avisar_cita_cambio
  after update on public.citas
  for each row execute function public.fn_avisar_cita();


-- ============================================================================
--  PASO 16 — AUDITORÍA AUTOMÁTICA
--  ---------------------------------------------------------------------------
--  Antes la bitácora dependía de que el panel se acordara de escribir en ella.
--  Ahora la escribe la base sola: no hay forma de tocar un paciente, un plan,
--  una prescripción o un usuario sin dejar rastro.
-- ============================================================================
create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  -- Una bitacora NUNCA debe guardar esto, aunque venga en la fila.
  v_ocultar text[] := array['password_hash', 'texto_ocr_crudo', 'campos_ocr'];
  v_antes   jsonb;
  v_despues jsonb;
  v_fila    jsonb;
  v_id      text;
  k         text;
begin
  v_antes   := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_despues := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_fila    := coalesce(v_despues, v_antes);

  -- La clave primaria se busca POR NOMBRE dentro de la fila ya convertida a
  -- jsonb. Antes se hacia con new.id_paciente y compania, y eso reventaba:
  -- PL/pgSQL resuelve TODOS los campos del CASE aunque solo use una rama, asi
  -- que al auditar `usuarios` se quejaba de que no existe `id_paciente`.
  -- Sobre jsonb, pedir una clave que no esta simplemente devuelve nulo.
  v_id := case tg_table_name
    when 'pacientes'                then v_fila ->> 'id_paciente'
    when 'planes_tratamiento'       then v_fila ->> 'id_plan'
    when 'prescripciones_ejercicio' then v_fila ->> 'id_prescripcion'
    when 'usuarios'                 then v_fila ->> 'id_usuario'
    when 'medicos'                  then v_fila ->> 'id_medico'
    when 'citas'                    then v_fila ->> 'id_cita'
    when 'ejercicios_catalogo'      then v_fila ->> 'id_ejercicio'
    when 'evaluaciones_goniometro'  then v_fila ->> 'id_evaluacion'
    when 'altas_paciente'           then v_fila ->> 'id_alta'
    else null
  end;

  foreach k in array v_ocultar loop
    if v_antes   ? k then v_antes   := v_antes   - k; end if;
    if v_despues ? k then v_despues := v_despues - k; end if;
  end loop;

  insert into public.bitacora_auditoria
    (id_usuario, rol, accion, tabla, id_registro, datos_antes, datos_despues, detalle)
  values
    (app.id_usuario(), coalesce(app.rol(), 'sistema'), lower(tg_op), tg_table_name, v_id,
     v_antes, v_despues, tg_table_name || ' ' || lower(tg_op));

  return coalesce(new, old);
end $fn$;

do $$
declare t text;
begin
  foreach t in array array[
    'pacientes', 'planes_tratamiento', 'prescripciones_ejercicio',
    'usuarios', 'medicos', 'citas', 'ejercicios_catalogo']
  loop
    execute format('drop trigger if exists trg_auditar on public.%I', t);
    execute format('create trigger trg_auditar after insert or update or delete on public.%I
                    for each row execute function public.fn_auditar()', t);
  end loop;
end $$;


-- ============================================================================
--  PASO 17 — Permisos de lectura de las vistas nuevas
-- ============================================================================
grant select on public.vista_profesionales    to authenticated;
grant select on public.vista_sesion_paciente  to authenticated;


-- ============================================================================
--  OPCIONAL — borrar la columna de contrasenas vieja
--  Las contrasenas las guarda Supabase Auth cifradas. `usuarios.password_hash`
--  viene de un sistema anterior y solo puede hacer dano. Descomenta la linea
--  cuando estes segura de que nada la lee.
-- ============================================================================
-- alter table public.usuarios drop column if exists password_hash;


-- ============================================================================
--  PASO 18 — EVALUACION CON GONIOMETRO: ANTES Y DESPUES DE USAR LA APP
--  ---------------------------------------------------------------------------
--  Esto es el resultado de la tesis, y necesitaba tabla propia.
--
--  POR QUE NO SERVIA `metricas_articulares`:
--    esa tabla guarda lo que midio la CAMARA en cada sesion, y de paso un
--    `angulo_goniometro` suelto. Sirve para comparar camara vs goniometro en
--    UNA sesion, pero NO para lo que necesitas: medir al paciente ANTES de
--    empezar con la app y DESPUES de terminar, y ver cuanto mejoro.
--
--  AQUI SE MIDEN DOS COSAS DISTINTAS Y NO HAY QUE CONFUNDIRLAS:
--
--    1. EFECTIVIDAD  -> evaluacion inicial vs final con goniometro.
--                       "el paciente gano 23 grados de flexion"
--                       (vista_evaluacion_pre_post)
--
--    2. EXACTITUD    -> lo que midio la camara vs lo que midio el goniometro
--                       ese mismo dia. "la camara se equivoca 2,4 grados"
--                       (vista_validacion_goniometro)
--
--  La primera dice si el tratamiento sirve. La segunda, si tu sistema mide
--  bien. Un tribunal va a preguntar por las dos.
-- ============================================================================
create table if not exists public.evaluaciones_goniometro (
  id_evaluacion     bigint generated always as identity primary key,
  id_paciente       integer not null references public.pacientes(id_paciente),
  id_plan           integer references public.planes_tratamiento(id_plan),

  momento           varchar(20) not null
    check (momento in ('inicial', 'final')),
  fecha             date not null default current_date,

  articulacion      text not null,
  lado              varchar(15) not null default 'derecho'
    check (lado in ('izquierdo', 'derecho', 'bilateral')),

  -- Lo que midio el GONIOMETRO (el instrumento fisico, a mano).
  angulo_minimo     numeric(5,1) not null,
  angulo_maximo     numeric(5,1) not null,
  rom_goniometro    numeric(5,1) generated always as (angulo_maximo - angulo_minimo) stored,

  -- Lo que midio la CAMARA ese mismo dia, para comparar.
  angulo_app        numeric(5,1),
  id_sesion_referencia integer references public.sesiones(id_sesion),
  umbral_clinico_grados numeric(4,1) not null default 5.0,
  error_absoluto    numeric(5,1) generated always as (abs(angulo_maximo - angulo_app)) stored,
  dentro_umbral     boolean      generated always as
                      (abs(angulo_maximo - angulo_app) <= umbral_clinico_grados) stored,

  -- Contexto clinico de esa medicion.
  dolor_eva         smallint check (dolor_eva is null or (dolor_eva between 0 and 10)),
  instrumento       varchar(60) not null default 'Goniometro universal',
  posicion_paciente varchar(80),

  id_medico_evaluador integer not null references public.medicos(id_medico),
  observaciones     text,
  creado_en         timestamptz not null default now(),

  constraint evaluacion_rango_valido check (angulo_maximo >= angulo_minimo)
);

-- La articulacion usa la MISMA lista cerrada que el resto del sistema.
-- (Si algo falla, se queda como texto libre y el script sigue.)
do $$
declare v_tipo text;
begin
  select atttypid::regtype::text into v_tipo
    from pg_attribute
   where attrelid = 'public.pacientes'::regclass and attname = 'articulacion_principal';

  if v_tipo is not null and v_tipo <> 'text' then
    execute format(
      'alter table public.evaluaciones_goniometro alter column articulacion type %s using articulacion::%s',
      v_tipo, v_tipo);
  end if;
exception when others then
  raise notice 'La articulacion de las evaluaciones queda como texto: %', sqlerrm;
end $$;

-- Una sola evaluacion inicial y una sola final por plan y articulacion:
-- si no, "antes y despues" deja de significar algo.
create unique index if not exists ux_evaluacion_momento
  on public.evaluaciones_goniometro (id_paciente, coalesce(id_plan, 0), articulacion, lado, momento)
  where momento in ('inicial', 'final');

create index if not exists ix_evaluaciones_paciente
  on public.evaluaciones_goniometro (id_paciente, fecha);


-- ---------------------------------------------------------------------------
-- RESULTADO 1 — ¿MEJORO EL PACIENTE?  (antes vs despues)
-- ---------------------------------------------------------------------------
create or replace view public.vista_evaluacion_pre_post as
select
  p.id_paciente,
  p.codigo_anonimo,
  p.nombre_completo,
  p.grado_artrosis_kl,
  ini.articulacion::text as articulacion,
  ini.lado,

  ini.fecha            as fecha_inicial,
  ini.rom_goniometro   as rom_inicial,
  ini.dolor_eva        as dolor_inicial,

  fin.fecha            as fecha_final,
  fin.rom_goniometro   as rom_final,
  fin.dolor_eva        as dolor_final,

  (fin.rom_goniometro - ini.rom_goniometro)                     as ganancia_rom,
  case when ini.rom_goniometro > 0
       then round(100.0 * (fin.rom_goniometro - ini.rom_goniometro) / ini.rom_goniometro, 1)
  end                                                           as ganancia_rom_porcentaje,
  (ini.dolor_eva - fin.dolor_eva)                               as reduccion_dolor,
  (fin.fecha - ini.fecha)                                       as dias_de_tratamiento,

  (select count(*) from public.sesiones s
    where s.id_paciente = p.id_paciente and s.completado
      and s.fecha_hora between ini.fecha and fin.fecha + 1)     as sesiones_realizadas
from public.pacientes p
join public.evaluaciones_goniometro ini
  on ini.id_paciente = p.id_paciente and ini.momento = 'inicial'
left join public.evaluaciones_goniometro fin
  on fin.id_paciente = p.id_paciente and fin.momento = 'final'
 and fin.articulacion = ini.articulacion and fin.lado = ini.lado
 and coalesce(fin.id_plan, 0) = coalesce(ini.id_plan, 0);


-- ---------------------------------------------------------------------------
-- RESULTADO 2 — ¿MIDE BIEN LA CAMARA?  (camara vs goniometro)
-- ---------------------------------------------------------------------------
create or replace view public.vista_validacion_goniometro as
select
  e.articulacion::text                                   as articulacion,
  count(*)                                               as mediciones,
  round(avg(e.error_absoluto), 2)                        as error_medio_grados,
  round(stddev_samp(e.error_absoluto), 2)                as desviacion_estandar,
  min(e.error_absoluto)                                  as error_minimo,
  max(e.error_absoluto)                                  as error_maximo,
  count(*) filter (where e.dentro_umbral)                as dentro_del_umbral,
  round(100.0 * count(*) filter (where e.dentro_umbral) / nullif(count(*), 0), 1)
                                                         as porcentaje_acuerdo,
  round(avg(e.angulo_maximo), 1)                         as promedio_goniometro,
  round(avg(e.angulo_app), 1)                            as promedio_camara,
  round(avg(e.angulo_app - e.angulo_maximo), 2)          as sesgo_medio
from public.evaluaciones_goniometro e
where e.angulo_app is not null
group by e.articulacion;

-- Seguridad: igual que todo lo del paciente.
alter table public.evaluaciones_goniometro enable row level security;

drop policy if exists p_super_todo on public.evaluaciones_goniometro;
create policy p_super_todo on public.evaluaciones_goniometro for all
  using (app.es_super()) with check (app.es_super());

drop policy if exists p_por_paciente on public.evaluaciones_goniometro;
create policy p_por_paciente on public.evaluaciones_goniometro for all
  using (app.paciente_visible(id_paciente))
  with check (app.paciente_visible(id_paciente));

grant select, insert, update, delete on public.evaluaciones_goniometro to authenticated;
grant select on public.vista_evaluacion_pre_post    to authenticated;
grant select on public.vista_validacion_goniometro  to authenticated;

-- Auditar tambien esta tabla (es evidencia de tesis: no se toca sin rastro).
drop trigger if exists trg_auditar on public.evaluaciones_goniometro;
create trigger trg_auditar after insert or update or delete
  on public.evaluaciones_goniometro
  for each row execute function public.fn_auditar();


-- ============================================================================
--  PASO 19 — DATOS PARA LOS REPORTES EN PDF
--  ---------------------------------------------------------------------------
--  El PDF lo dibuja el panel, pero los numeros salen de aqui: una sola
--  consulta trae todo lo que lleva el reporte de un paciente.
-- ============================================================================
create or replace view public.vista_reporte_paciente as
select
  p.id_paciente,
  p.codigo_anonimo,
  p.nombre_completo,
  date_part('year', age(p.fecha_nacimiento))::int as edad,
  p.sexo,
  p.grado_artrosis_kl,
  p.articulacion_principal::text as articulacion_principal,
  p.diagnostico_previo,
  p.fecha_registro,
  mt.nombre_completo  as medico_tratante,
  ft.nombre_completo  as fisioterapeuta,

  (select count(*) from public.sesiones s
    where s.id_paciente = p.id_paciente and s.completado)            as sesiones_completadas,
  (select count(*) from public.citas c
    where c.id_paciente = p.id_paciente and c.estado = 'cumplida')   as citas_cumplidas,
  (select count(*) from public.citas c
    where c.id_paciente = p.id_paciente and c.estado = 'ausente')    as citas_ausentes,
  (select round(avg(rd.nivel_dolor), 1) from public.registro_dolor rd
    where rd.id_paciente = p.id_paciente
      and rd.fecha_registro > now() - interval '30 days')            as dolor_ultimo_mes,
  (select max(ma.rom) from public.metricas_articulares ma
    join public.sesiones s2 on s2.id_sesion = ma.id_sesion
   where s2.id_paciente = p.id_paciente)                             as mejor_rom_camara,

  pp.rom_inicial, pp.rom_final, pp.ganancia_rom,
  pp.dolor_inicial, pp.dolor_final, pp.reduccion_dolor,
  pp.dias_de_tratamiento,

  pl.objetivo_general, pl.fecha_inicio, pl.duracion_estimada_semanas,
  pl.estado as estado_plan
from public.pacientes p
left join public.medicos mt on mt.id_medico = p.id_medico_tratante
left join public.medicos ft on ft.id_medico = p.id_fisioterapeuta_asignado
left join public.vista_evaluacion_pre_post pp on pp.id_paciente = p.id_paciente
left join lateral (
  select * from public.planes_tratamiento x
   where x.id_paciente = p.id_paciente
   order by (x.estado = 'activo') desc, x.fecha_inicio desc limit 1
) pl on true;

grant select on public.vista_reporte_paciente to authenticated;

-- Dejar constancia de cada PDF generado.
create or replace function public.fn_registrar_reporte(
  p_id_paciente integer,
  p_ruta_pdf    text,
  p_desde       date default null,
  p_hasta       date default null,
  p_tipo        text default 'individual')
returns integer
language plpgsql security definer set search_path = public as $fn$
declare
  v_id_medico integer := app.id_medico();
  v_id        integer;
begin
  if v_id_medico is null and not app.es_super() then
    raise exception 'Solo un profesional puede generar reportes';
  end if;

  if p_id_paciente is not null and not app.paciente_visible(p_id_paciente) then
    raise exception 'Ese paciente no esta a tu cargo';
  end if;

  insert into public.reportes_generados
    (id_paciente, id_medico_generador, tipo_reporte,
     rango_fecha_inicio, rango_fecha_fin, ruta_archivo_pdf)
  values
    (p_id_paciente,
     coalesce(v_id_medico, (select id_medico from public.medicos order by id_medico limit 1)),
     p_tipo, p_desde, p_hasta, p_ruta_pdf)
  returning id_reporte into v_id;

  return v_id;
end $fn$;

grant execute on function public.fn_registrar_reporte(integer, text, date, date, text) to authenticated;

-- Deposito donde viven los PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reportes', 'reportes', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists p_reportes_rw on storage.objects;
create policy p_reportes_rw on storage.objects for all to authenticated
  using (bucket_id = 'reportes' and app.id_usuario() is not null)
  with check (bucket_id = 'reportes' and app.id_usuario() is not null);


-- ============================================================================
--  PASO 20 — QUE LAS ALERTAS CORRAN SOLAS (pg_cron)
--  ---------------------------------------------------------------------------
--  Sin esto, las alertas de dolor alto, tecnica deficiente y citas incumplidas
--  solo aparecen cuando alguien aprieta el boton "Revisar alertas".
--
--  pg_cron hay que activarlo antes en:
--    Supabase -> Database -> Extensions -> buscar "pg_cron" -> Enable
--
--  Si no esta activado, este bloque NO falla: solo avisa y sigue.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no esta activado. Actívalo en Database -> Extensions y vuelve a correr este archivo para programar las alertas.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'fisioclin_alertas') then
    perform cron.unschedule('fisioclin_alertas');
  end if;
  perform cron.schedule('fisioclin_alertas', '0 7 * * *',
                        'select public.fn_revision_alertas()');

  if exists (select 1 from cron.job where jobname = 'fisioclin_limpieza') then
    perform cron.unschedule('fisioclin_limpieza');
  end if;
  perform cron.schedule('fisioclin_limpieza', '0 3 * * 0',
                        'select public.fn_limpiar_intentos_viejos()');

  raise notice 'Alertas programadas: todos los dias 07:00 UTC.';
exception when others then
  raise notice 'No se pudieron programar las alertas: %', sqlerrm;
end $$;


-- ============================================================================
--  PASO 21 — LAS EVALUACIONES QUEDAN EN EL HISTORIAL CLINICO
--  ---------------------------------------------------------------------------
--  Una evaluacion con goniometro es un acto clinico: tiene que quedar en la
--  historia del paciente, no solo en una tabla de mediciones. Asi el medico
--  abre el historial y ve la linea de tiempo completa:
--
--     Evaluacion inicial  ->  notas  ->  controles  ->  Evaluacion final  ->  Alta
--
--  Lo escribe la base sola cuando se registra la evaluacion. Nadie se puede
--  olvidar de anotarlo.
-- ============================================================================

-- El historial tiene que aceptar los tipos nuevos.
select public.fn_soltar_checks('public.historial_clinico', 'tipo_entrada');

alter table public.historial_clinico
  add constraint historial_clinico_tipo_entrada_check check (tipo_entrada in (
    'evolucion', 'diagnostico', 'indicacion', 'cambio_tratamiento',
    'observacion_general', 'radiografia', 'estudio',
    -- nuevos:
    'evaluacion_inicial', 'evaluacion_final', 'alta_medica'
  ));

create or replace function public.fn_evaluacion_al_historial()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_tipo    varchar(40);
  v_titulo  text;
  v_cuerpo  text;
  v_ini     public.evaluaciones_goniometro;
  v_lado    text := case new.lado when 'bilateral' then 'bilateral' else new.lado end;
begin
  v_tipo := case new.momento
    when 'inicial' then 'evaluacion_inicial'
    when 'final'   then 'evaluacion_final'
    else 'evolucion'
  end;

  v_titulo := case new.momento
    when 'inicial' then 'Evaluacion inicial con goniometro'
    else 'Evaluacion final con goniometro'
  end;
  v_titulo := v_titulo || ' - ' || new.articulacion::text || ' ' || v_lado;

  v_cuerpo :=
    'Medicion con ' || new.instrumento || '.' ||
    E'\n' || 'Rango: ' || new.angulo_minimo || ' a ' || new.angulo_maximo ||
    ' grados (recorrido util: ' || (new.angulo_maximo - new.angulo_minimo) || ' grados).' ||
    coalesce(E'\n' || 'Posicion: ' || new.posicion_paciente, '') ||
    coalesce(E'\n' || 'Dolor referido: ' || new.dolor_eva || '/10.', '');

  -- Si la camara midio ese mismo dia, se deja la comparacion escrita.
  if new.angulo_app is not null then
    v_cuerpo := v_cuerpo || E'\n' ||
      'La aplicacion midio ' || new.angulo_app || ' grados: diferencia de ' ||
      abs(new.angulo_maximo - new.angulo_app) || ' grados respecto al goniometro (' ||
      case when abs(new.angulo_maximo - new.angulo_app) <= new.umbral_clinico_grados
           then 'dentro' else 'FUERA' end ||
      ' del umbral clinico de ' || new.umbral_clinico_grados || ' grados).';
  end if;

  -- En la FINAL se escribe cuanto mejoro respecto a la inicial. Ese es el dato
  -- que busca cualquiera que abra la historia.
  if new.momento = 'final' then
    select * into v_ini
      from public.evaluaciones_goniometro e
     where e.id_paciente = new.id_paciente
       and e.momento = 'inicial'
       and e.articulacion = new.articulacion
       and e.lado = new.lado
     order by e.fecha limit 1;

    if found then
      v_cuerpo := v_cuerpo || E'\n\n' || 'RESULTADO DEL TRATAMIENTO:' || E'\n' ||
        'Recorrido inicial ' || v_ini.rom_goniometro || ' grados -> final ' ||
        (new.angulo_maximo - new.angulo_minimo) || ' grados. ' ||
        'Ganancia de ' || ((new.angulo_maximo - new.angulo_minimo) - v_ini.rom_goniometro) ||
        ' grados en ' || (new.fecha - v_ini.fecha) || ' dias.';

      if v_ini.dolor_eva is not null and new.dolor_eva is not null then
        v_cuerpo := v_cuerpo || E'\n' ||
          'Dolor: de ' || v_ini.dolor_eva || '/10 a ' || new.dolor_eva || '/10.';
      end if;
    else
      v_cuerpo := v_cuerpo || E'\n\n' ||
        'ATENCION: no hay evaluacion inicial de esta articulacion, asi que no se ' ||
        'puede calcular la mejora.';
    end if;
  end if;

  insert into public.historial_clinico
    (id_paciente, id_medico, tipo_entrada, titulo, contenido,
     fecha_registro, visible_para_paciente)
  values
    (new.id_paciente, new.id_medico_evaluador, v_tipo, v_titulo, v_cuerpo,
     new.fecha::timestamptz, true);

  return new;
end $fn$;

drop trigger if exists trg_evaluacion_al_historial on public.evaluaciones_goniometro;
create trigger trg_evaluacion_al_historial
  after insert on public.evaluaciones_goniometro
  for each row execute function public.fn_evaluacion_al_historial();


-- ============================================================================
--  PASO 22 — EL ALTA DEL PACIENTE
--  ---------------------------------------------------------------------------
--  Cuando el paciente termina, hace falta dejar constancia de POR QUE termino
--  y EN QUE ESTADO quedo. No basta con desactivarlo: desactivar no distingue
--  entre "se curo", "abandono" y "se fue a otra ciudad", y esas tres cosas
--  significan cosas opuestas en una tesis.
--
--  El alta puede ser TEMPORAL ("por ahora esta bien, control en 3 meses") o
--  DEFINITIVA. Por eso `requiere_control` y `fecha_control_sugerida`.
-- ============================================================================

-- Un paciente ya no es solo activo/inactivo: ahora se sabe en que punto esta.
alter table public.pacientes
  add column if not exists estado_tratamiento varchar(20) not null default 'en_tratamiento';

alter table public.pacientes drop constraint if exists pacientes_estado_tratamiento_check;
alter table public.pacientes
  add constraint pacientes_estado_tratamiento_check check (estado_tratamiento in (
    'en_tratamiento', 'de_alta', 'alta_temporal', 'suspendido', 'abandono', 'derivado'
  ));

create table if not exists public.altas_paciente (
  id_alta            bigint generated always as identity primary key,
  id_paciente        integer not null references public.pacientes(id_paciente),
  id_plan            integer references public.planes_tratamiento(id_plan),
  id_evaluacion_final bigint references public.evaluaciones_goniometro(id_evaluacion),

  fecha_alta         date not null default current_date,
  tipo_alta          varchar(25) not null default 'alta_medica'
    check (tipo_alta in (
      'alta_medica',      -- cumplio los objetivos
      'alta_temporal',    -- esta bien por ahora, pero vuelve a control
      'alta_voluntaria',  -- el paciente decide dejarlo
      'abandono',         -- dejo de venir
      'derivado'          -- pasa a otro servicio o especialidad
    )),

  -- Como quedo el paciente.
  cumplio_objetivos  boolean not null default true,
  estado_funcional   varchar(30) not null default 'funcional'
    check (estado_funcional in (
      'recuperado', 'funcional', 'mejoria_parcial', 'sin_cambios', 'empeoro'
    )),
  rom_alcanzado      numeric(5,1),
  dolor_final        smallint check (dolor_final is null or (dolor_final between 0 and 10)),
  motivo             text not null,
  recomendaciones    text,

  -- ¿Vuelve?
  requiere_control        boolean not null default false,
  fecha_control_sugerida  date,

  id_medico_alta     integer not null references public.medicos(id_medico),
  creado_en          timestamptz not null default now(),

  constraint alta_control_coherente check (
    (requiere_control = false) or (fecha_control_sugerida is not null)
  )
);

create index if not exists ix_altas_paciente on public.altas_paciente (id_paciente, fecha_alta desc);

-- Un alta cierra el ciclo: cambia el estado del paciente, cierra el plan,
-- lo escribe en el historial y le avisa al paciente. Todo de una vez.
create or replace function public.fn_procesar_alta()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_id_usuario integer;
  v_cuerpo     text;
  v_estado     varchar(20);
begin
  v_estado := case new.tipo_alta
    when 'alta_medica'     then 'de_alta'
    when 'alta_temporal'   then 'alta_temporal'
    when 'alta_voluntaria' then 'suspendido'
    when 'abandono'        then 'abandono'
    when 'derivado'        then 'derivado'
  end;

  update public.pacientes
     set estado_tratamiento = v_estado
   where id_paciente = new.id_paciente;

  -- Cerrar el plan que estaba abierto.
  if new.id_plan is not null then
    update public.planes_tratamiento
       set estado = case when new.tipo_alta in ('alta_medica', 'alta_temporal')
                         then 'completado' else 'abandonado' end,
           fecha_fin_real = new.fecha_alta
     where id_plan = new.id_plan;
  else
    update public.planes_tratamiento
       set estado = case when new.tipo_alta in ('alta_medica', 'alta_temporal')
                         then 'completado' else 'abandonado' end,
           fecha_fin_real = new.fecha_alta
     where id_paciente = new.id_paciente and estado = 'activo';
  end if;

  -- Escribirlo en la historia clinica.
  v_cuerpo :=
    'Tipo de alta: ' || replace(new.tipo_alta, '_', ' ') || '.' ||
    E'\n' || 'Estado funcional al alta: ' || replace(new.estado_funcional, '_', ' ') || '.' ||
    E'\n' || 'Objetivos del plan: ' ||
       case when new.cumplio_objetivos then 'CUMPLIDOS' else 'NO cumplidos' end || '.' ||
    coalesce(E'\n' || 'Recorrido articular alcanzado: ' || new.rom_alcanzado || ' grados.', '') ||
    coalesce(E'\n' || 'Dolor al alta: ' || new.dolor_final || '/10.', '') ||
    E'\n\n' || 'Motivo: ' || new.motivo ||
    coalesce(E'\n\n' || 'Recomendaciones: ' || new.recomendaciones, '') ||
    case when new.requiere_control
         then E'\n\n' || 'CONTROL PENDIENTE para el ' ||
              to_char(new.fecha_control_sugerida, 'DD/MM/YYYY') || '.'
         else E'\n\n' || 'No requiere control programado.' end;

  insert into public.historial_clinico
    (id_paciente, id_medico, tipo_entrada, titulo, contenido,
     fecha_registro, visible_para_paciente)
  values
    (new.id_paciente, new.id_medico_alta, 'alta_medica',
     'Alta del tratamiento', v_cuerpo, new.fecha_alta::timestamptz, true);

  -- Avisarle al paciente.
  select id_usuario into v_id_usuario from public.pacientes where id_paciente = new.id_paciente;

  insert into public.notificaciones
    (id_usuario, id_paciente, tipo, categoria, severidad, titulo, mensaje, accion_ruta)
  values
    (v_id_usuario, new.id_paciente, 'sistema', 'sistema', 'info',
     case when new.tipo_alta in ('alta_medica', 'alta_temporal')
          then 'Terminaste tu tratamiento'
          else 'Tu tratamiento fue cerrado' end,
     new.motivo ||
       case when new.requiere_control
            then ' Te esperamos para tu control el ' ||
                 to_char(new.fecha_control_sugerida, 'DD/MM/YYYY') || '.'
            else '' end,
     '/historial');

  return new;
end $fn$;

drop trigger if exists trg_procesar_alta on public.altas_paciente;
create trigger trg_procesar_alta
  after insert on public.altas_paciente
  for each row execute function public.fn_procesar_alta();

-- ---------------------------------------------------------------------------
-- Dar de alta desde el panel.
--   Exige que exista la evaluacion FINAL con goniometro: sin esa medicion no
--   hay forma de decir que el paciente mejoro, y el alta seria una opinion.
--   Solo se puede saltar a proposito, con p_forzar = true (abandono, traslado).
-- ---------------------------------------------------------------------------
create or replace function public.fn_dar_alta(
  p_id_paciente      integer,
  p_tipo_alta        text    default 'alta_medica',
  p_estado_funcional text    default 'funcional',
  p_motivo           text    default null,
  p_recomendaciones  text    default null,
  p_requiere_control boolean default false,
  p_fecha_control    date    default null,
  p_forzar           boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_eval   public.evaluaciones_goniometro;
  v_plan   integer;
  v_medico integer := app.id_medico();
  v_id     bigint;
begin
  if not app.paciente_visible(p_id_paciente) then
    raise exception 'Ese paciente no esta a tu cargo';
  end if;

  if v_medico is null then
    select id_medico_tratante into v_medico from public.pacientes where id_paciente = p_id_paciente;
  end if;

  select * into v_eval
    from public.evaluaciones_goniometro
   where id_paciente = p_id_paciente and momento = 'final'
   order by fecha desc limit 1;

  if not found and not p_forzar then
    raise exception 'Falta la evaluacion FINAL con goniometro. Registrala antes de dar de alta, o marca "dar de alta igualmente" si el paciente abandono o fue derivado.';
  end if;

  select id_plan into v_plan
    from public.planes_tratamiento
   where id_paciente = p_id_paciente and estado = 'activo'
   order by fecha_inicio desc limit 1;

  insert into public.altas_paciente
    (id_paciente, id_plan, id_evaluacion_final, tipo_alta, estado_funcional,
     cumplio_objetivos, rom_alcanzado, dolor_final, motivo, recomendaciones,
     requiere_control, fecha_control_sugerida, id_medico_alta)
  values
    (p_id_paciente, v_plan, v_eval.id_evaluacion, p_tipo_alta, p_estado_funcional,
     p_estado_funcional in ('recuperado', 'funcional'),
     v_eval.rom_goniometro, v_eval.dolor_eva,
     coalesce(p_motivo, 'Alta por finalizacion del plan de tratamiento.'),
     p_recomendaciones, p_requiere_control, p_fecha_control, v_medico)
  returning id_alta into v_id;

  return jsonb_build_object('id_alta', v_id, 'con_evaluacion_final', v_eval.id_evaluacion is not null);
end $fn$;

-- Reabrir: el paciente vuelve y hay que retomar el tratamiento.
create or replace function public.fn_reabrir_tratamiento(p_id_paciente integer, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  if not app.paciente_visible(p_id_paciente) then
    raise exception 'Ese paciente no esta a tu cargo';
  end if;

  update public.pacientes
     set estado_tratamiento = 'en_tratamiento', activo = true
   where id_paciente = p_id_paciente;

  insert into public.historial_clinico
    (id_paciente, id_medico, tipo_entrada, titulo, contenido, visible_para_paciente)
  values
    (p_id_paciente, app.id_medico(), 'evolucion', 'Reingreso al tratamiento',
     coalesce(p_motivo, 'El paciente vuelve a tratamiento tras el alta.'), true);

  return jsonb_build_object('ok', true);
end $fn$;

-- ---------------------------------------------------------------------------
-- El tablero de altas: quien termino, como quedo y a quien hay que citar.
-- ---------------------------------------------------------------------------
create or replace view public.vista_altas as
select
  a.id_alta, a.fecha_alta, a.tipo_alta, a.estado_funcional, a.cumplio_objetivos,
  a.rom_alcanzado, a.dolor_final, a.motivo, a.recomendaciones,
  a.requiere_control, a.fecha_control_sugerida,
  p.id_paciente, p.codigo_anonimo, p.nombre_completo,
  p.articulacion_principal::text as articulacion_principal,
  p.grado_artrosis_kl, p.estado_tratamiento,
  m.nombre_completo as medico_alta,
  pp.rom_inicial, pp.rom_final, pp.ganancia_rom, pp.reduccion_dolor,
  pp.dias_de_tratamiento, pp.sesiones_realizadas,
  (a.requiere_control and a.fecha_control_sugerida < current_date) as control_vencido
from public.altas_paciente a
join public.pacientes p on p.id_paciente = a.id_paciente
join public.medicos   m on m.id_medico   = a.id_medico_alta
left join public.vista_evaluacion_pre_post pp on pp.id_paciente = p.id_paciente;

-- Seguridad, igual que todo lo del paciente.
alter table public.altas_paciente enable row level security;

drop policy if exists p_super_todo on public.altas_paciente;
create policy p_super_todo on public.altas_paciente for all
  using (app.es_super()) with check (app.es_super());

drop policy if exists p_por_paciente on public.altas_paciente;
create policy p_por_paciente on public.altas_paciente for all
  using (app.paciente_visible(id_paciente))
  with check (app.paciente_visible(id_paciente));

grant select, insert, update on public.altas_paciente to authenticated;
grant select on public.vista_altas to authenticated;
grant execute on function public.fn_dar_alta(integer, text, text, text, text, boolean, date, boolean) to authenticated;
grant execute on function public.fn_reabrir_tratamiento(integer, text) to authenticated;

drop trigger if exists trg_auditar on public.altas_paciente;
create trigger trg_auditar after insert or update or delete
  on public.altas_paciente
  for each row execute function public.fn_auditar();


-- ============================================================================
--  PASO 23 — REPORTES: TODO LO QUE SE PUEDE SACAR DEL SISTEMA
--  ---------------------------------------------------------------------------
--  La gracia de estas vistas es que NO tienen un "if soy superusuario".
--  El administrador y el medico consultan EXACTAMENTE lo mismo, y cada uno
--  recibe lo suyo:
--
--    · el ADMINISTRADOR ve los 6 pacientes, los 5 profesionales, todo
--    · el Dr. Martin ve sus 3 pacientes y sus propios numeros
--
--  Eso lo hace el PASO 24 (security_invoker), que es lo que obliga a estas
--  vistas a respetar las reglas RLS de cada tabla.
-- ============================================================================

-- El tipo de reporte ya no es solo individual/general.
select public.fn_soltar_checks('public.reportes_generados', 'tipo_reporte');

alter table public.reportes_generados
  add constraint reportes_generados_tipo_check check (tipo_reporte in (
    'individual',     -- un paciente
    'general',        -- todos los pacientes
    'usuarios',       -- cuentas y accesos        (solo tiene sentido para el admin)
    'profesionales',  -- rendimiento por profesional
    'evaluaciones',   -- goniometro: antes/despues y validacion
    'adherencia',     -- cumplimiento de las rutinas
    'auditoria'       -- bitacora                 (solo el admin)
  ));


-- ---------------------------------------------------------------------------
-- 23.1  REPORTE DE USUARIOS Y ACCESOS
--   Quien tiene cuenta, con que rol, si entro alguna vez y que modulos tiene.
--   Un medico normal solo se vera a si mismo; el administrador, a todos.
-- ---------------------------------------------------------------------------
create or replace view public.vista_reporte_usuarios as
select
  u.id_usuario,
  u.nombre_usuario,
  u.email,
  u.rol::text                         as rol,
  u.activo,
  (u.auth_user_id is not null)        as tiene_cuenta_de_acceso,
  u.debe_cambiar_password,
  u.ultimo_acceso,
  case when u.ultimo_acceso is null then 'nunca ingreso'
       when u.ultimo_acceso > now() - interval '7 days'  then 'activo esta semana'
       when u.ultimo_acceso > now() - interval '30 days' then 'activo este mes'
       else 'sin actividad hace mas de un mes' end       as actividad,
  u.creado_en                         as fecha_de_alta,
  m.id_medico,
  m.nombre_completo                   as nombre_profesional,
  m.tipo_profesional::text            as tipo_profesional,
  m.cedula_profesional,
  m.especialidad,
  p.codigo_anonimo                    as codigo_paciente,
  (select count(*) from public.catalogo_modulos cm
    where jsonb_typeof(u.modulos_permitidos -> cm.clave) = 'boolean'
      and (u.modulos_permitidos -> cm.clave)::text::boolean)  as modulos_concedidos,
  (select count(*) from public.pacientes pa
    where pa.id_medico_tratante = m.id_medico and pa.activo)  as pacientes_a_cargo
from public.usuarios u
left join public.medicos   m on m.id_usuario = u.id_usuario
left join public.pacientes p on p.id_usuario = u.id_usuario;


-- ---------------------------------------------------------------------------
-- 23.2  REPORTE DE PROFESIONALES
--   Cuanto trabajo lleva cada uno. Para el administrador es el reparto de
--   carga; para el medico, su propia hoja de servicio.
-- ---------------------------------------------------------------------------
create or replace view public.vista_reporte_profesionales as
select
  m.id_medico,
  m.nombre_completo,
  m.tipo_profesional::text as tipo_profesional,
  m.especialidad,
  m.cedula_profesional,
  m.consultorio,
  m.horario_atencion,
  u.email,
  u.activo,
  u.ultimo_acceso,

  (select count(*) from public.pacientes p
    where p.id_medico_tratante = m.id_medico)                        as pacientes_total,
  (select count(*) from public.pacientes p
    where p.id_medico_tratante = m.id_medico and p.activo)           as pacientes_activos,
  (select count(*) from public.pacientes p
    where p.id_fisioterapeuta_asignado = m.id_medico)                as pacientes_como_fisio,

  (select count(*) from public.planes_tratamiento pl
    where pl.id_medico_responsable = m.id_medico and pl.estado = 'activo')  as planes_activos,
  (select count(*) from public.prescripciones_ejercicio pe
    where pe.id_medico_prescriptor = m.id_medico and pe.activo)      as prescripciones_activas,
  (select count(*) from public.sesiones s
    where s.id_profesional_supervisor = m.id_medico)                 as sesiones_supervisadas,
  (select count(*) from public.evaluaciones_goniometro e
    where e.id_medico_evaluador = m.id_medico)                       as evaluaciones_hechas,
  (select count(*) from public.altas_paciente a
    where a.id_medico_alta = m.id_medico)                            as altas_dadas,
  (select count(*) from public.historial_clinico h
    where h.id_medico = m.id_medico)                                 as notas_clinicas,

  (select count(*) from public.citas c
    where c.id_medico = m.id_medico and c.estado = 'cumplida')       as citas_cumplidas,
  (select count(*) from public.citas c
    where c.id_medico = m.id_medico and c.estado = 'ausente')        as citas_con_ausencia,
  (select count(*) from public.citas c
    where c.id_medico = m.id_medico
      and c.estado in ('programada', 'confirmada')
      and c.fecha_hora >= now())                                     as citas_por_venir
from public.medicos m
join public.usuarios u on u.id_usuario = m.id_usuario;


-- ---------------------------------------------------------------------------
-- 23.3  REPORTE DE EVALUACIONES (la tabla que va al anexo de la tesis)
--   Una fila por medicion, lista para exportar a Excel.
-- ---------------------------------------------------------------------------
create or replace view public.vista_reporte_evaluaciones as
select
  e.id_evaluacion,
  p.codigo_anonimo,
  p.nombre_completo            as paciente,
  date_part('year', age(p.fecha_nacimiento))::int as edad,
  p.sexo,
  p.grado_artrosis_kl,
  e.momento,
  e.fecha,
  e.articulacion::text         as articulacion,
  e.lado,
  e.angulo_minimo,
  e.angulo_maximo,
  e.rom_goniometro,
  e.angulo_app,
  e.error_absoluto,
  e.dentro_umbral,
  e.umbral_clinico_grados,
  e.dolor_eva,
  e.instrumento,
  e.posicion_paciente,
  m.nombre_completo            as evaluador,
  e.observaciones
from public.evaluaciones_goniometro e
join public.pacientes p on p.id_paciente = e.id_paciente
join public.medicos   m on m.id_medico   = e.id_medico_evaluador;


-- ---------------------------------------------------------------------------
-- 23.4  REPORTE DE ADHERENCIA
--   Lo que se le mando hacer contra lo que de verdad hizo.
-- ---------------------------------------------------------------------------
create or replace view public.vista_reporte_adherencia as
select
  p.id_paciente,
  p.codigo_anonimo,
  p.nombre_completo,
  p.estado_tratamiento,
  mt.nombre_completo                             as medico_tratante,
  pl.objetivo_general,
  pl.fecha_inicio,
  pl.duracion_estimada_semanas,
  pl.estado                                      as estado_plan,

  count(distinct pe.id_prescripcion)             as ejercicios_prescritos,
  coalesce(sum(pe.frecuencia_semanal), 0)        as sesiones_esperadas_por_semana,
  coalesce(sum(pe.frecuencia_semanal) *
           least(pl.duracion_estimada_semanas,
                 greatest(1, ceil((current_date - pl.fecha_inicio) / 7.0))), 0)::int
                                                 as sesiones_esperadas_hasta_hoy,
  (select count(*) from public.sesiones s
    where s.id_paciente = p.id_paciente and s.completado
      and s.fecha_hora >= pl.fecha_inicio)       as sesiones_realizadas,
  (select count(*) from public.sesiones s
    where s.id_paciente = p.id_paciente and s.resultado_evaluacion = 'correcto'
      and s.fecha_hora >= pl.fecha_inicio)       as sesiones_correctas,
  (select max(s.fecha_hora) from public.sesiones s
    where s.id_paciente = p.id_paciente)         as ultima_sesion,
  (select count(*) from public.citas c
    where c.id_paciente = p.id_paciente and c.estado = 'ausente')  as citas_perdidas
from public.pacientes p
left join public.medicos mt on mt.id_medico = p.id_medico_tratante
left join lateral (
  select * from public.planes_tratamiento x
   where x.id_paciente = p.id_paciente
   order by (x.estado = 'activo') desc, x.fecha_inicio desc limit 1
) pl on true
left join public.prescripciones_ejercicio pe
       on pe.id_plan = pl.id_plan and pe.activo
group by p.id_paciente, p.codigo_anonimo, p.nombre_completo, p.estado_tratamiento,
         mt.nombre_completo, pl.objetivo_general, pl.fecha_inicio,
         pl.duracion_estimada_semanas, pl.estado;


-- ---------------------------------------------------------------------------
-- 23.5  RESUMEN DE LA UNIDAD (la portada de cualquier reporte)
--   Una sola fila con los numeros gruesos.
-- ---------------------------------------------------------------------------
create or replace view public.vista_reporte_resumen as
select
  (select count(*) from public.pacientes)                                    as pacientes_total,
  (select count(*) from public.pacientes where activo)                       as pacientes_activos,
  (select count(*) from public.pacientes
    where estado_tratamiento = 'en_tratamiento')                             as en_tratamiento,
  (select count(*) from public.pacientes
    where estado_tratamiento in ('de_alta', 'alta_temporal'))                as dados_de_alta,
  (select count(*) from public.pacientes where estado_tratamiento = 'abandono') as abandonos,
  (select count(*) from public.pacientes where grado_artrosis_kl = 2)        as kl_grado_2,
  (select count(*) from public.pacientes where grado_artrosis_kl = 3)        as kl_grado_3,

  (select count(*) from public.medicos)                                      as profesionales,
  (select count(*) from public.planes_tratamiento where estado = 'activo')   as planes_activos,
  (select count(*) from public.ejercicios_catalogo where activo)             as ejercicios_en_catalogo,
  (select count(*) from public.ejercicios_catalogo
    where video_estado = 'listo')                                            as ejercicios_con_video,

  (select count(*) from public.sesiones)                                     as sesiones_total,
  (select count(*) from public.sesiones where completado)                    as sesiones_completadas,
  (select count(*) from public.sesiones
    where fecha_hora > now() - interval '30 days')                           as sesiones_ultimo_mes,
  (select count(*) from public.repeticiones_ejercicio)                       as repeticiones_total,

  (select count(*) from public.citas where estado = 'cumplida')              as citas_cumplidas,
  (select count(*) from public.citas where estado = 'ausente')               as citas_con_ausencia,

  (select count(*) from public.evaluaciones_goniometro)                      as evaluaciones_total,
  (select count(*) from public.evaluaciones_goniometro where momento = 'inicial') as evaluaciones_iniciales,
  (select count(*) from public.evaluaciones_goniometro where momento = 'final')   as evaluaciones_finales,
  (select round(avg(ganancia_rom), 1) from public.vista_evaluacion_pre_post
    where ganancia_rom is not null)                                          as ganancia_rom_promedio,
  (select round(avg(reduccion_dolor), 1) from public.vista_evaluacion_pre_post
    where reduccion_dolor is not null)                                       as reduccion_dolor_promedio,
  (select round(avg(error_absoluto), 2) from public.evaluaciones_goniometro
    where angulo_app is not null)                                            as error_camara_promedio,
  (select round(100.0 * count(*) filter (where dentro_umbral) / nullif(count(*), 0), 1)
     from public.evaluaciones_goniometro where angulo_app is not null)       as acuerdo_camara_porcentaje;


grant select on public.vista_reporte_usuarios      to authenticated;
grant select on public.vista_reporte_profesionales to authenticated;
grant select on public.vista_reporte_evaluaciones  to authenticated;
grant select on public.vista_reporte_adherencia    to authenticated;
grant select on public.vista_reporte_resumen       to authenticated;


-- ============================================================================
--  PASO 24 — ARREGLO IMPORTANTE: QUE LAS VISTAS RESPETEN LAS REGLAS
--  ---------------------------------------------------------------------------
--  ESTO ERA UN AGUJERO DE VERDAD, y estaba en todo lo que escribi antes.
--
--  En PostgreSQL, una vista corre con los permisos de QUIEN LA CREO (postgres),
--  no de quien la consulta. Resultado: aunque la tabla `pacientes` tuviera sus
--  reglas RLS perfectas, cualquier medico que consultara
--  `vista_sesiones_detalle` o `vista_reporte_paciente` habria visto a TODOS los
--  pacientes de la unidad, no solo a los suyos. Las reglas se saltaban por la
--  puerta de atras.
--
--  `security_invoker = on` invierte eso: la vista pasa a correr con los
--  permisos de QUIEN PREGUNTA. A partir de aqui, el administrador y el medico
--  pueden mandar la misma consulta y cada uno recibe lo suyo.
--
--  Excepcion: `vista_profesionales`, que es la lista para elegir medico al
--  registrar un paciente. Esa tiene que verla todo el mundo completa, y no
--  expone nada clinico.
-- ============================================================================
do $$
declare v text;
begin
  foreach v in array array[
    'vista_sesion_actual',
    'vista_sesion_paciente',
    'vista_usuarios_admin',
    'vista_sesiones_detalle',
    'vista_progreso_semanal',
    'vista_evaluacion_pre_post',
    'vista_validacion_goniometro',
    'vista_reporte_paciente',
    'vista_altas',
    'vista_reporte_usuarios',
    'vista_reporte_profesionales',
    'vista_reporte_evaluaciones',
    'vista_reporte_adherencia',
    'vista_reporte_resumen']
  loop
    begin
      execute format('alter view public.%I set (security_invoker = on)', v);
    exception when others then
      raise notice 'No se pudo asegurar la vista %: %', v, sqlerrm;
    end;
  end loop;
end $$;


-- ============================================================================
--  PASO 25 — PLAN 2 / ARREGLO 4: RENOMBRAR ADJUNTOS
--  ---------------------------------------------------------------------------
--  Para las bases que ya estaban desplegadas antes de este arreglo: el
--  `create table if not exists` de arriba no vuelve a correr sobre una tabla
--  que ya existe, así que la columna se agrega aparte.
-- ============================================================================
alter table public.adjuntos_clinicos
  add column if not exists nombre_visible varchar(200);


-- ============================================================================
--  ARCHIVO 1 TERMINADO.
--  Ahora abre una consulta NUEVA y corre el ARCHIVO 2 (los datos).
-- ============================================================================
select 'Base de datos lista. Ahora corre el ARCHIVO 2 (datos) en una consulta aparte.' as resultado;
