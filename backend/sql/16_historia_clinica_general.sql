-- ============================================================================
--  16 — HISTORIA CLÍNICA GENERAL (ficha de ingreso, formato papel)
-- ----------------------------------------------------------------------------
--  Digitaliza el formulario físico "HISTORIA CLÍNICA GENERAL" (anamnesis,
--  motivo de consulta, enfermedad actual, antecedentes, tratamiento,
--  hábitos, examen físico). Es una ficha ÚNICA por paciente (se llena una
--  vez al ingreso y se puede editar después), separada de las notas de
--  seguimiento día a día que ya vive en `historial_clinico`.
--
--  Mismo patrón de siempre: RLS por paciente a cargo, auditoría, tiempo
--  real. Se puede correr varias veces sin romper nada.
-- ============================================================================

create table if not exists public.historia_clinica_general (
  id_historia_general       integer generated always as identity primary key,
  id_paciente               integer not null unique references public.pacientes(id_paciente),
  id_medico_registra        integer not null references public.medicos(id_medico),

  -- Anamnesis: quién da la información y si se considera confiable.
  anamnesis_informante      varchar(20) not null default 'paciente'
    check (anamnesis_informante in ('paciente', 'madre', 'padre', 'familiar', 'otro')),
  anamnesis_confiable       boolean not null default true,

  motivo_consulta           text not null,
  enfermedad_actual         text,   -- inicio, evolución y estado actual
  antecedentes_patologicos  text,   -- enfermedades previas, cirugías
  tratamiento_actual        text,   -- indicación médica / automedicación
  habitos                   text,   -- alimenticios, alcohólicos, tabáquicos y otros
  habitos_higienicos        text,   -- micción, diuresis y catarsis
  examen_fisico             text,

  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  actualizado_por           integer references public.usuarios(id_usuario)
);

-- `actualizado_en` se mantiene solo, igual que en el resto de las tablas.
drop trigger if exists trg_tocar_actualizado on public.historia_clinica_general;
create trigger trg_tocar_actualizado before update on public.historia_clinica_general
  for each row execute function public.fn_tocar_actualizado_en();

-- --- RLS: mismo criterio que el resto de lo que cuelga del paciente --------
alter table public.historia_clinica_general enable row level security;

drop policy if exists p_super_todo on public.historia_clinica_general;
create policy p_super_todo on public.historia_clinica_general for all
  using (app.es_super()) with check (app.es_super());

drop policy if exists p_por_paciente on public.historia_clinica_general;
create policy p_por_paciente on public.historia_clinica_general for all
  using (app.paciente_visible(id_paciente))
  with check (app.paciente_visible(id_paciente));

-- Sin este permiso la API responde "permission denied" aunque la RLS esté bien
-- (el resto de tablas lo reciben en 1_BASE_DE_DATOS.sql).
grant select, insert, update, delete on public.historia_clinica_general to authenticated;

-- --- Auditoría: sumar esta tabla a fn_auditar() (bitácora) -------------------
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
    when 'sesiones'                 then v_fila ->> 'id_sesion'
    when 'historial_clinico'        then v_fila ->> 'id_historial'
    when 'registro_dolor'           then v_fila ->> 'id_registro_dolor'
    when 'metricas_articulares'     then v_fila ->> 'id_metrica'
    when 'recetas_medicamentos'     then v_fila ->> 'id_receta'
    -- --- nuevo: historia clínica general ---
    when 'historia_clinica_general' then v_fila ->> 'id_historia_general'
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

drop trigger if exists trg_auditar on public.historia_clinica_general;
create trigger trg_auditar after insert or update or delete on public.historia_clinica_general
  for each row execute function public.fn_auditar();

-- --- Tiempo real --------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'historia_clinica_general'
  ) then
    alter publication supabase_realtime add table public.historia_clinica_general;
  end if;
end $$;
