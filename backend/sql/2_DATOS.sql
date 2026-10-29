-- ============================================================================
--  FisioClin — ARCHIVO 2 de 3:  LOS DATOS
--  Panel del médico y del superusuario — COSSMIL
-- ============================================================================
--
--  CÓMO SE USA
--    1. Corre PRIMERO el ARCHIVO 1 (la base de datos). Sin eso, este falla.
--    2. Supabase -> SQL Editor -> New query
--    3. Pega ESTE archivo completo y dale RUN
--    4. Al final te muestra cuántos registros quedó cada tabla
--
--  Carga como MÍNIMO 5 registros de cada cosa.
--  Si ya estaban cargados, se salta solo: no duplica nada y no da error.
--  Para borrarlos y volver a empezar: EXTRA_borrar_datos.sql
-- ============================================================================


-- ============================================================================
--  REVISIÓN PREVIA — ¿está el ARCHIVO A corrido?
-- ============================================================================
do $revision$
declare v_falta text[];
begin
  if to_regclass('public.catalogo_modulos') is null then
    raise exception 'Falta correr el ARCHIVO 1 primero (falta correr el ARCHIVO 1).';
  end if;

  v_falta := public.fn_faltan_valores_enum('public.usuarios', 'rol',
             array['superusuario','medico_fisiatra','fisioterapeuta','paciente'])
          || public.fn_faltan_valores_enum('public.medicos', 'tipo_profesional',
             array['medico_fisiatra','fisioterapeuta'])
          || public.fn_faltan_valores_enum('public.pacientes', 'articulacion_principal',
             array['rodilla','cadera','tobillo','hombro']);

  if array_length(v_falta, 1) > 0 then
    raise exception 'A las listas cerradas les faltan estos valores: %. Vuelve a correr el ARCHIVO 1.',
      array_to_string(v_falta, ', ');
  end if;
end $revision$;

-- ============================================================================
--  ARREGLO PREVIO — la funcion de auditoria
--  ---------------------------------------------------------------------------
--  Se vuelve a crear aqui a proposito, por si el archivo 1 dejo la version
--  vieja. Esa version sacaba la clave primaria con `new.id_paciente` dentro de
--  un CASE, y eso revienta: PL/pgSQL resuelve TODOS los campos del CASE aunque
--  solo use una rama, asi que al auditar `usuarios` se quejaba de que no
--  existe `id_paciente`. Esta version busca la clave sobre la fila convertida
--  a jsonb, donde pedir algo que no esta devuelve nulo en vez de fallar.
--
--  Si ya corriste el arreglo por separado, esto no cambia nada.
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


-- ============================================================================
--  LOS DATOS
--  ---------------------------------------------------------------------------
--  Mínimo 5 registros de cada cosa.
--  Si ya estaban cargados, este paso se salta solo: no duplica nada y no da
--  error. Para recargarlos desde cero, corre antes EXTRA_borrar_datos.sql.
-- ============================================================================


-- ============================================================================
--  1. CATÁLOGO DE MÓDULOS  (17 módulos — la lista oficial del panel)
-- ============================================================================
insert into public.catalogo_modulos
  (clave, etiqueta, grupo, orden, solo_superusuario, por_defecto_medico, por_defecto_fisio)
values
  ('inicio',         'Inicio',                    'General',        1,  false, true,  true),
  ('superadmin',     'Centro de control',         'General',        2,  true,  false, false),
  ('pacientes',      'Pacientes',                 'General',        3,  false, true,  true),
  ('medicos',        'Médicos',                   'General',        4,  true,  false, false),
  ('usuarios',       'Usuarios y permisos',       'General',        5,  true,  false, false),
  ('rutinas',        'Prescripción de rutinas',   'Rehabilitación', 6,  false, true,  false),
  ('ejercicios',     'Catálogo de ejercicios',    'Rehabilitación', 7,  false, true,  false),
  ('citas',          'Agenda de controles',       'Rehabilitación', 8,  false, true,  true),
  ('sesiones',       'Sesiones y repeticiones',   'Rehabilitación', 9,  false, true,  true),
  ('evolucion',      'Evolución clínica',         'Rehabilitación', 10, false, true,  false),
  ('reportes',       'Reportes',                  'Rehabilitación', 11, false, true,  true),
  ('solicitudes',    'Solicitudes de acceso',     'Administración', 12, true,  false, false),
  ('auditoria',      'Auditoría',                 'Administración', 13, true,  false, false),
  ('notificaciones', 'Mensajes y avisos',         'Sistema',        14, false, true,  true),
  ('perfil',         'Mi perfil',                 'Sistema',        15, false, true,  true),
  ('configuracion',  'Configuración',             'Sistema',        16, false, true,  true),
  -- FASE 8: la pantalla del goniómetro. Médico y fisioterapeuta la usan los
  -- dos (solo prescripción y evolución clínica quedan exclusivas del médico).
  ('evaluaciones',   'Evaluaciones (goniómetro)', 'Rehabilitación', 17, false, true,  true)
on conflict (clave) do nothing;

-- FASE 7: `reportes` y `configuracion` se podían conceder pero no tenían
-- pantalla. No se borran (rompería lo ya guardado en modulos_permitidos):
-- se desactivan, y `fn_permisos()` ya las excluye solas (cross join ... where
-- cm.activo). `configuracion` se queda así: ninguna fase la construye.
update public.catalogo_modulos set activo = false where clave = 'configuracion';

-- FASE 9: la pantalla de reportes ya existe — se reactiva. El fisioterapeuta
-- también la usa por defecto: el CRUD dice "igual que el doctor, menos
-- prescripción de rutinas y evolución clínica", y reportes no está en esa
-- lista de excepciones. `on conflict do nothing` del insert de arriba no
-- corrige filas que ya existían de una corrida anterior, así que se fuerza
-- acá — es idempotente, correrlo de nuevo no hace nada distinto.
update public.catalogo_modulos
   set activo = true, por_defecto_fisio = true
 where clave = 'reportes';


-- ============================================================================
--  2. TODO LO DEMÁS
-- ============================================================================
do $seed$
declare
  -- usuarios
  u_super  int; u_martin int; u_rojas int; u_salazar int; u_mamani int; u_andrea int;
  u_juan   int; u_maria  int; u_pedro int; u_ana int; u_jose int;
  -- médicos
  m_martin int; m_rojas int; m_salazar int; m_mamani int; m_andrea int;
  -- pacientes
  p_juan int; p_maria int; p_pedro int; p_ana int; p_jose int; p_lucia int;
  -- ejercicios
  e1 int; e2 int; e3 int; e4 int; e5 int; e6 int; e7 int; e8 int; e9 int; e10 int;
  -- planes
  pl_juan int; pl_maria int; pl_pedro int; pl_ana int; pl_jose int;
  -- prescripciones
  pr1 int; pr2 int; pr3 int; pr4 int; pr5 int; pr6 int;
  pr7 int; pr8 int; pr9 int; pr10 int; pr11 int; pr12 int;
  -- sesiones
  s1 int; s2 int; s3 int; s4 int; s5 int; s6 int; s7 int; s8 int; s9 int; s10 int;
  -- historial
  h1 int; h2 int; h3 int; h4 int; h5 int; h6 int; h7 int; h8 int;
  -- auxiliares
  v_sesion int;
  v_i      int;
  v_total  int;
  v_ang    numeric;
  v_ok     boolean;
  v_perm_medico jsonb := '{"inicio":true,"pacientes":true,"ejercicios":true,"rutinas":true,
                           "sesiones":true,"evolucion":true,"citas":true,"notificaciones":true,
                           "reportes":true,"perfil":true,"configuracion":true,
                           "solicitudes":false,"usuarios":false,"medicos":false,"auditoria":false}'::jsonb;
  v_perm_fisio  jsonb := '{"inicio":true,"pacientes":true,"ejercicios":false,"rutinas":false,
                           "sesiones":true,"evolucion":false,"citas":true,"notificaciones":true,
                           "reportes":false,"perfil":true,"configuracion":true,
                           "solicitudes":false,"usuarios":false,"medicos":false,"auditoria":false}'::jsonb;
begin

-- ¿Ya se corrio este archivo antes? Se reconoce por las evaluaciones con
-- goniometro, que solo las carga este archivo. (Antes se miraba PAC-0001, pero
-- ese paciente lo trae el esquema base y hacia que se saltara todo.)
if exists (select 1 from public.evaluaciones_goniometro) then
  raise notice 'Los datos de prueba ya estaban cargados: no se toca nada.';
  return;
end if;

-- ---------------------------------------------------------------------------
-- 2.1  USUARIOS Y PROFESIONALES  —  BUSCAR O CREAR
--   Tu esquema base YA trae 3 medicos y 6 pacientes de ejemplo. Este bloque no
--   los duplica: si ya estan, los reutiliza; si no, los crea. Por eso todo va
--   con `on conflict do nothing` + un `select` que recupera el id.
-- ---------------------------------------------------------------------------

-- Superusuario
insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
values ('superadmin', 'superadmin@fisioclin.bo', 'superusuario', true, false, '{}'::jsonb)
on conflict (email) do nothing;
select id_usuario into u_super from public.usuarios where email = 'superadmin@fisioclin.bo';

-- --- MEDICOS FISIATRAS ------------------------------------------------------
-- Si tu base ya tiene al "Dr. Alejandro Martin", se usa ese y no se crea otro.
select m.id_medico, m.id_usuario into m_martin, u_martin
  from public.medicos m where m.nombre_completo = 'Dr. Alejandro Martin' limit 1;

