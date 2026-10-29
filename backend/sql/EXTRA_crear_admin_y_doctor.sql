-- ============================================================================
--  FisioClin — Crear cuentas de acceso: Administrador + Doctor
--  ---------------------------------------------------------------------------
--  Pensado para correr DESPUÉS de borrar todos los datos (EXTRA_borrar_datos.sql
--  o un borrado manual). No depende de 2_DATOS.sql: crea todo desde cero.
--  Se puede correr varias veces: si la cuenta ya existe, solo le actualiza
--  la contraseña y los datos.
--
--  DEJA LISTAS ESTAS DOS CUENTAS:
--
--    ┌──────────────┬────────────────────┬──────────────┬─────────────────────┐
--    │ Usuario      │ Correo             │ Contraseña   │ Entra como          │
--    ├──────────────┼────────────────────┼──────────────┼─────────────────────┤
--    │ admin        │ admin@gmail.com    │ admin2026    │ Administrador       │
--    │ dr.martin    │ martin@gmail.com   │ martin2026   │ Médico fisiatra     │
--    └──────────────┴────────────────────┴──────────────┴─────────────────────┘
--
--  NOTA: pediste "arroba gmai.com" para los correos; aquí se asume que es
--  "@gmail.com" (typo de "gmail"). Si en realidad querías otro dominio,
--  cambia los correos en el bloque `v_cuentas` de abajo antes de correr esto.
--
--  Cómo correrlo: Supabase -> tu proyecto -> SQL Editor -> pega este archivo
--  completo -> Run.
--
--  ⚠️ Estas claves son para probar. Antes de que entren pacientes reales,
--     cámbialas desde el panel (Authentication -> Users) y borra este archivo.
-- ============================================================================

create extension if not exists pgcrypto;

do $cuentas$
declare
  v_perm_medico jsonb := '{"inicio":true,"pacientes":true,"ejercicios":true,"rutinas":true,
                           "sesiones":true,"evolucion":true,"citas":true,"notificaciones":true,
                           "reportes":true,"perfil":true,"configuracion":true,
                           "solicitudes":false,"usuarios":false,"medicos":false,"auditoria":false}'::jsonb;

  -- Cambia aquí si quieres otros correos/claves.
  v_cuentas constant jsonb := jsonb_build_array(
    jsonb_build_object('email', 'admin@gmail.com',
                       'usuario', 'admin',
                       'clave',   'admin2026',
                       'rol',     'superusuario'),
    jsonb_build_object('email', 'martin@gmail.com',
                       'usuario', 'dr.martin',
                       'clave',   'martin2026',
                       'rol',     'medico_fisiatra')
  );

  c                   jsonb;
  v_email             text;
  v_usuario           text;
  v_clave             text;
  v_rol               text;
  v_auth_id           uuid;
  v_id_usuario        integer;
  v_tiene_provider_id boolean;
