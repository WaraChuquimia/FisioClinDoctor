-- ============================================================================
--  10 — TIEMPO REAL para el panel (Módulo de Evolución y fichas de paciente)
--  Ejecutar UNA vez en Supabase → SQL Editor.
--
--  Supabase solo avisa cambios de las tablas que están en la publicación
--  `supabase_realtime`. Sin esto, la app se suscribe pero nunca le llega nada.
--  Las políticas RLS se siguen respetando: cada médico solo recibe avisos de
--  los pacientes que puede ver.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes', 'sesiones', 'repeticiones_ejercicio', 'metricas_articulares',
    'registro_dolor', 'evaluaciones_goniometro', 'planes_tratamiento',
    'prescripciones_ejercicio', 'altas_paciente', 'historial_clinico']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Comprobar: deben salir las 10 tablas.
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;