if m_martin is null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('dr.martin', 'dr.martin@fisioclin.bo', 'medico_fisiatra', true, false, v_perm_medico)
  on conflict (email) do nothing;
  select id_usuario into u_martin from public.usuarios where email = 'dr.martin@fisioclin.bo';

  insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                              cedula_profesional, telefono, biografia, consultorio, horario_atencion)
  values (u_martin, 'Dr. Alejandro Martin', 'medico_fisiatra', 'Medicina Física y Rehabilitación',
          'MP-4821', '+591 70000010',
          'Médico fisiatra con 12 años de experiencia en rehabilitación de rodilla y cadera.',
          'Consultorio 3, planta baja', 'Lun a Vie, 08:00–14:00')
  returning id_medico into m_martin;
end if;

select m.id_medico, m.id_usuario into m_rojas, u_rojas
  from public.medicos m where m.nombre_completo = 'Dra. Daniela Rojas' limit 1;

if m_rojas is null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('dra.rojas', 'dra.rojas@fisioclin.bo', 'medico_fisiatra', true, false, v_perm_medico)
  on conflict (email) do nothing;
  select id_usuario into u_rojas from public.usuarios where email = 'dra.rojas@fisioclin.bo';

  insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                              cedula_profesional, telefono, biografia, consultorio, horario_atencion)
  values (u_rojas, 'Dra. Daniela Rojas', 'medico_fisiatra', 'Medicina Física y Rehabilitación',
          'MP-5307', '+591 70000011', 'Especialista en rehabilitación de columna y hombro.',
          'Consultorio 4, planta baja', 'Lun a Vie, 14:00–19:00')
  returning id_medico into m_rojas;
end if;

-- Tercer fisiatra (de guardia).
select m.id_medico, m.id_usuario into m_salazar, u_salazar
  from public.medicos m where m.cedula_profesional = 'MP-3312' limit 1;

if m_salazar is null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('dr.salazar', 'dr.salazar@fisioclin.bo', 'medico_fisiatra', true, true, v_perm_medico)
  on conflict (email) do nothing;
  select id_usuario into u_salazar from public.usuarios where email = 'dr.salazar@fisioclin.bo';

  insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                              cedula_profesional, telefono, biografia, consultorio, horario_atencion)
  values (u_salazar, 'Dr. Martín Salazar', 'medico_fisiatra', 'Medicina Física y Rehabilitación',
          'MP-3312', '+591 70000013', 'Fisiatra de guardia. Refuerzo de la unidad los fines de semana.',
          'Consultorio 5, primer piso', 'Sáb y Dom, 08:00–13:00')
  returning id_medico into m_salazar;
end if;

-- --- FISIOTERAPEUTAS --------------------------------------------------------
select m.id_medico, m.id_usuario into m_mamani, u_mamani
  from public.medicos m where m.cedula_profesional = 'FT-2210' limit 1;

if m_mamani is null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('lic.mamani', 'lic.mamani@fisioclin.bo', 'fisioterapeuta', true, false, v_perm_fisio)
  on conflict (email) do nothing;
  select id_usuario into u_mamani from public.usuarios where email = 'lic.mamani@fisioclin.bo';

  insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                              cedula_profesional, telefono, biografia, consultorio, horario_atencion)
  values (u_mamani, 'Lic. Carlos Mamani', 'fisioterapeuta', 'Fisioterapia',
          'FT-2210', '+591 70000012', 'Fisioterapeuta a cargo de la sala de terapia 1.',
          'Sala de terapia 1', 'Lun a Vie, 08:00–16:00')
  returning id_medico into m_mamani;
end if;

select m.id_medico, m.id_usuario into m_andrea, u_andrea
  from public.medicos m where m.cedula_profesional = 'FT-4420' limit 1;

if m_andrea is null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('lic.andrea', 'lic.andrea@fisioclin.bo', 'fisioterapeuta', true, true, v_perm_fisio)
  on conflict (email) do nothing;
  select id_usuario into u_andrea from public.usuarios where email = 'lic.andrea@fisioclin.bo';

  insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                              cedula_profesional, telefono, biografia, consultorio, horario_atencion)
  values (u_andrea, 'Lic. Andrea Rojas', 'fisioterapeuta', 'Fisioterapia',
          'FT-4420', '+591 70023456', 'Fisioterapeuta de apoyo en marcha y equilibrio.',
          'Sala de terapia 2', 'Lun a Vie, 13:00–19:00')
  returning id_medico into m_andrea;
end if;

-- ---------------------------------------------------------------------------
-- 2.3  PACIENTES  —  BUSCAR O CREAR
--   Si tu base ya trae PAC-0001..PAC-0006, se reutilizan tal cual y solo se
--   les completan los datos que les faltaban (correo, contacto de emergencia,
--   fisioterapeuta asignado).
-- ---------------------------------------------------------------------------
select id_paciente, id_usuario into p_juan,  u_juan  from public.pacientes where codigo_anonimo = 'PAC-0001';
select id_paciente, id_usuario into p_maria, u_maria from public.pacientes where codigo_anonimo = 'PAC-0002';
select id_paciente, id_usuario into p_pedro, u_pedro from public.pacientes where codigo_anonimo = 'PAC-0003';
select id_paciente, id_usuario into p_ana,   u_ana   from public.pacientes where codigo_anonimo = 'PAC-0004';
select id_paciente, id_usuario into p_jose,  u_jose  from public.pacientes where codigo_anonimo = 'PAC-0005';
select id_paciente, id_usuario into p_lucia          from public.pacientes where codigo_anonimo = 'PAC-0006';

-- Si no existian (base recien creada sin datos de ejemplo), se crean los seis.
if p_juan is null then
  insert into public.pacientes
    (codigo_anonimo, numero_carnet, tipo_documento, ci_expedido, nombre_completo,
     nombres, apellido_paterno, apellido_materno, fecha_nacimiento, sexo,
     grado_artrosis_kl, articulacion_principal, diagnostico_previo,
     id_medico_tratante, id_fisioterapeuta_asignado, id_medico_registrador,
     telefono, email, direccion, contacto_emergencia_nombre, contacto_emergencia_telefono,
     origen_registro, fecha_registro, activo)
  values
    ('PAC-0001','7000001','ci','LP','JUAN CARLOS CONDORI MAMANI','JUAN CARLOS','CONDORI','MAMANI',
     '1962-03-15','M',2,'rodilla','Gonartrosis bilateral grado II, predominio derecho',
     m_martin, m_mamani, m_martin, '70000001','juan.condori@example.bo','Zona Sur, La Paz',
     'Rosa Mamani','70000101','ocr_carnet', current_date - 22, true),
    ('PAC-0002','7000002','ci','LP','MARIA ELENA QUISPE FLORES','MARIA ELENA','QUISPE','FLORES',
     '1958-07-22','F',3,'rodilla','Gonartrosis grado III con limitación funcional a la marcha',
     m_rojas, m_mamani, m_rojas, '70000002','maria.quispe@example.bo','Villa Fátima, La Paz',
     'Luis Quispe','70000102','manual', current_date - 36, true),
    ('PAC-0003','7000003','ci','LP','PEDRO LUIS MAMANI ROJAS','PEDRO LUIS','MAMANI','ROJAS',
     '1955-11-02','M',2,'cadera','Coxartrosis derecha grado II',
     m_rojas, m_andrea, m_rojas, '70000003','pedro.mamani@example.bo','El Alto, zona Río Seco',
     'Marta Rojas','70000103','ocr_carnet', current_date - 18, true),
    ('PAC-0004','7000004','ci','SC','ANA SOFIA VARGAS PEREZ','ANA SOFIA','VARGAS','PEREZ',
     '1965-01-18','F',2,'tobillo','Artrosis femorotibial grado II, secuela de fractura bimaleolar',
     m_martin, m_mamani, m_martin, '70000004','ana.vargas@example.bo','Sopocachi, La Paz',
     'Julio Vargas','70000104','manual', current_date - 12, true),
    ('PAC-0005','7000005','ci','CB','JOSE MIGUEL FLORES TICONA','JOSE MIGUEL','FLORES','TICONA',
     '1952-05-30','M',3,'cadera','Coxartrosis grado III con restricción de movilidad',
     m_salazar, m_andrea, m_salazar, '70000005','jose.flores@example.bo','Cochabamba, zona Norte',
     'Elena Ticona','70000105','manual', current_date - 40, true),
    ('PAC-0006','7000006','ci','SC','LUCIA BEATRIZ CHOQUE MENDOZA','LUCIA BEATRIZ','CHOQUE','MENDOZA',
     '1970-09-09','F',2,'rodilla','Artrosis de rodilla grado II en control',
     m_martin, null, m_martin, '70000006','lucia.choque@example.bo','Santa Cruz de la Sierra',
     null, null, 'manual', current_date - 60, true);

  select id_paciente, id_usuario into p_juan,  u_juan  from public.pacientes where codigo_anonimo = 'PAC-0001';
  select id_paciente, id_usuario into p_maria, u_maria from public.pacientes where codigo_anonimo = 'PAC-0002';
  select id_paciente, id_usuario into p_pedro, u_pedro from public.pacientes where codigo_anonimo = 'PAC-0003';
  select id_paciente, id_usuario into p_ana,   u_ana   from public.pacientes where codigo_anonimo = 'PAC-0004';
  select id_paciente, id_usuario into p_jose,  u_jose  from public.pacientes where codigo_anonimo = 'PAC-0005';
  select id_paciente, id_usuario into p_lucia          from public.pacientes where codigo_anonimo = 'PAC-0006';
end if;

-- ---------------------------------------------------------------------------
-- LA CUENTA DE CADA PACIENTE (para la app del celular)
--   Un paciente sin cuenta no puede recibir mensajes ni avisos: la tabla
--   `mensajes` exige remitente y destinatario. Se crea con el numero de carnet
--   como usuario, igual que hace el sistema al registrar por carnet.
--   LUCIA (PAC-0006) se queda a proposito SIN cuenta: sirve para comprobar que
--   el sistema no se rompe con un paciente que no usa la app.
-- ---------------------------------------------------------------------------