begin
  -- ¿Esta versión de Supabase pide `provider_id` en las identidades?
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'identities'
       and column_name = 'provider_id'
  ) into v_tiene_provider_id;

  for c in select * from jsonb_array_elements(v_cuentas) loop
    v_email   := c ->> 'email';
    v_usuario := c ->> 'usuario';
    v_clave   := c ->> 'clave';
    v_rol     := c ->> 'rol';

    -- ------------------------------------------------------------------
    -- 1. La ficha en `usuarios` (raíz de todo en este sistema).
    -- ------------------------------------------------------------------
    select id_usuario into v_id_usuario
      from public.usuarios where lower(email) = lower(v_email);

    if v_id_usuario is null then
      insert into public.usuarios (nombre_usuario, email, rol, activo, debe_cambiar_password, modulos_permitidos)
      values (v_usuario, lower(v_email), v_rol::public.rol_sistema, true, false,
              case when v_rol = 'medico_fisiatra' then v_perm_medico else '{}'::jsonb end)
      returning id_usuario into v_id_usuario;

      raise notice 'Ficha creada en usuarios: % (%)', v_email, v_rol;
    else
      update public.usuarios
         set nombre_usuario = v_usuario,
             rol            = v_rol::public.rol_sistema,
             activo         = true,
             debe_cambiar_password = false
       where id_usuario = v_id_usuario;

      raise notice 'Ficha en usuarios ya existía, actualizada: %', v_email;
    end if;

    -- ------------------------------------------------------------------
    -- 2. Si es médico, necesita también su ficha profesional en `medicos`.
    -- ------------------------------------------------------------------
    if v_rol = 'medico_fisiatra'
       and not exists (select 1 from public.medicos where id_usuario = v_id_usuario) then
      insert into public.medicos (id_usuario, nombre_completo, tipo_profesional, especialidad,
                                  cedula_profesional, telefono, biografia, consultorio, horario_atencion)
      values (v_id_usuario, 'Dr. Alejandro Martin', 'medico_fisiatra',
              'Medicina Física y Rehabilitación', 'MP-4821', '+591 70000010',
              'Médico fisiatra.', 'Consultorio 3, planta baja', 'Lun a Vie, 08:00–14:00');

      raise notice 'Ficha profesional creada en medicos para %', v_email;
    end if;

    -- ------------------------------------------------------------------
    -- 3. La cuenta de acceso, con su contraseña cifrada (auth.users).
    -- ------------------------------------------------------------------
    select id into v_auth_id from auth.users where lower(email) = lower(v_email);

    if v_auth_id is null then
      v_auth_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
        lower(v_email), crypt(v_clave, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nombre_usuario', v_usuario),
        '', '', '', ''
      );

      raise notice 'Cuenta creada: % (usuario: %)', v_email, v_usuario;
    else
      update auth.users
         set encrypted_password = crypt(v_clave, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_auth_id;

      raise notice 'Contraseña actualizada: % (usuario: %)', v_email, v_usuario;
    end if;

    -- ------------------------------------------------------------------
    -- 4. La "identidad": Supabase la exige para el login con contraseña.
    -- ------------------------------------------------------------------
    if not exists (select 1 from auth.identities
                    where user_id = v_auth_id and provider = 'email') then
      if v_tiene_provider_id then
        insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                     last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), v_auth_id,
                jsonb_build_object('sub', v_auth_id::text, 'email', lower(v_email),
                                   'email_verified', true, 'phone_verified', false),
                'email', v_auth_id::text, now(), now(), now());
      else
        insert into auth.identities (id, user_id, identity_data, provider,
                                     last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), v_auth_id,
                jsonb_build_object('sub', v_auth_id::text, 'email', lower(v_email)),
                'email', now(), now(), now());
      end if;
    end if;

    -- ------------------------------------------------------------------
    -- 5. Enlazar la cuenta con la ficha (el trigger lo hace solo, esto
    --    es solo por si acaso).
    -- ------------------------------------------------------------------
    update public.usuarios
       set auth_user_id = v_auth_id
     where id_usuario = v_id_usuario and auth_user_id is distinct from v_auth_id;
  end loop;
end $cuentas$;


-- ============================================================================
--  COMPROBACIÓN — las dos cuentas tienen que salir con TODO en verdadero
-- ============================================================================
select
  u.nombre_usuario                      as "usuario para el login",
  u.email                               as "correo",
  u.rol::text                           as "rol",
  m.nombre_completo                     as "profesional",
  (u.auth_user_id is not null)          as "enlazada",
  (a.encrypted_password is not null)    as "tiene contraseña",
  (a.email_confirmed_at is not null)    as "correo confirmado",
  exists (select 1 from auth.identities i
           where i.user_id = a.id and i.provider = 'email')
                                        as "puede entrar"
from public.usuarios u
left join auth.users   a on a.id = u.auth_user_id
left join public.medicos m on m.id_usuario = u.id_usuario
where u.email in ('admin@gmail.com', 'martin@gmail.com')
order by u.rol::text;
