-- ============================================================================
--  FisioClin — Diagnóstico: por qué el admin no puede registrar pacientes
-- ----------------------------------------------------------------------------
--  El mensaje "Tu usuario no tiene permiso para esta acción..." es la
--  traducción amigable de un error real de Postgres: "row-level security
--  policy" (ver src/lib/api.js, MENSAJES_ERROR_BD). Ya descartamos que sea
--  un problema de enlace de cuenta (el admin y dr.martin están bien
--  enlazados). Esto revisa si las políticas de seguridad de `pacientes`
--  están completas.
-- ============================================================================

-- PASO 1 — ¿Qué políticas existen hoy sobre la tabla pacientes?
--   Tienen que aparecer AL MENOS estas dos filas:
--     p_super_todo   | ALL    | app.es_super()
--     p_pacientes_alta | INSERT | (app.id_medico() IS NOT NULL) AND ...
--   Si "p_super_todo" no aparece en la lista, ese es el problema: el
--   PASO 11 de 1_BASE_DE_DATOS.sql no llegó a crear esa política aquí.
select policyname, cmd, roles, qual as "using", with_check
from pg_policies
where schemaname = 'public' and tablename = 'pacientes'
order by policyname;

-- PASO 2 — ¿Tiene RLS activado la tabla? (tiene que decir true)
select relrowsecurity as rls_activado
from pg_class
where oid = 'public.pacientes'::regclass;

-- PASO 3 — Simulación: ¿qué ve la base cuando el admin llama a app.es_super()?
--   OJO: esto corre como el usuario del SQL Editor (normalmente postgres),
--   no como el admin real, así que puede salir NULL/false aquí aunque en la
--   app funcione bien. Solo sirve para confirmar que la función no está rota.
select proname, prosecdef as es_security_definer
from pg_proc
where proname in ('es_super', 'id_medico', 'id_usuario', 'rol')
  and pronamespace = 'app'::regnamespace;