if u_juan is null and p_juan is not null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('7000001', '7000001@carnet.cossmil.bo', 'paciente', true, true, '{}'::jsonb)
  on conflict (email) do nothing;
  select id_usuario into u_juan from public.usuarios where email = '7000001@carnet.cossmil.bo';
  update public.pacientes set id_usuario = u_juan where id_paciente = p_juan;
end if;

if u_maria is null and p_maria is not null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('7000002', '7000002@carnet.cossmil.bo', 'paciente', true, true, '{}'::jsonb)
  on conflict (email) do nothing;
  select id_usuario into u_maria from public.usuarios where email = '7000002@carnet.cossmil.bo';
  update public.pacientes set id_usuario = u_maria where id_paciente = p_maria;
end if;

if u_pedro is null and p_pedro is not null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('7000003', '7000003@carnet.cossmil.bo', 'paciente', true, true, '{}'::jsonb)
  on conflict (email) do nothing;
  select id_usuario into u_pedro from public.usuarios where email = '7000003@carnet.cossmil.bo';
  update public.pacientes set id_usuario = u_pedro where id_paciente = p_pedro;
end if;

if u_ana is null and p_ana is not null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('7000004', '7000004@carnet.cossmil.bo', 'paciente', true, true, '{}'::jsonb)
  on conflict (email) do nothing;
  select id_usuario into u_ana from public.usuarios where email = '7000004@carnet.cossmil.bo';
  update public.pacientes set id_usuario = u_ana where id_paciente = p_ana;
end if;

if u_jose is null and p_jose is not null then
  insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
  values ('7000005', '7000005@carnet.cossmil.bo', 'paciente', true, true, '{}'::jsonb)
  on conflict (email) do nothing;
  select id_usuario into u_jose from public.usuarios where email = '7000005@carnet.cossmil.bo';
  update public.pacientes set id_usuario = u_jose where id_paciente = p_jose;
end if;

-- Completar lo que a los pacientes del esquema base les faltaba.
update public.pacientes set
  email = coalesce(email, lower(split_part(nombres, ' ', 1)) || '.' ||
                            lower(apellido_paterno) || '@example.bo'),
  id_fisioterapeuta_asignado = coalesce(id_fisioterapeuta_asignado,
    case when articulacion_principal::text = 'cadera' then m_andrea else m_mamani end),
  contacto_emergencia_nombre = coalesce(contacto_emergencia_nombre, 'Contacto familiar'),
  contacto_emergencia_telefono = coalesce(contacto_emergencia_telefono, telefono)
where codigo_anonimo in ('PAC-0001','PAC-0002','PAC-0003','PAC-0004','PAC-0005','PAC-0006');

-- ---------------------------------------------------------------------------
-- 2.4  PREFERENCIAS Y FOTOS DE PERFIL
-- ---------------------------------------------------------------------------
insert into public.preferencias_usuario (id_usuario, tamano_letra, tema, alto_contraste, idioma)
select u.id_usuario,
       case when u.rol::text = 'paciente' then 'grande' else 'normal' end,
       'claro', false,
       case when u.id_usuario = u_pedro then 'ay' else 'es' end
  from public.usuarios u
 where u.id_usuario in (u_super, u_martin, u_rojas, u_salazar, u_mamani, u_andrea,
                        u_juan, u_maria, u_pedro, u_ana, u_jose)
on conflict (id_usuario) do nothing;

insert into public.fotos_perfil (id_usuario, bucket, storage_path, mime_type, tamano_bytes, ancho, alto, origen)
values
  (u_martin,  'avatares', 'perfiles/dr-martin.jpg',  'image/jpeg', 184320, 512, 512, 'galeria'),
  (u_rojas,   'avatares', 'perfiles/dra-rojas.jpg',  'image/jpeg', 176128, 512, 512, 'galeria'),
  (u_salazar, 'avatares', 'perfiles/dr-salazar.jpg', 'image/jpeg', 158720, 512, 512, 'camara'),
  (u_mamani,  'avatares', 'perfiles/lic-mamani.jpg', 'image/jpeg', 165888, 512, 512, 'galeria'),
  (u_andrea,  'avatares', 'perfiles/lic-andrea.jpg', 'image/jpeg', 172032, 512, 512, 'galeria')
on conflict (id_usuario) do nothing;

-- ---------------------------------------------------------------------------
-- 2.5  DOCUMENTOS DE IDENTIDAD  (lo que deja el OCR del carnet)
-- ---------------------------------------------------------------------------
insert into public.documentos_identidad
  (id_paciente, tipo_documento, numero_documento, expedido, nombres, apellido_paterno,
   apellido_materno, fecha_nacimiento, sexo, fecha_emision, fecha_vencimiento,
   foto_anverso_path, metodo_captura, confianza_ocr, requiere_revision, verificado_por, creado_por)
values
  (p_juan,  'ci', '7000001', 'LP', 'JUAN CARLOS', 'CONDORI', 'MAMANI', '1962-03-15', 'M',
   '2019-04-10', '2029-04-10', 'documentos-identidad/7000001-a.jpg', 'ocr', 0.94, false, m_martin, m_martin),
  (p_maria, 'ci', '7000002', 'LP', 'MARIA ELENA', 'QUISPE', 'FLORES', '1958-07-22', 'F',
   '2018-09-01', '2028-09-01', 'documentos-identidad/7000002-a.jpg', 'manual', null, false, m_rojas, m_rojas),
  (p_pedro, 'ci', '7000003', 'LP', 'PEDRO LUIS', 'MAMANI', 'ROJAS', '1955-11-02', 'M',
   '2020-02-20', '2030-02-20', 'documentos-identidad/7000003-a.jpg', 'ocr', 0.71, true, null, m_rojas),
  (p_ana,   'ci', '7000004', 'SC', 'ANA SOFIA', 'VARGAS', 'PEREZ', '1965-01-18', 'F',
   '2021-06-15', '2031-06-15', 'documentos-identidad/7000004-a.jpg', 'ocr', 0.88, false, m_martin, m_martin),
  (p_jose,  'ci', '7000005', 'CB', 'JOSE MIGUEL', 'FLORES', 'TICONA', '1952-05-30', 'M',
   '2017-11-30', '2027-11-30', 'documentos-identidad/7000005-a.jpg', 'manual', null, false, m_salazar, m_salazar),
  (p_lucia, 'ci', '7000006', 'SC', 'LUCIA BEATRIZ', 'CHOQUE', 'MENDOZA', '1970-09-09', 'F',
   '2022-03-05', '2032-03-05', 'documentos-identidad/7000006-a.jpg', 'ocr', 0.65, true, null, m_martin);

-- ---------------------------------------------------------------------------
-- 2.6  CONSENTIMIENTO INFORMADO  (tabla nueva)
-- ---------------------------------------------------------------------------
insert into public.consentimiento_informado
  (id_paciente, version, acepta_tratamiento, acepta_grabacion_video, acepta_uso_investigacion,
   metodo, archivo_bucket, archivo_path, registrado_por, observaciones)
values
  (p_juan,  '1.0', true,  true,  true,  'firma_fisica',  'adjuntos-clinicos', 'consentimientos/PAC-0001.pdf', m_martin,  'Firmado en consulta inicial.'),
  (p_maria, '1.0', true,  true,  false, 'firma_fisica',  'adjuntos-clinicos', 'consentimientos/PAC-0002.pdf', m_rojas,   'No autoriza uso en publicaciones.'),
  (p_pedro, '1.0', true,  false, false, 'firma_digital', 'adjuntos-clinicos', 'consentimientos/PAC-0003.pdf', m_rojas,   'No autoriza grabación de video.'),
  (p_ana,   '1.0', true,  true,  true,  'app',           null, null, m_martin,  'Aceptado desde la app del paciente.'),
  (p_jose,  '1.0', true,  true,  true,  'firma_fisica',  'adjuntos-clinicos', 'consentimientos/PAC-0005.pdf', m_salazar, 'Firma del familiar responsable.'),
  (p_lucia, '1.0', false, false, false, 'firma_fisica',  null, null, m_martin,  'Pendiente de firma.');

-- ---------------------------------------------------------------------------
-- 2.7  SOLICITUDES DE ACCESO  (5: pendientes, una aprobada y una rechazada)
-- ---------------------------------------------------------------------------
insert into public.solicitudes_acceso
  (nombre_completo, tipo_profesional, cedula_profesional, email, telefono, estado, origen,
   fecha_solicitud, id_superusuario_revisor, fecha_revision, observaciones)
values
  ('Dr. Luis Mendoza',     'medico_fisiatra', 'MP-9931', 'l.mendoza@cossmil.mil',  '70012345',
   'pendiente', 'formulario', now() - interval '1 day',  null, null, null),
  ('Lic. Paola Gutiérrez', 'fisioterapeuta',  'FT-8812', 'p.gutierrez@cossmil.mil','70023457',
   'pendiente', 'formulario', now() - interval '2 days', null, null, null),
  ('Dra. Carla Nina',      null,              null,      'c.nina@gmail.com',       null,
   'pendiente', 'google',     now() - interval '5 hours', null, null,
   'Alta automática al entrar con Google. Falta asignar tipo profesional y cédula.'),
  ('Dr. Martín Salazar',   'medico_fisiatra', 'MP-3312', 'dr.salazar@fisioclin.bo','70000013',
   'aprobada', 'formulario', now() - interval '20 days', u_super, now() - interval '19 days',
   'Aprobado. Cuenta creada con módulos de médico fisiatra.'),
  ('Sr. Jorge Peña',       'fisioterapeuta',  'FT-0001', 'j.pena@hotmail.com',     '70099999',
   'rechazada', 'formulario', now() - interval '30 days', u_super, now() - interval '29 days',
   'No acredita cédula profesional vigente.');

