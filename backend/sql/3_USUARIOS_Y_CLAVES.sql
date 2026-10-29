-- ============================================================================
--  FisioClin — ARCHIVO 3:  CUENTAS DE ACCESO (usuario + contraseña)
--  ---------------------------------------------------------------------------
--  Corre este archivo DESPUÉS del 1 y del 2.
--  Se puede correr varias veces: si la cuenta ya existe, le cambia la clave.
--
--  DEJA LISTAS ESTAS DOS CUENTAS:
--
--    ┌──────────────────┬──────────────────────┬─────────────────────────────┐
--    │ Usuario          │ Contraseña           │ Entra como                  │
--    ├──────────────────┼──────────────────────┼─────────────────────────────┤
--    │ superusuario     │ superusuario2026     │ Administrador (ve todo)     │
--    │ dr.martin        │ martin2026           │ Médico fisiatra (sus 3)     │
--    └──────────────────┴──────────────────────┴─────────────────────────────┘
--
--  ---------------------------------------------------------------------------
--  LO QUE TIENES QUE SABER
--
--  Las contraseñas NO se guardan en la tabla `usuarios`. Viven en `auth.users`,
--  que es el sistema de autenticación de Supabase, y se guardan cifradas con
--  bcrypt: ni tú ni yo podemos leerlas después, solo comprobarlas.
--
--  Este archivo escribe directamente ahí. Funciona, pero es la puerta de
--  servicio. La puerta principal es:
--
--      Authentication -> Users -> Add user  (marcando "Auto Confirm User")
--
--  Si el script falla por algún cambio de Supabase, usa el panel: son 30
--  segundos y es el camino oficial. El resultado es el mismo.
--
--  ⚠️ ESTAS CLAVES SON PARA PROBAR. Antes de que entren pacientes reales,
--     cámbialas desde el panel y borra este archivo del proyecto.
-- ============================================================================

create extension if not exists pgcrypto;

do $cuentas$
declare
  -- Cambia aquí si quieres otras claves.
  v_cuentas constant jsonb := jsonb_build_array(
    jsonb_build_object('email', 'superadmin@fisioclin.bo',
                       'usuario', 'superusuario',
                       'clave',   'superusuario2026'),
    jsonb_build_object('email', 'dr.martin@fisioclin.bo',
                       'usuario', 'dr.martin',
                       'clave',   'martin2026')
  );
  c            jsonb;
  v_email      text;
  v_usuario    text;
  v_clave      text;
  v_auth_id    uuid;
  v_id_usuario integer;
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

    -- ------------------------------------------------------------------
    -- 1. La persona tiene que existir en `usuarios` (la creó el archivo 2).
    -- ------------------------------------------------------------------
    select id_usuario into v_id_usuario
      from public.usuarios where lower(email) = lower(v_email);

    if v_id_usuario is null then
      raise exception 'No existe ningún usuario con el correo %. Corre primero el archivo 2_DATOS.sql.', v_email;
    end if;

    -- El nombre con el que va a escribir en el login.
    update public.usuarios
       set nombre_usuario = v_usuario,
           activo = true,
           debe_cambiar_password = false
     where id_usuario = v_id_usuario;

    -- ------------------------------------------------------------------
    -- 2. La cuenta de acceso, con su contraseña cifrada.
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
      -- Ya existía: solo se le cambia la clave.
      update auth.users
         set encrypted_password = crypt(v_clave, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_auth_id;

      raise notice 'Contraseña actualizada: % (usuario: %)', v_email, v_usuario;
    end if;

    -- ------------------------------------------------------------------
    -- 3. La "identidad": Supabase la exige para el login con contraseña.
    --    Sin esta fila, la cuenta existe pero no deja entrar.
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
    -- 4. Enlazar la cuenta con la ficha. (El trigger lo hace solo al crear,
    --    pero si la cuenta ya existía puede que falte.)
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
                                        as "puede entrar",
  (select count(*) from public.pacientes p
    where p.id_medico_tratante = m.id_medico and p.activo)
                                        as "pacientes a cargo"
from public.usuarios u
left join auth.users   a on a.id = u.auth_user_id
left join public.medicos m on m.id_usuario = u.id_usuario
where u.email in ('superadmin@fisioclin.bo', 'dr.martin@fisioclin.bo')
order by u.rol::text;
