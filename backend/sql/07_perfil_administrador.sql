-- ============================================================================
--  FisioClin — El administrador también tiene nombre de perfil
-- ----------------------------------------------------------------------------
--  POR QUÉ
--    El nombre para mostrar de un médico vive en `medicos.nombre_completo`.
--    El superusuario NO tiene ficha en `medicos` (no atiende pacientes), así
--    que no tenía dónde guardar su propio nombre — "Mi perfil" le salía en
--    blanco y guardar cambios le daba error.
--
--  QUÉ CAMBIA
--    1. `usuarios.nombre_completo`: nueva columna, para cualquier cuenta que
--       no tenga ficha de médico.
--    2. `vista_sesion_actual` y `vista_usuarios_admin`: ahora muestran
--       COALESCE(medicos.nombre_completo, usuarios.nombre_completo) — un
--       médico sigue viéndose igual que antes; el superusuario ya tiene de
--       dónde sacar el suyo.
--    3. `fn_actualizar_nombre_usuario(p_nombre)`: función para que cualquiera
--       cambie SU PROPIO nombre (solo el suyo — usa `app.id_usuario()`).
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

alter table public.usuarios add column if not exists nombre_completo varchar(150);

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
  fn_permisos(u.id_usuario) as permissions,
  m.id_medico,
  coalesce(m.nombre_completo, u.nombre_completo) as nombre_completo,
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
  and u.rol::text <> 'paciente';

grant select on public.vista_sesion_actual to authenticated;

-- vista_usuarios_admin: hay que soltarla y volver a crearla porque le
-- agregamos columnas nuevas (avatar_bucket/avatar_path) y Postgres no deja
-- reordenar columnas de una vista con CREATE OR REPLACE.
drop view if exists public.vista_usuarios_admin;

create view public.vista_usuarios_admin as
select
  u.id_usuario, u.rol::text as rol, u.email, u.nombre_usuario, u.activo,
  u.debe_cambiar_password, u.ultimo_acceso, u.modulos_permitidos,
  m.id_medico, coalesce(m.nombre_completo, u.nombre_completo) as medico_nombre,
  m.cedula_profesional,
  p.nombre_completo as paciente_nombre,
  fp.bucket as avatar_bucket, fp.storage_path as avatar_path,
  (u.auth_user_id is not null) as tiene_cuenta_auth,
  (select count(*) from public.pacientes pa
    where pa.id_medico_tratante = m.id_medico and pa.activo) as pacientes_a_cargo
from public.usuarios u
left join public.medicos m on m.id_usuario = u.id_usuario
left join public.pacientes p on p.id_usuario = u.id_usuario
left join public.fotos_perfil fp on fp.id_usuario = u.id_usuario;

grant select on public.vista_usuarios_admin to authenticated;

create or replace function public.fn_actualizar_nombre_usuario(p_nombre text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_id integer := app.id_usuario();
begin
  if v_id is null then raise exception 'No hay sesión activa'; end if;
  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;

  update public.usuarios set nombre_completo = trim(p_nombre) where id_usuario = v_id;

  insert into public.bitacora_auditoria (id_usuario, rol, accion, tabla, id_registro, detalle)
  values (v_id, app.rol(), 'update', 'usuarios', v_id::text, 'Actualizó su nombre de perfil');

  return jsonb_build_object('ok', true, 'nombre_completo', trim(p_nombre));
end $fn$;

grant execute on function public.fn_actualizar_nombre_usuario(text) to authenticated;

-- Nombre inicial para el admin que ya existe (cámbialo tú mismo desde "Mi
-- perfil" cuando quieras).
update public.usuarios set nombre_completo = 'Administrador'
 where email = 'admin@gmail.com' and nombre_completo is null;