update public.solicitudes_acceso
   set id_usuario_creado = u_salazar
 where email = 'dr.salazar@fisioclin.bo';

-- ---------------------------------------------------------------------------
-- 2.8  CATÁLOGO DE EJERCICIOS  (10, cuatro ya con video subido)
--   OJO con `codigo_fisioclin`: son 3 letras porque enlazan el ejercicio con
--   la clase del modelo LSTM (fisioclin_clases.json). No es un código libre.
--   Cuando conectes el modelo, estos códigos tienen que coincidir con los que
--   usa la red, o el evaluador no va a reconocer el ejercicio.
-- ---------------------------------------------------------------------------
insert into public.ejercicios_catalogo
  (codigo_fisioclin, clase_lstm, nombre, descripcion, articulacion_objetivo, angulo_min_esperado,
   angulo_max_esperado, duracion_estimada_segundos, id_medico_creador, activo,
   video_bucket, video_storage_path, video_poster_path, video_nombre_original,
   video_mime_type, video_tamano_bytes, video_duracion_segundos, video_ancho, video_alto,
   video_estado, video_fecha_subida, id_medico_subio_video)
values
  ('ROD-01', 'R01', 'Elevación de pierna recta (SLR)',
   'Acostado boca arriba, rodilla estirada, subir la pierna 30 cm y sostener 2 segundos.',
   'rodilla', 0, 45, 40, m_martin, true,
   'ejercicios-videos', 'rodilla/ROD-01.mp4', 'rodilla/ROD-01.jpg', 'slr-rodilla.mp4',
   'video/mp4', 14680064, 42.5, 1280, 720, 'listo', now() - interval '30 days', m_martin),

  ('ROD-02', 'R02', 'Flexión de rodilla con banda elástica',
   'Banda de baja resistencia. Controlar el retorno lentamente, sin rebote.',
   'rodilla', 0, 110, 45, m_martin, true,
   'ejercicios-videos', 'rodilla/ROD-02.mp4', 'rodilla/ROD-02.jpg', 'flexion-banda.mp4',
   'video/mp4', 15728640, 48.0, 1280, 720, 'listo', now() - interval '28 days', m_martin),

  ('ROD-03', 'R03', 'Sentadilla isométrica en pared',
   'Espalda contra la pared, rodillas a 90°. Sostener la posición sin despegar la espalda.',
   'rodilla', 60, 90, 40, m_rojas, true,
   'ejercicios-videos', 'rodilla/ROD-03.mp4', 'rodilla/ROD-03.jpg', 'sentadilla-pared.mp4',
   'video/mp4', 12582912, 39.0, 1280, 720, 'listo', now() - interval '25 days', m_rojas),

  ('CAD-01', 'C01', 'Puente de glúteos',
   'Contraer glúteos arriba, alinear hombros, cadera y rodillas. Sostener 3 segundos.',
   'cadera', 0, 30, 40, m_martin, true,
   'ejercicios-videos', 'cadera/CAD-01.mp4', 'cadera/CAD-01.jpg', 'puente-gluteos.mp4',
   'video/mp4', 15204352, 41.0, 1280, 720, 'listo', now() - interval '22 days', m_martin),

  ('CAD-02', 'C02', 'Abducción de cadera en decúbito lateral',
   'De costado, subir la pierna de arriba sin rotar la pelvis. Bajar controlado.',
   'cadera', 0, 40, 35, m_rojas, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null),

  ('TOB-01', 'T01', 'Estiramiento de tendón de Aquiles',
   'Frente a la pared, pierna a estirar atrás con el talón pegado al suelo.',
   'tobillo', 0, 20, 30, m_martin, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null),

  ('TOB-02', 'T02', 'Dorsiflexión activa de tobillo',
   'Sentado, pierna estirada, llevar la punta del pie hacia la rodilla y sostener 3 s.',
   'tobillo', 0, 25, 30, m_martin, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null),

  ('HOM-01', 'H01', 'Rotación externa de hombro con banda',
   'Codo pegado al cuerpo a 90°, girar el antebrazo hacia afuera sin separar el codo.',
   'hombro', 0, 60, 35, m_rojas, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null),

  ('COL-01', 'L01', 'Inclinación pélvica (pelvic tilt)',
   'Aplanar la espalda baja contra el suelo contrayendo el abdomen. Sostener 5 s.',
   'columna', 0, 15, 30, m_rojas, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null),

  ('COL-02', 'L02', 'Pájaro-perro (bird-dog)',
   'Extender brazo y pierna contraria alternando, manteniendo la columna neutra.',
   'columna', 0, 90, 45, m_rojas, true,
   'ejercicios-videos', null, null, null, null, null, null, null, null, 'sin_video', null, null);

select id_ejercicio into e1  from public.ejercicios_catalogo where codigo_fisioclin = 'ROD-01';
select id_ejercicio into e2  from public.ejercicios_catalogo where codigo_fisioclin = 'ROD-02';
select id_ejercicio into e3  from public.ejercicios_catalogo where codigo_fisioclin = 'ROD-03';
select id_ejercicio into e4  from public.ejercicios_catalogo where codigo_fisioclin = 'CAD-01';
select id_ejercicio into e5  from public.ejercicios_catalogo where codigo_fisioclin = 'CAD-02';
select id_ejercicio into e6  from public.ejercicios_catalogo where codigo_fisioclin = 'TOB-01';
select id_ejercicio into e7  from public.ejercicios_catalogo where codigo_fisioclin = 'TOB-02';
select id_ejercicio into e8  from public.ejercicios_catalogo where codigo_fisioclin = 'HOM-01';
select id_ejercicio into e9  from public.ejercicios_catalogo where codigo_fisioclin = 'COL-01';
select id_ejercicio into e10 from public.ejercicios_catalogo where codigo_fisioclin = 'COL-02';

-- ---------------------------------------------------------------------------
-- 2.9  PLANES DE TRATAMIENTO  (5, uno por paciente activo)
-- ---------------------------------------------------------------------------
insert into public.planes_tratamiento
  (id_paciente, id_medico_responsable, objetivo_general, fecha_inicio, duracion_estimada_semanas, estado, observaciones)
values (p_juan, m_martin,
        'Recuperar rango de flexión de rodilla y potencia de cuádriceps',
        current_date - 20, 8, 'activo', 'Progresar carga según tolerancia. Hielo 10 min al terminar.')
returning id_plan into pl_juan;

insert into public.planes_tratamiento
  (id_paciente, id_medico_responsable, objetivo_general, fecha_inicio, duracion_estimada_semanas, estado, observaciones)
values (p_maria, m_rojas,
        'Control de gonartrosis grado III: mantener rango y reducir dolor',
        current_date - 35, 12, 'activo', 'Evitar impacto. Bicicleta estática sin resistencia de calentamiento.')
returning id_plan into pl_maria;

insert into public.planes_tratamiento
  (id_paciente, id_medico_responsable, objetivo_general, fecha_inicio, duracion_estimada_semanas, estado, observaciones)
values (p_pedro, m_rojas,
        'Mejorar abducción de cadera y estabilidad en marcha',
        current_date - 15, 6, 'activo', 'Reeducación de marcha con bastón las dos primeras semanas.')
returning id_plan into pl_pedro;

insert into public.planes_tratamiento
  (id_paciente, id_medico_responsable, objetivo_general, fecha_inicio, duracion_estimada_semanas, estado, observaciones)
values (p_ana, m_martin,
        'Reeducación de marcha y recuperación de dorsiflexión de tobillo',
        current_date - 10, 6, 'activo', 'Estiramientos diarios en casa. Calzado con soporte firme.')
returning id_plan into pl_ana;

insert into public.planes_tratamiento
  (id_paciente, id_medico_responsable, objetivo_general, fecha_inicio, duracion_estimada_semanas, estado, observaciones)
values (p_jose, m_salazar,
        'Mantener movilidad de cadera y evitar progresión de la rigidez',
        current_date - 45, 16, 'activo', 'Paciente con baja adherencia. Reforzar recordatorios.')
returning id_plan into pl_jose;

-- ---------------------------------------------------------------------------
-- 2.10  PRESCRIPCIONES  (12)
-- ---------------------------------------------------------------------------
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_juan, pl_juan, e1, m_martin, 3, 15, 7, current_date - 20, 'Sin dolor punzante en la cara anterior.') returning id_prescripcion into pr1;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_juan, pl_juan, e4, m_martin, 3, 12, 7, current_date - 20, 'Sostener 3 segundos arriba.') returning id_prescripcion into pr2;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_juan, pl_juan, e3, m_martin, 3, 10, 4, current_date - 14, 'Sostener 20 s por repetición.') returning id_prescripcion into pr3;

insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_maria, pl_maria, e2, m_rojas, 3, 12, 5, current_date - 35, 'Banda amarilla, baja resistencia.') returning id_prescripcion into pr4;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_maria, pl_maria, e3, m_rojas, 3, 8, 3, current_date - 35, 'Bajar solo hasta donde no duela.') returning id_prescripcion into pr5;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_maria, pl_maria, e1, m_rojas, 2, 15, 5, current_date - 20, 'Agregado en el control de la semana 2.') returning id_prescripcion into pr6;

insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_pedro, pl_pedro, e5, m_rojas, 3, 12, 5, current_date - 15, 'No rotar la pelvis al subir la pierna.') returning id_prescripcion into pr7;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_pedro, pl_pedro, e4, m_rojas, 3, 10, 5, current_date - 15, null) returning id_prescripcion into pr8;

insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_ana, pl_ana, e6, m_martin, 3, 1, 7, current_date - 10, 'Mantener 30 s cada repetición.') returning id_prescripcion into pr9;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_ana, pl_ana, e7, m_martin, 3, 12, 7, current_date - 10, 'Sin forzar si aparece dolor en el tobillo.') returning id_prescripcion into pr10;

insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_jose, pl_jose, e5, m_salazar, 2, 10, 3, current_date - 45, 'Empezar suave, paciente muy rígido.') returning id_prescripcion into pr11;
insert into public.prescripciones_ejercicio (id_paciente, id_plan, id_ejercicio, id_medico_prescriptor, series, repeticiones, frecuencia_semanal, fecha_inicio, observaciones)
values (p_jose, pl_jose, e4, m_salazar, 2, 10, 3, current_date - 45, null) returning id_prescripcion into pr12;

-- ---------------------------------------------------------------------------
-- 2.11  SESIONES  (10 grabadas con la app del paciente)
-- ---------------------------------------------------------------------------
insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_juan, m_martin, pr1, e1, 'Elevación de pierna recta (SLR)',
  now() - interval '14 days', 620, 'Xiaomi Redmi Note 12', '1280x720', 2.5, 30,
  'exitosa', m_mamani, now() - interval '14 days', 'videos-sesiones/PAC-0001/s01.mp4',
  18600, 18600, 'completada', true, 'correcto', 'Buen control motor. Edema residual leve.')
returning id_sesion into s1;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_juan, m_mamani, pr2, e4, 'Puente de glúteos',
  now() - interval '11 days', 540, 'Xiaomi Redmi Note 12', '1280x720', 2.4, 30,
  'exitosa', m_mamani, now() - interval '11 days', 'videos-sesiones/PAC-0001/s02.mp4',
  16200, 16200, 'completada', true, 'correcto', 'Progresa bien, sin compensación lumbar.')
returning id_sesion into s2;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_juan, m_martin, pr3, e3, 'Sentadilla isométrica en pared',
  now() - interval '6 days', 480, 'Xiaomi Redmi Note 12', '1280x720', 2.6, 30,
  'requiere_ajuste', m_martin, now() - interval '6 days', 'videos-sesiones/PAC-0001/s03.mp4',
  14400, 14400, 'completada', true, 'incorrecto', 'La rodilla se adelanta al pie. Revisar técnica.')
returning id_sesion into s3;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_maria, m_rojas, pr4, e2, 'Flexión de rodilla con banda elástica',
  now() - interval '9 days', 600, 'Samsung A34', '1280x720', 2.2, 30,
  'exitosa', m_mamani, now() - interval '9 days', 'videos-sesiones/PAC-0002/s01.mp4',
  18000, 18000, 'completada', true, 'correcto', 'Sin dolor durante el ejercicio.')
returning id_sesion into s4;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_maria, m_rojas, pr5, e3, 'Sentadilla isométrica en pared',
  now() - interval '3 days', 420, 'Samsung A34', '1280x720', 2.3, 30,
  'exitosa', m_rojas, now() - interval '3 days', 'videos-sesiones/PAC-0002/s02.mp4',
  12600, 12600, 'completada', true, 'incorrecto', 'Poca profundidad. Reforzar cuádriceps.')
returning id_sesion into s5;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_maria, m_mamani, pr6, e1, 'Elevación de pierna recta (SLR)',
  now() - interval '1 day', 510, 'Samsung A34', '1280x720', 2.2, 30,
  'exitosa', m_mamani, now() - interval '1 day', 'videos-sesiones/PAC-0002/s03.mp4',
  15300, 15300, 'completada', true, 'parcial', 'Mejora respecto a la semana pasada.')
returning id_sesion into s6;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_pedro, m_andrea, pr7, e5, 'Abducción de cadera en decúbito lateral',
  now() - interval '8 days', 450, 'Motorola G54', '1280x720', 2.8, 24,
  'exitosa', m_andrea, now() - interval '8 days', 'videos-sesiones/PAC-0003/s01.mp4',
  10800, 10800, 'completada', true, 'correcto', 'Buena alineación de pelvis.')
returning id_sesion into s7;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_pedro, m_andrea, pr8, e4, 'Puente de glúteos',
  now() - interval '2 days', 400, 'Motorola G54', '1280x720', 2.7, 24,
  'exitosa', m_andrea, now() - interval '2 days', 'videos-sesiones/PAC-0003/s02.mp4',
  9600, 9600, 'completada', true, 'parcial', 'Se cansa antes de terminar la tercera serie.')
returning id_sesion into s8;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_ana, m_martin, pr10, e7, 'Dorsiflexión activa de tobillo',
  now() - interval '2 days', 300, 'iPhone 12', '1280x720', 2.0, 30,
  'exitosa', m_mamani, now() - interval '2 days', 'videos-sesiones/PAC-0004/s01.mp4',
  9000, 9000, 'completada', true, 'correcto', 'Mejora clara de la dorsiflexión.')
returning id_sesion into s9;

insert into public.sesiones (id_paciente, id_profesional_supervisor, id_prescripcion, id_ejercicio, ejercicio,
  fecha_hora, duracion_segundos, dispositivo_captura, resolucion_video, distancia_paciente_metros, fps_captura,
  resultado_calibracion, id_profesional_calibrador, fecha_calibracion, video_storage_path,
  frames_totales, frames_procesados, estado, completado, resultado_evaluacion, observaciones)
values (p_jose, m_salazar, pr11, e5, 'Abducción de cadera en decúbito lateral',
  now() - interval '20 days', 280, 'Samsung A14', '1280x720', 3.0, 24,
  'fallida', m_salazar, now() - interval '20 days', null,
  6720, 3100, 'error', false, 'pendiente', 'Calibración fallida: el paciente sale del encuadre.')
returning id_sesion into s10;

-- ---------------------------------------------------------------------------
-- 2.12  MÉTRICAS ARTICULARES  (una por sesión, con validación de goniómetro)
-- ---------------------------------------------------------------------------
insert into public.metricas_articulares
  (id_sesion, articulacion, lado, angulo_maximo, angulo_minimo, velocidad_angular_prom,
   simetria_bilateral, clasificacion_limitacion, landmarks_json, angulos_json,
   angulo_goniometro, umbral_clinico_grados, id_medico_validador, fecha_validacion, observaciones_validacion)
