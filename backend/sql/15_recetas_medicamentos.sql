-- ============================================================================
--  15 — RECETA DE MEDICAMENTOS
-- ----------------------------------------------------------------------------
--  Nueva pestaña "Medicamentos" en la ficha del paciente, igual de real que
--  "Rutina Prescrita": tabla propia, RLS por paciente a cargo, auditoría y
--  tiempo real, siguiendo exactamente el mismo patrón que
--  prescripciones_ejercicio / planes_tratamiento (ver 1_BASE_DE_DATOS.sql).
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

create table if not exists public.recetas_medicamentos (
  id_receta             integer generated always as identity primary key,
  id_paciente           integer not null references public.pacientes(id_paciente),
  id_medico_prescriptor integer not null references public.medicos(id_medico),
  nombre_medicamento    varchar(150) not null,
  dosis                 varchar(80) not null,
  frecuencia            varchar(80) not null,
  fecha_inicio          date not null default current_date,
  fecha_fin             date,
  indicaciones          text,
  activa                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       integer references public.usuarios(id_usuario)
);

create index if not exists ix_recetas_paciente_activa
  on public.recetas_medicamentos (id_paciente) where activa;

-- `actualizado_en` se mantiene solo, igual que en el resto de las tablas.
drop trigger if exists trg_tocar_actualizado on public.recetas_medicamentos;
create trigger trg_tocar_actualizado before update on public.recetas_medicamentos
  for each row execute function public.fn_tocar_actualizado_en();

-- --- RLS: mismo criterio que planes_tratamiento/prescripciones_ejercicio ----
--   superusuario ve y edita todo; un médico/fisioterapeuta solo lo que
--   cuelga de SUS pacientes (app.paciente_visible).
alter table public.recetas_medicamentos enable row level security;

drop policy if exists p_super_todo on public.recetas_medicamentos;
create policy p_super_todo on public.recetas_medicamentos for all
  using (app.es_super()) with check (app.es_super());

drop policy if exists p_por_paciente on public.recetas_medicamentos;
create policy p_por_paciente on public.recetas_medicamentos for all
  using (app.paciente_visible(id_paciente))
  with check (app.paciente_visible(id_paciente));

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
    -- --- nuevo: recetas de medicamentos ---
    when 'recetas_medicamentos'     then v_fila ->> 'id_receta'
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

drop trigger if exists trg_auditar on public.recetas_medicamentos;
create trigger trg_auditar after insert or update or delete on public.recetas_medicamentos
  for each row execute function public.fn_auditar();

-- --- Tiempo real: para que la ficha del paciente se actualice sola ---------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'recetas_medicamentos'
  ) then
    alter publication supabase_realtime add table public.recetas_medicamentos;
  end if;
end $$;
