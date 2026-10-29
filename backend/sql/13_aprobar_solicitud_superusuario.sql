-- ============================================================================
--  FisioClin — Aprobar una solicitud como Superusuario (administrador)
-- ----------------------------------------------------------------------------
--  POR QUÉ
--    `fn_aprobar_solicitud` siempre insertaba una fila en `medicos`, sin
--    importar el rol con el que se aprobara. Si alguien se aprobaba como
--    'superusuario' (administrador), igual quedaba con una ficha de médico
--    falsa: cédula "SIN-CEDULA-123", especialidad por defecto, etc. — algo
--    que el resto del sistema asume que NUNCA pasa (el superusuario "no
--    atiende pacientes, no tiene ficha en medicos", como ya dice el
--    comentario de `actualizarPerfilMedico` en api.js).
--    Tampoco guardaba el nombre del administrador en ningún lado: su nombre
--    para mostrar vive en `usuarios.nombre_completo` (agregado en
--    07_perfil_administrador.sql), y esta función no lo llenaba.
--
--  QUÉ CAMBIA
--    `fn_aprobar_solicitud` ahora SOLO crea la ficha en `medicos` cuando
--    `p_rol <> 'superusuario'`. Si se aprueba como superusuario, en cambio,
--    guarda el nombre de la solicitud directo en `usuarios.nombre_completo`
--    y el `id_medico` que devuelve la función queda en null.
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

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

  v_rol := p_rol;  -- texto -> enum

  insert into public.usuarios
    (auth_user_id, nombre_usuario, email, rol, activo, debe_cambiar_password,
     modulos_permitidos, actualizado_por, nombre_completo)
  values
    (s.auth_user_id, v_usuario, lower(s.email), v_rol, true,
     s.auth_user_id is null,      -- si entró por Google no hay contraseña que cambiar
     coalesce(p_modulos, '{}'::jsonb), app.id_usuario(),
     -- Para un médico esto queda redundante con `medicos.nombre_completo`
     -- (que manda); para el superusuario es el ÚNICO lugar donde vive.
     case when v_rol = 'superusuario' then s.nombre_completo else null end)
  returning id_usuario into v_id_usuario;

  -- El superusuario no atiende pacientes: no lleva ficha en `medicos` (esa
  -- tabla solo admite tipo_profesional medico_fisiatra/fisioterapeuta).
  if v_rol <> 'superusuario' then
    v_tipo := coalesce(p_tipo, s.tipo_profesional::text);  -- texto -> enum

    insert into public.medicos
      (id_usuario, nombre_completo, tipo_profesional, especialidad, cedula_profesional, telefono, actualizado_por)
    values
      (v_id_usuario, s.nombre_completo,
       v_tipo,
       p_especialidad,
       coalesce(p_cedula, s.cedula_profesional, 'SIN-CEDULA-' || v_id_usuario::text),
       s.telefono, app.id_usuario())
    returning id_medico into v_id_medico;
  end if;

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

grant execute on function public.fn_aprobar_solicitud(integer, text, text, text, text, jsonb) to authenticated;