values
  (s1,  'rodilla', 'derecho',  44.0, 2.0, 18.4, 92.0, 'leve',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":44.0,"valle":2.0,"media":23.5}'::jsonb, 46.0, 5.0, m_martin, now() - interval '13 days', 'Diferencia de 2°, dentro del umbral.'),
  (s2,  'cadera',  'bilateral', 31.0, 1.0, 15.0, 96.0, 'normal',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":31.0,"valle":1.0,"media":17.0}'::jsonb, 30.0, 5.0, m_martin, now() - interval '10 days', 'Coincide con la medición manual.'),
  (s3,  'rodilla', 'derecho',  88.0, 60.0, 9.8, 84.0, 'moderada',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":88.0,"valle":60.0,"media":74.0}'::jsonb, 81.0, 5.0, m_martin, now() - interval '5 days', 'Diferencia de 7°: fuera del umbral, repetir medición.'),
  (s4,  'rodilla', 'izquierdo', 108.0, 5.0, 21.2, 89.0, 'leve',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":108.0,"valle":5.0,"media":58.0}'::jsonb, 110.0, 5.0, m_rojas, now() - interval '8 days', 'Dentro del umbral.'),
  (s5,  'rodilla', 'izquierdo', 70.0, 48.0, 8.1, 78.0, 'moderada',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":70.0,"valle":48.0,"media":59.0}'::jsonb, 72.0, 5.0, m_rojas, now() - interval '2 days', 'Correcto.'),
  (s6,  'rodilla', 'izquierdo', 47.0, 3.0, 17.9, 90.0, 'leve',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":47.0,"valle":3.0,"media":25.0}'::jsonb, null, 5.0, null, null, null),
  (s7,  'cadera',  'derecho',  38.0, 2.0, 13.3, 88.0, 'leve',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":24}'::jsonb,
   '{"pico":38.0,"valle":2.0,"media":20.0}'::jsonb, 40.0, 5.0, m_rojas, now() - interval '7 days', 'Dentro del umbral.'),
  (s8,  'cadera',  'bilateral', 26.0, 1.0, 11.0, 85.0, 'moderada',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":24}'::jsonb,
   '{"pico":26.0,"valle":1.0,"media":13.5}'::jsonb, 33.0, 5.0, m_rojas, now() - interval '1 day', 'Diferencia de 7°: revisar encuadre de la cámara.'),
  (s9,  'tobillo', 'derecho',  16.0, -4.0, 7.5, 94.0, 'normal',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":30}'::jsonb,
   '{"pico":16.0,"valle":-4.0,"media":6.0}'::jsonb, 15.0, 5.0, m_martin, now() - interval '1 day', 'Coincide.'),
  (s10, 'cadera',  'derecho',  12.0, 0.0, 5.2, null, 'sin_clasificar',
   '{"modelo":"mediapipe_pose","puntos":33,"fps":24,"aviso":"captura incompleta"}'::jsonb,
   '{"pico":12.0,"valle":0.0,"media":5.0}'::jsonb, null, 5.0, null, null, 'Sesión con calibración fallida, no se valida.');

-- ---------------------------------------------------------------------------
-- 2.13  REPETICIONES  (se generan solas: entre 8 y 15 por sesión)
-- ---------------------------------------------------------------------------
foreach v_sesion in array array[s1, s2, s3, s4, s5, s6, s7, s8, s9]
loop
  select case when resultado_evaluacion = 'correcto' then 12
              when resultado_evaluacion = 'parcial'  then 10
              else 9 end,
         (select max(angulo_maximo) from public.metricas_articulares where id_sesion = v_sesion),
         resultado_evaluacion = 'correcto'
    into v_total, v_ang, v_ok
    from public.sesiones where id_sesion = v_sesion;

  for v_i in 1..v_total loop
    insert into public.repeticiones_ejercicio
      (id_sesion, numero_repeticion, angulo_alcanzado, duracion_segundos, calidad_ejecucion,
       observacion_automatica, timestamp_inicio, timestamp_fin, detalle_json)
    values (
      v_sesion, v_i,
      round(v_ang - (random() * 8)::numeric, 1),
      round((2.0 + random() * 2.0)::numeric, 1),
      case
        when v_ok and v_i % 7 <> 0 then 'correcta'
        when v_ok                  then 'parcial'
        when v_i % 3 = 0           then 'incorrecta'
        when v_i % 3 = 1           then 'correcta'
        else 'parcial'
      end,
      case when v_ok then 'Rango dentro de lo esperado'
           else 'Ángulo por debajo del mínimo prescrito' end,
      now() - interval '1 hour' + make_interval(secs => v_i * 5),
      now() - interval '1 hour' + make_interval(secs => v_i * 5 + 4),
      jsonb_build_object('frame_inicio', v_i * 90, 'frame_fin', v_i * 90 + 75)
    );
  end loop;
end loop;

-- ---------------------------------------------------------------------------
-- 2.14  REGISTRO DE DOLOR
--   OJO: aquí se escribe "antes" y "despues" a propósito, como lo manda el
--   panel. El trigger del CHOQUE 4 los convierte a antes_sesion/despues_sesion.
-- ---------------------------------------------------------------------------
insert into public.registro_dolor (id_paciente, id_sesion, momento, nivel_dolor, articulacion, fecha_registro, observaciones)
values
  (p_juan,  s1, 'antes',   4, 'rodilla', now() - interval '14 days', null),
  (p_juan,  s1, 'despues', 3, 'rodilla', now() - interval '14 days', 'Bajó tras la sesión.'),
  (p_juan,  s2, 'antes',   3, 'rodilla', now() - interval '11 days', null),
  (p_juan,  s2, 'despues', 2, 'rodilla', now() - interval '11 days', null),
  (p_juan,  s3, 'antes',   4, 'rodilla', now() - interval '6 days',  null),
  (p_juan,  s3, 'despues', 5, 'rodilla', now() - interval '6 days',  'Aumentó: técnica incorrecta.'),
  (p_maria, s4, 'antes',   5, 'rodilla', now() - interval '9 days',  null),
  (p_maria, s4, 'despues', 4, 'rodilla', now() - interval '9 days',  null),
  (p_maria, s5, 'antes',   6, 'rodilla', now() - interval '3 days',  null),
  (p_maria, s5, 'despues', 6, 'rodilla', now() - interval '3 days',  'Sin cambio.'),
  (p_maria, s6, 'antes',   6, 'rodilla', now() - interval '1 day',   null),
  (p_maria, s6, 'despues', 5, 'rodilla', now() - interval '1 day',   null),
  (p_pedro, s7, 'antes',   4, 'cadera',  now() - interval '8 days',  null),
  (p_pedro, s7, 'despues', 3, 'cadera',  now() - interval '8 days',  null),
  (p_pedro, s8, 'antes',   5, 'cadera',  now() - interval '2 days',  null),
  (p_pedro, s8, 'despues', 4, 'cadera',  now() - interval '2 days',  null),
  (p_ana,   s9, 'antes',   3, 'tobillo', now() - interval '2 days',  null),
  (p_ana,   s9, 'despues', 1, 'tobillo', now() - interval '2 days',  'Muy buena respuesta.'),
  (p_juan,  null, 'independiente', 8, 'rodilla', now() - interval '20 days', 'Registro inicial, antes de empezar el plan.'),
  (p_maria, null, 'independiente', 7, 'rodilla', now() - interval '30 days', 'Registro inicial.'),
  (p_pedro, null, 'independiente', 6, 'cadera',  now() - interval '15 days', 'Registro inicial.'),
  (p_ana,   null, 'independiente', 9, 'tobillo', now() - interval '10 days', 'Registro inicial, dolor muy alto.'),
  (p_jose,  null, 'independiente', 7, 'cadera',  now() - interval '4 days',  'Reporta dolor persistente en reposo.'),
  (p_jose,  null, 'independiente', 7, 'cadera',  now() - interval '2 days',  'Sigue igual.'),
  (p_jose,  null, 'independiente', 6, 'cadera',  now() - interval '1 day',   'Leve mejoría.');

-- ---------------------------------------------------------------------------
-- 2.15  HISTORIAL CLÍNICO
--   Se escriben las etiquetas del panel ("Evaluación", "Radiografía") para
--   demostrar que el arreglo del CHOQUE 5 las traduce solo.
-- ---------------------------------------------------------------------------
insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_juan, m_martin, 'Evaluación', 'Evaluación inicial',
        'Gonartrosis bilateral K-L II. Rango de flexión 0-95°. Dolor 8/10 a la marcha prolongada. Se indica plan de 8 semanas.',
        null, true, now() - interval '20 days') returning id_historial into h1;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_juan, m_martin, 'Radiografía', 'Radiografía de rodillas AP y lateral',
        'Pinzamiento del compartimento medial derecho. Osteofitos marginales. Compatible con K-L II.',
        null, true, now() - interval '19 days') returning id_historial into h2;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_juan, m_martin, 'evolucion', 'Control a las 2 semanas',
        'Mejora del control motor. Flexión 0-110°. Dolor 4/10. Se agrega sentadilla isométrica.',
        s3, true, now() - interval '6 days') returning id_historial into h3;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_maria, m_rojas, 'diagnostico', 'Gonartrosis grado III',
        'Limitación funcional a la marcha prolongada y al subir escaleras. Crepitación palpable.',
        null, true, now() - interval '35 days') returning id_historial into h4;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_maria, m_rojas, 'cambio_tratamiento', 'Ajuste de plan',
        'Se reduce la carga en la sentadilla isométrica por molestia femoropatelar.',
        s5, false, now() - interval '3 days') returning id_historial into h5;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_pedro, m_rojas, 'Evaluación', 'Coxartrosis derecha',
        'Abducción limitada a 35°. Marcha antiálgica. Se indica reeducación con bastón.',
        null, true, now() - interval '15 days') returning id_historial into h6;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_ana, m_martin, 'Estudio', 'Informe de resonancia de tobillo',
        'Cambios degenerativos leves tibioastragalinos. Sin lesión ligamentaria aguda.',
        null, true, now() - interval '9 days') returning id_historial into h7;

insert into public.historial_clinico (id_paciente, id_medico, tipo_entrada, titulo, contenido, id_sesion_relacionada, visible_para_paciente, fecha_registro)
values (p_jose, m_salazar, 'indicacion', 'Refuerzo de adherencia',
        'Paciente con 2 sesiones en 6 semanas. Se activan recordatorios diarios y se cita a control presencial.',
        null, true, now() - interval '4 days') returning id_historial into h8;

-- ---------------------------------------------------------------------------
-- 2.16  ADJUNTOS CLÍNICOS  (tabla nueva: radiografías, estudios, PDF)
-- ---------------------------------------------------------------------------
insert into public.adjuntos_clinicos
  (id_paciente, id_historial, storage_path, nombre_original, mime_type, tamano_bytes, tipo_estudio, descripcion, subido_por)
values
  (p_juan,  h2, 'PAC-0001/rx-rodillas-ap.jpg',   'rx-rodillas-ap.jpg',   'image/jpeg',  2411724, 'radiografia', 'Proyección AP bilateral.',        m_martin),
  (p_juan,  h2, 'PAC-0001/rx-rodillas-lat.jpg',  'rx-rodillas-lat.jpg',  'image/jpeg',  2201600, 'radiografia', 'Proyección lateral derecha.',     m_martin),
  (p_juan,  h1, 'PAC-0001/informe-inicial.pdf',  'informe-inicial.pdf',  'application/pdf', 486400, 'informe',  'Informe de evaluación inicial.',  m_martin),
  (p_maria, h4, 'PAC-0002/rx-rodilla-izq.jpg',   'rx-rodilla-izq.jpg',   'image/jpeg',  2568192, 'radiografia', 'Pinzamiento severo medial.',      m_rojas),
  (p_ana,   h7, 'PAC-0004/rm-tobillo.pdf',       'rm-tobillo.pdf',       'application/pdf', 1887436, 'resonancia','Informe completo de resonancia.', m_martin),
  (p_pedro, h6, 'PAC-0003/rx-cadera.jpg',        'rx-cadera.jpg',        'image/jpeg',  2306867, 'radiografia', 'Coxofemoral derecha.',            m_rojas);

