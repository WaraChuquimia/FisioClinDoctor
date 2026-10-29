-- ============================================================================
--  FisioClin — Reingreso con una articulación distinta a la del alta
-- ----------------------------------------------------------------------------
--  POR QUÉ
--    "Reingreso" (fn_reabrir_tratamiento) solo reactivaba el tratamiento y
--    dejaba una nota libre ("motivo"). Si el paciente volvía con OTRA
--    articulación (tuvo alta de cadera, ahora es rodilla), no había forma de
--    actualizarlo desde ahí: `pacientes.articulacion_principal` y
--    `diagnostico_previo` quedaban con el dato viejo hasta que alguien
--    entrara a "Editar" en Datos de filiación — y encima, al pisarlos, se
--    perdía el rastro de cuál fue el diagnóstico anterior.
--
--  QUÉ CAMBIA
--    `fn_reabrir_tratamiento` suma dos parámetros opcionales:
--    `p_articulacion` y `p_diagnostico`. Si `p_articulacion` viene y es
--    DISTINTA a la que el paciente ya tenía:
--      1. Deja el diagnóstico anterior como antecedente en el historial
--         clínico (tipo "diagnostico" — la misma lista que ya arma
--         "Progresión del diagnóstico" en el Resumen del paciente).
--      2. Actualiza `pacientes.articulacion_principal` y
--         `diagnostico_previo` a los nuevos valores — por eso aparecen
--         solos en el Resumen apenas se recarga, sin tocar nada del panel.
--      3. Deja el diagnóstico nuevo como entrada "actual" del mismo
--         historial.
--    Si `p_articulacion` no cambia (o no se manda), se comporta exactamente
--    como antes.
--
--  Se puede correr varias veces sin romper nada.
-- ============================================================================

create or replace function public.fn_reabrir_tratamiento(
  p_id_paciente  integer,
  p_motivo       text default null,
  p_articulacion text default null,
  p_diagnostico  text default null
)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_articulacion_antes text;
  v_diagnostico_antes  text;
  v_cambia_articulacion boolean;
begin
  if not app.paciente_visible(p_id_paciente) then
    raise exception 'Ese paciente no esta a tu cargo';
  end if;

  select articulacion_principal::text, diagnostico_previo
    into v_articulacion_antes, v_diagnostico_antes
    from public.pacientes
   where id_paciente = p_id_paciente;

  v_cambia_articulacion := p_articulacion is not null
    and lower(trim(p_articulacion)) <> coalesce(v_articulacion_antes, '');

  if v_cambia_articulacion then
    -- El diagnóstico que se va a pisar queda escrito como antecedente,
    -- ANTES de actualizar la ficha — así "Progresión del diagnóstico" no
    -- pierde el rastro de la articulación anterior.
    insert into public.historial_clinico
      (id_paciente, id_medico, tipo_entrada, titulo, contenido, visible_para_paciente)
    values
      (p_id_paciente, app.id_medico(), 'diagnostico',
       'Diagnóstico anterior: ' || initcap(coalesce(v_articulacion_antes, 'sin articulación')),
       coalesce(v_diagnostico_antes, 'Sin detalle registrado.'), true);

    update public.pacientes
       set articulacion_principal = lower(trim(p_articulacion))::public.articulacion,
           diagnostico_previo = coalesce(nullif(trim(p_diagnostico), ''), diagnostico_previo)
     where id_paciente = p_id_paciente;

    insert into public.historial_clinico
      (id_paciente, id_medico, tipo_entrada, titulo, contenido, visible_para_paciente)
    values
      (p_id_paciente, app.id_medico(), 'diagnostico',
       'Nuevo diagnóstico: ' || initcap(lower(trim(p_articulacion))),
       coalesce(nullif(trim(p_diagnostico), ''), 'Sin detalle registrado.'), true);
  elsif p_diagnostico is not null and trim(p_diagnostico) <> '' then
    update public.pacientes
       set diagnostico_previo = trim(p_diagnostico)
     where id_paciente = p_id_paciente;
  end if;

  update public.pacientes
     set estado_tratamiento = 'en_tratamiento', activo = true
   where id_paciente = p_id_paciente;

  insert into public.historial_clinico
    (id_paciente, id_medico, tipo_entrada, titulo, contenido, visible_para_paciente)
  values
    (p_id_paciente, app.id_medico(), 'evolucion', 'Reingreso al tratamiento',
     coalesce(nullif(trim(p_motivo), ''), 'El paciente vuelve a tratamiento tras el alta.'), true);

  return jsonb_build_object('ok', true);
end $fn$;

grant execute on function public.fn_reabrir_tratamiento(integer, text, text, text) to authenticated;
