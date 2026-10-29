-- ============================================================================
--  FisioClin — FIX: "duplicate key ... pacientes_codigo_anonimo_key"
-- ----------------------------------------------------------------------------
--  SÍNTOMA
--    Un médico nuevo (sin pacientes propios todavía) no podía registrar a su
--    primer paciente: la base rechazaba el INSERT con un choque de código
--    duplicado (PAC-0001, PAC-0002...), aunque ese código no se veía usado
--    en ningún lado.
--
--  CAUSA REAL
--    fn_codigo_anonimo() (el trigger que inventa el código PAC-XXXX) no era
--    SECURITY DEFINER. Corría con los permisos del médico que registra, así
--    que su "select max(código) from pacientes" quedaba filtrado por RLS:
--    cada médico solo ve a SUS PROPIOS pacientes. Un médico con 0 pacientes
--    visibles calculaba "el siguiente es PAC-0001" — aunque otro médico ya
--    lo estuviera usando en un paciente que él no puede ver.
--
--  SOLUCIÓN
--    Marcar la función SECURITY DEFINER (como ya están la mayoría de las
--    funciones de este sistema que necesitan mirar más allá de lo que el
--    usuario actual tiene permitido ver). Así calcula el siguiente número
--    mirando TODOS los pacientes, sin que eso le dé al médico ningún permiso
--    nuevo sobre los datos (solo se usa para contar, nunca se expone).
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

create or replace function public.fn_codigo_anonimo()
returns trigger language plpgsql security definer set search_path = public as $fn$
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