-- ---------------------------------------------------------------------------
-- 2.17  MENSAJES  (tabla nueva: conversación real, con respuesta)
-- ---------------------------------------------------------------------------
insert into public.mensajes (id_remitente, id_destinatario, id_paciente, asunto, cuerpo, severidad, canal, leido, creado_en)
values
  (u_martin, u_juan,  p_juan,  'Recordatorio de ejercicios',
   'Recuerda completar tus ejercicios de hoy. La constancia es lo que sostiene la mejora del rango de movimiento.', 'aviso', 'panel', true,  now() - interval '5 days'),
  (u_juan,   u_martin, p_juan, 'Consulta sobre el dolor',
   'Doctor, después de la sentadilla me dolió más de lo normal. ¿Sigo igual?', 'info', 'app', true, now() - interval '5 days' + interval '3 hours'),
  (u_martin, u_juan,  p_juan,  'Corrige tu técnica',
   'Revisé tu última sesión: la rodilla se adelanta al pie. Baja la carga a la mitad y vuelve a ver el video de referencia.', 'alerta', 'panel', false, now() - interval '4 days'),
  (u_rojas,  u_maria, p_maria, 'Baja la carga',
   'Con el dolor que reportaste, reduce a la mitad las repeticiones hasta tu próximo control y aplica hielo 10 minutos al terminar.', 'alerta', 'panel', true, now() - interval '3 days'),
  (u_rojas,  u_maria, p_maria, 'Vas muy bien',
   'Tu rango de movimiento mejoró respecto a la semana pasada. Sigue así.', 'info', 'panel', false, now() - interval '1 day'),
  (u_andrea, u_pedro, p_pedro, 'Cambio de horario',
   'Tu sesión del jueves se adelanta a las 15:00. Avísame si no te sirve.', 'aviso', 'panel', false, now() - interval '2 days'),
  (u_salazar, u_jose, p_jose,  'Te estamos esperando',
   'Llevas dos semanas sin registrar sesiones. ¿Hay algo que te esté impidiendo hacer los ejercicios?', 'aviso', 'panel', false, now() - interval '1 day'),
  (u_mamani, u_martin, p_juan, 'Consulta entre profesionales',
   'Doctor, el paciente PAC-0001 compensa con la cadera en la sentadilla. ¿Le cambiamos el ejercicio?', 'info', 'panel', false, now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- 2.18  NOTIFICACIONES  (con los tipos nuevos del CHOQUE 1 y 2)
-- ---------------------------------------------------------------------------
insert into public.notificaciones
  (id_usuario, id_paciente, id_remitente, tipo, categoria, severidad, titulo, mensaje, accion_ruta, leida, fecha_creacion)
values
  (u_martin, p_juan,  null,     'tecnica_deficiente', 'clinico', 'alerta',
   'Técnica deficiente', 'JUAN CARLOS CONDORI: 63 % de repeticiones correctas en la sentadilla isométrica.', '/sesiones', false, now() - interval '6 days'),
  (u_rojas,  p_maria, null,     'dolor_alto', 'dolor', 'alerta',
   'Dolor elevado sostenido', 'MARIA ELENA QUISPE reporta EVA 6/10 de media en las últimas 48 h.', '/pacientes', false, now() - interval '3 days'),
  (u_martin, p_ana,   null,     'sesion_evaluada', 'clinico', 'info',
   'Buen trabajo', 'ANA SOFIA VARGAS completó la sesión de tobillo con 100 % de aciertos.', '/sesiones', true, now() - interval '2 days'),
  (u_rojas,  p_maria, null,     'cita_incumplida', 'cita', 'aviso',
   'Paciente ausente', 'MARIA ELENA QUISPE no asistió a la sesión de ayer.', '/citas', false, now() - interval '1 day'),
  (u_salazar, p_jose, null,     'adherencia_baja', 'adherencia', 'alerta',
   'Adherencia baja', 'JOSE MIGUEL FLORES: 2 sesiones en 6 semanas sobre 18 esperadas.', '/pacientes', false, now() - interval '4 days'),
  (u_juan,   p_juan,  u_martin, 'mensaje_medico', 'mensaje', 'alerta',
   'Corrige tu técnica', 'Revisé tu última sesión: la rodilla se adelanta al pie.', '/mensajes', false, now() - interval '4 days'),
  (u_super,  null,    null,     'solicitud_acceso', 'sistema', 'aviso',
   'Nueva solicitud de acceso', 'Dra. Carla Nina (c.nina@gmail.com) pidió acceso con Google.', '/solicitudes', false, now() - interval '5 hours'),
  (u_salazar, null,   null,     'acceso_aprobado', 'sistema', 'info',
   'Acceso aprobado', 'Tu acceso a FisioClin fue aprobado. Ya puedes ingresar al panel.', '/inicio', true, now() - interval '19 days');

-- ---------------------------------------------------------------------------
-- 2.19  DISPOSITIVOS PUSH  (los celulares de los pacientes)
-- ---------------------------------------------------------------------------
insert into public.dispositivos_push (id_usuario, token_expo, plataforma, activo, ultimo_uso)
values
  (u_juan,  'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa1]', 'android', true,  now() - interval '1 day'),
  (u_maria, 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa2]', 'android', true,  now() - interval '2 hours'),
  (u_pedro, 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa3]', 'android', true,  now() - interval '3 days'),
  (u_ana,   'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa4]', 'ios',     true,  now() - interval '5 hours'),
  (u_jose,  'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa5]', 'android', false, now() - interval '25 days');

-- ---------------------------------------------------------------------------
-- 2.20  CITAS  (8, sin choques de horario entre médicos)
-- ---------------------------------------------------------------------------
insert into public.citas (id_paciente, id_medico, id_plan, fecha_hora, duracion_minutos, tipo, modalidad,
                          motivo, lugar, indicaciones, estado, recordatorio_enviado, creada_por)
values
  (p_juan,  m_martin,  pl_juan,  date_trunc('day', now()) + interval '2 days 9 hours',  45, 'control',           'presencial', 'Control de rango articular y adherencia', 'Consultorio 3 — COSSMIL', 'Venir con ropa cómoda.', 'programada', true,  u_martin),
  (p_ana,   m_martin,  pl_ana,   date_trunc('day', now()) + interval '2 days 10 hours', 30, 'control',           'presencial', 'Control de marcha y ROM de tobillo',      'Sala de terapia 1 — COSSMIL', null, 'programada', false, u_martin),
  (p_maria, m_rojas,   pl_maria, date_trunc('day', now()) + interval '1 day 15 hours',  45, 'reevaluacion',      'presencial', 'Reevaluación de dolor femoropatelar',     'Consultorio 4 — COSSMIL', null, 'confirmada', true,  u_rojas),
  (p_pedro, m_rojas,   pl_pedro, date_trunc('day', now()) + interval '3 days 16 hours', 45, 'terapia',           'presencial', 'Sesión supervisada de abducción',         'Sala de terapia 2 — COSSMIL', null, 'programada', false, u_rojas),
  (p_jose,  m_salazar, pl_jose,  date_trunc('day', now()) + interval '5 days 9 hours',  60, 'reevaluacion',      'presencial', 'Reevaluación por baja adherencia',        'Consultorio 5 — COSSMIL', 'Traer el listado de ejercicios hechos.', 'programada', false, u_salazar),
  (p_juan,  m_martin,  pl_juan,  date_trunc('day', now()) - interval '3 days' + interval '9 hours',  45, 'control', 'presencial', 'Control quincenal', 'Consultorio 3 — COSSMIL', null, 'cumplida', true, u_martin),
  (p_maria, m_rojas,   pl_maria, date_trunc('day', now()) - interval '1 day' + interval '15 hours', 45, 'terapia', 'presencial', 'Sesión supervisada', 'Sala de terapia 1 — COSSMIL', null, 'ausente', true, u_rojas),
  (p_pedro, m_andrea,  pl_pedro, date_trunc('day', now()) - interval '6 days' + interval '14 hours', 45, 'evaluacion_inicial', 'presencial', 'Evaluación inicial de marcha', 'Sala de terapia 2 — COSSMIL', null, 'cumplida', true, u_andrea);

-- ---------------------------------------------------------------------------
-- 2.21  REPORTES GENERADOS
-- ---------------------------------------------------------------------------
insert into public.reportes_generados (id_paciente, id_medico_generador, tipo_reporte, rango_fecha_inicio, rango_fecha_fin, ruta_archivo_pdf, fecha_generacion)
values
  (p_juan,  m_martin,  'individual', current_date - 20, current_date, 'reportes/PAC-0001-evolucion.pdf', now() - interval '2 days'),
  (p_maria, m_rojas,   'individual', current_date - 35, current_date, 'reportes/PAC-0002-evolucion.pdf', now() - interval '3 days'),
  (p_pedro, m_rojas,   'individual', current_date - 15, current_date, 'reportes/PAC-0003-evolucion.pdf', now() - interval '1 day'),
  (p_ana,   m_martin,  'individual', current_date - 10, current_date, 'reportes/PAC-0004-evolucion.pdf', now() - interval '1 day'),
  (null,    m_salazar, 'general',    current_date - 30, current_date, 'reportes/general-mensual.pdf',    now() - interval '5 days');

-- ---------------------------------------------------------------------------
-- 2.22  BITÁCORA DE AUDITORÍA
--   Se escribe en MAYÚSCULAS a propósito: el trigger del CHOQUE 6 lo arregla.
-- ---------------------------------------------------------------------------
insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle, fecha)
values
  (u_super,   'superusuario',    'INSERT', 'pacientes',                p_ana::text,   'Alta de paciente ANA SOFIA VARGAS PEREZ.',    now() - interval '12 days'),
  (u_rojas,   'medico_fisiatra', 'UPDATE', 'planes_tratamiento',       pl_maria::text,'Ajuste de carga en sentadilla isométrica.',   now() - interval '3 days'),
  (u_martin,  'medico_fisiatra', 'INSERT', 'prescripciones_ejercicio', pr3::text,     'Nueva prescripción para PAC-0001.',           now() - interval '14 days'),
  (u_super,   'superusuario',    'APROBACION_ACCESO', 'solicitudes_acceso', '4',      'Aprobada la solicitud del Dr. Martín Salazar.', now() - interval '19 days'),
  (u_super,   'superusuario',    'CAMBIO_PERMISOS', 'usuarios',        u_mamani::text,'Se retira el módulo de rutinas al fisioterapeuta.', now() - interval '10 days'),
  (null,      'sistema',         'REVISION_ALERTAS', 'notificaciones', null,          'Revisión automática: 3 avisos generados.',    now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- 2.23  EVALUACIONES CON GONIOMETRO  (antes y despues de usar la app)
--   Esto es lo que sostiene la tesis. Se cargan 10 evaluaciones:
--     · 5 INICIALES  -> medicion a mano antes de empezar con la app
--     · 4 FINALES    -> medicion a mano al terminar el plan
--     · 1 INTERMEDIA -> control a mitad de camino
--   En cada una se guarda tambien lo que midio la camara ese dia, para poder
--   comparar los dos instrumentos.
-- ---------------------------------------------------------------------------
insert into public.evaluaciones_goniometro
  (id_paciente, id_plan, momento, fecha, articulacion, lado,
   angulo_minimo, angulo_maximo, angulo_app, id_sesion_referencia,
   dolor_eva, posicion_paciente, id_medico_evaluador, observaciones)
values
  -- JUAN CARLOS — rodilla derecha. Empieza limitado y mejora bien.
  (p_juan, pl_juan, 'inicial', current_date - 20, 'rodilla', 'derecho',
   5.0, 95.0, 92.0, null, 8, 'Decubito supino, cadera a 0 grados', m_martin,
   'Medicion basal antes de iniciar el uso de la aplicacion.'),
  (p_juan, pl_juan, 'intermedia', current_date - 8, 'rodilla', 'derecho',
   3.0, 110.0, 107.5, s1, 5, 'Decubito supino, cadera a 0 grados', m_martin,
   'Control de la semana 4. Progresa segun lo esperado.'),
  (p_juan, pl_juan, 'final', current_date - 1, 'rodilla', 'derecho',
   2.0, 124.0, 121.0, s3, 3, 'Decubito supino, cadera a 0 grados', m_martin,
   'Medicion final. Gano 27 grados de rango util.'),

  -- MARIA ELENA — rodilla izquierda, grado III. Mejora poca pero real.
  (p_maria, pl_maria, 'inicial', current_date - 35, 'rodilla', 'izquierdo',
   10.0, 88.0, 91.0, null, 7, 'Sedente, borde de camilla', m_rojas,
   'Gonartrosis grado III. Flexion muy limitada por dolor.'),
  (p_maria, pl_maria, 'final', current_date - 2, 'rodilla', 'izquierdo',
   8.0, 104.0, 108.0, s4, 5, 'Sedente, borde de camilla', m_rojas,
   'Gano 18 grados. La camara sobreestimo 4 grados: dentro del umbral.'),

  -- PEDRO LUIS — cadera derecha.
  (p_pedro, pl_pedro, 'inicial', current_date - 15, 'cadera', 'derecho',
   0.0, 32.0, 29.0, null, 6, 'Decubito lateral izquierdo', m_rojas,
   'Abduccion limitada. Marcha antialgica.'),
  (p_pedro, pl_pedro, 'final', current_date - 1, 'cadera', 'derecho',
   0.0, 41.0, 38.0, s7, 3, 'Decubito lateral izquierdo', m_rojas,
   'Gano 9 grados de abduccion y camina sin baston.'),

  -- ANA SOFIA — tobillo derecho. El mejor resultado de los cinco.
  (p_ana, pl_ana, 'inicial', current_date - 10, 'tobillo', 'derecho',
   -12.0, 4.0, 2.0, null, 9, 'Sedente, rodilla a 90 grados', m_martin,
   'Rigidez importante tras retiro de yeso. Dorsiflexion casi nula.'),
  (p_ana, pl_ana, 'final', current_date - 1, 'tobillo', 'derecho',
   -4.0, 16.0, 15.0, s9, 2, 'Sedente, rodilla a 90 grados', m_martin,
   'Recupero 24 grados de recorrido. Marcha normal.'),

  -- JOSE MIGUEL — cadera. Solo tiene la inicial: abandono el plan.
  (p_jose, pl_jose, 'inicial', current_date - 45, 'cadera', 'derecho',
   0.0, 28.0, null, null, 7, 'Decubito lateral izquierdo', m_salazar,
   'Sin medicion final: el paciente dejo de asistir. Queda como caso de baja adherencia.');

-- ---------------------------------------------------------------------------
-- 2.24  ALTAS  (el cierre del ciclo de cada paciente)
--   Tres altas distintas a proposito, para que se vean los tres casos:
--     · JUAN  -> alta medica: cumplio objetivos, no vuelve
--     · ANA   -> alta temporal: quedo bien, pero control en 3 meses
--     · JOSE  -> abandono: dejo de venir, sin evaluacion final
--   El trigger de la base se encarga de cambiar el estado del paciente,
--   cerrar el plan, escribirlo en el historial y avisarle al paciente.
-- ---------------------------------------------------------------------------
insert into public.altas_paciente
  (id_paciente, id_plan, id_evaluacion_final, fecha_alta, tipo_alta,
   cumplio_objetivos, estado_funcional, rom_alcanzado, dolor_final,
   motivo, recomendaciones, requiere_control, fecha_control_sugerida, id_medico_alta)
values
  (p_juan, pl_juan,
   (select id_evaluacion from public.evaluaciones_goniometro
     where id_paciente = p_juan and momento = 'final' limit 1),
   current_date, 'alta_medica', true, 'recuperado', 122.0, 3,
   'Cumplio los objetivos del plan: recupero el rango util de rodilla y camina sin dolor en trayectos largos.',
   'Mantener los ejercicios de cuadriceps tres veces por semana. Evitar escaleras prolongadas el primer mes.',
   false, null, m_martin),

  (p_ana, pl_ana,
   (select id_evaluacion from public.evaluaciones_goniometro
     where id_paciente = p_ana and momento = 'final' limit 1),
   current_date, 'alta_temporal', true, 'funcional', 20.0, 2,
   'Por el momento se da de alta: recupero la movilidad del tobillo y la marcha es normal.',
   'Seguir con los estiramientos diarios de Aquiles. Usar calzado con soporte firme.',
   true, current_date + 90, m_martin),

  (p_jose, pl_jose, null,
   current_date - 3, 'abandono', false, 'sin_cambios', null, null,
   'El paciente dejo de asistir tras dos sesiones. No responde a las llamadas ni a los avisos de la aplicacion.',
   'Si retoma, reiniciar desde la evaluacion inicial: los datos de hace seis semanas ya no sirven.',
   false, null, m_salazar);

raise notice 'Datos de prueba cargados correctamente.';
end $seed$;




-- ============================================================================
--  EXTRA — Dos ejemplos de recuperación de contraseña (para ver la pantalla
--  del superusuario con algo dentro). Si no los quieres, borra este bloque.
-- ============================================================================
do $ejemplos$
declare v_u integer;
begin
  if exists (select 1 from public.recuperaciones_password) then return; end if;

  select id_usuario into v_u from public.usuarios where nombre_usuario = 'dr.salazar';
  if v_u is not null then
    insert into public.recuperaciones_password
      (id_usuario, email, origen, estado, observaciones, fecha_solicitud)
    values (v_u, 'dr.salazar@fisioclin.bo', 'superusuario', 'solicitada',
            'Cuenta nueva: debe definir su contraseña en el primer ingreso.',
            now() - interval '19 days');
  end if;

  select id_usuario into v_u from public.usuarios where nombre_usuario = 'lic.andrea';
  if v_u is not null then
    insert into public.recuperaciones_password
      (id_usuario, email, origen, estado, observaciones, fecha_solicitud, fecha_uso)
    values (v_u, 'lic.andrea@fisioclin.bo', 'usuario', 'usada',
            'Olvidó su contraseña y la recuperó por correo.',
            now() - interval '3 days', now() - interval '3 days' + interval '12 minutes');
  end if;
end $ejemplos$;


-- ============================================================================
--  LISTO. La base quedó completa y lista para conectar el panel.
-- ============================================================================


-- ============================================================================
--  3. RESUMEN DE LO CARGADO
-- ============================================================================
select 'catalogo_modulos'         as tabla, count(*) from public.catalogo_modulos
union all select 'usuarios',                 count(*) from public.usuarios
union all select 'medicos',                  count(*) from public.medicos
union all select 'pacientes',                count(*) from public.pacientes
union all select 'documentos_identidad',     count(*) from public.documentos_identidad
union all select 'consentimiento_informado', count(*) from public.consentimiento_informado
union all select 'solicitudes_acceso',       count(*) from public.solicitudes_acceso
union all select 'ejercicios_catalogo',      count(*) from public.ejercicios_catalogo
union all select 'planes_tratamiento',       count(*) from public.planes_tratamiento
union all select 'prescripciones_ejercicio', count(*) from public.prescripciones_ejercicio
union all select 'sesiones',                 count(*) from public.sesiones
union all select 'metricas_articulares',     count(*) from public.metricas_articulares
union all select 'repeticiones_ejercicio',   count(*) from public.repeticiones_ejercicio
union all select 'registro_dolor',           count(*) from public.registro_dolor
union all select 'historial_clinico',        count(*) from public.historial_clinico
union all select 'adjuntos_clinicos',        count(*) from public.adjuntos_clinicos
union all select 'mensajes',                 count(*) from public.mensajes
union all select 'notificaciones',           count(*) from public.notificaciones
union all select 'dispositivos_push',        count(*) from public.dispositivos_push
union all select 'citas',                    count(*) from public.citas
union all select 'reportes_generados',       count(*) from public.reportes_generados
union all select 'preferencias_usuario',     count(*) from public.preferencias_usuario
union all select 'fotos_perfil',             count(*) from public.fotos_perfil
union all select 'bitacora_auditoria',       count(*) from public.bitacora_auditoria
union all select 'evaluaciones_goniometro', count(*) from public.evaluaciones_goniometro
union all select 'altas_paciente',          count(*) from public.altas_paciente
union all select 'recuperaciones_password', count(*) from public.recuperaciones_password
union all select 'intentos_login',           count(*) from public.intentos_login
order by 1;
