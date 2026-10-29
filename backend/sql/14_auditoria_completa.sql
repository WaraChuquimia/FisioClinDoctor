-- ============================================================================
--  FisioClin — Auditoría completa: también lo que hacen los pacientes
-- ----------------------------------------------------------------------------
--  POR QUÉ
--    `fn_auditar()` (el disparador genérico de bitácora) solo estaba pegado a
--    7 tablas: pacientes, planes_tratamiento, prescripciones_ejercicio,
--    usuarios, medicos, citas, ejercicios_catalogo — más evaluaciones_goniometro
--    y altas_paciente que lo tenían aparte. Faltaban justo las tablas donde
--    vive lo que hace el PACIENTE con la app: sus sesiones de ejercicio, su
--    dolor registrado, las métricas que calculó la cámara — y lo que anota el
--    médico en el historial clínico. Ninguna de esas 4 dejaba rastro en la
--    bitácora.
--
--  QUÉ CAMBIA
--    1. `fn_auditar()` suma los 4 nombres de clave primaria que le faltaban.
--    2. Se engancha el mismo disparador a esas 4 tablas:
--       sesiones, historial_clinico, registro_dolor, metricas_articulares.
--
--  QUÉ NO SE AUDITA A PROPÓSITO
--    `repeticiones_ejercicio` queda AFUERA. Es telemetría de altísimo
--    volumen (cada repetición de cada serie de cada sesión — decenas de
--    filas por sesión) y nunca se borra ni se edita sola: la fila original
--    ES el registro. Auditar cada repetición una por una llenaría la
--    bitácora de ruido sin sumar nada que `repeticiones_ejercicio` no tenga
--    ya. Si en algún momento se necesita, se puede sumar después de la misma
--    forma que las demás.
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
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
    -- --- nuevo: lo que hace el paciente con la app, y el historial clínico ---
    when 'sesiones'                 then v_fila ->> 'id_sesion'
    when 'historial_clinico'        then v_fila ->> 'id_historial'
    when 'registro_dolor'           then v_fila ->> 'id_registro_dolor'
    when 'metricas_articulares'     then v_fila ->> 'id_metrica'
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
  foreach t in array array['sesiones', 'historial_clinico', 'registro_dolor', 'metricas_articulares']
  loop
    execute format('drop trigger if exists trg_auditar on public.%I', t);
    execute format('create trigger trg_auditar after insert or update or delete on public.%I
                    for each row execute function public.fn_auditar()', t);
  end loop;
end $$;
