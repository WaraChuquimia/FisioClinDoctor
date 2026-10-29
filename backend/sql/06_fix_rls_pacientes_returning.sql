-- ============================================================================
--  FisioClin — FIX: un médico no podía registrar pacientes
-- ----------------------------------------------------------------------------
--  SÍNTOMA
--    Con la cuenta del superusuario, registrar un paciente funcionaba.
--    Con la cuenta de un médico (dr.martin), la MISMA acción fallaba con:
--      "Tu usuario no tiene permiso para esta acción. Revisa con el
--       administrador que tengas ficha de profesional activa."
--    (mensaje amigable de src/lib/api.js para el error crudo de Postgres:
--     "new row violates row-level security policy for table pacientes")
--
--  CAUSA REAL (verificada con pruebas directas contra la base)
--    La política de LECTURA de `pacientes` (p_pacientes_leer) usaba
--    app.paciente_visible(id_paciente), una función que vuelve a CONSULTAR
--    la tabla `pacientes` desde adentro con un EXISTS.
--
--    Cuando el panel inserta un paciente pidiendo el resultado de vuelta
--    (`.insert(...).select()`, que en SQL equivale a INSERT ... RETURNING),
--    Postgres revisa que la fila recién insertada también pase la política
--    de LECTURA antes de devolverla. Esa revisión, en este caso puntual,
--    no llega a "ver" la fila que se está insertando EN ESE MISMO
--    comando — así que la rechaza, aunque el paciente sí pertenece a ese
--    médico.
--
--    Con el superusuario nunca se notaba: su política (p_super_todo) no
--    depende de volver a consultar `pacientes`, así que no tropieza con
--    esto.
--
--  SOLUCIÓN
--    Reescribir las políticas de LECTURA y EDICIÓN de `pacientes` para que
--    miren directamente las columnas de la fila en cuestión (que Postgres
--    ya tiene en memoria) en vez de volver a consultar la tabla. Mismo
--    resultado de seguridad, sin el problema de visibilidad.
--
--    OTRAS tablas que usan app.paciente_visible(id_paciente) (sesiones,
--    citas, historial_clinico, etc.) NO tienen este problema: para ellas,
--    consultar `pacientes` es una tabla distinta a la que se está
--    escribiendo, así que no hay conflicto de "verse a sí misma". No hace
--    falta tocarlas.
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

drop policy if exists p_pacientes_leer on public.pacientes;
create policy p_pacientes_leer on public.pacientes for select
  using (
    app.es_super()
    or id_medico_tratante         = app.id_medico()
    or id_fisioterapeuta_asignado = app.id_medico()
    or id_medico_registrador      = app.id_medico()
    or id_usuario                 = app.id_usuario()
  );

drop policy if exists p_pacientes_editar on public.pacientes;
create policy p_pacientes_editar on public.pacientes for update
  using (
    app.es_super()
    or id_medico_tratante         = app.id_medico()
    or id_fisioterapeuta_asignado = app.id_medico()
    or id_medico_registrador      = app.id_medico()
    or id_usuario                 = app.id_usuario()
  )
  with check (
    app.es_super()
    or id_medico_tratante         = app.id_medico()
    or id_fisioterapeuta_asignado = app.id_medico()
    or id_medico_registrador      = app.id_medico()
    or id_usuario                 = app.id_usuario()
  );

-- Verificación: no debe dar error, y las dos políticas deben aparecer.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'pacientes'
order by policyname;
