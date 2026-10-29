-- ============================================================================
-- ROM FUNCIONAL PARA ACTIVIDADES DE LA VIDA DIARIA
-- ----------------------------------------------------------------------------
-- Objetivo 4 del trabajo de grado pide "determinar su precisión, utilidad y
-- aporte en la generación de información objetiva para la toma de decisiones
-- hospitalarias". `evaluaciones_goniometro` y sus vistas (vista_evaluacion_
-- pre_post, vista_validacion_goniometro) ya contestan precisión y ganancia
-- de ROM en grados — pero un número de grados solo no dice si el paciente
-- YA PUEDE sentarse, subir escaleras o atarse los zapatos otra vez. Esto
-- agrega esa lectura clínica, sin tocar lo que ya funciona.
--
-- Los umbrales NO son inventados: son el ROM funcional reportado en
-- estudios de actividades de la vida diaria, que es un SUBCONJUNTO del
-- rango anatómico normal (cadera 0-120° de flexión, rodilla 0-135°, AAOS/
-- Norkin & White) — no otra escala, solo el tramo que de verdad se usa al
-- vivir el día a día:
--   - Cadera: sit-to-stand y uso del inodoro necesitan >90° de flexión;
--     subir a la cama o al auto, ~100°; atarse los zapatos sentado, 120°
--     (la AVD más exigente medida, junto con ~27° de abducción).
--   - Rodilla: subir/bajar escaleras necesita ~90°; levantarse de una
--     silla, ~93°; levantar un objeto del suelo, >=117°; buena función
--     general en las AVD se reporta en el rango 110-130°.
-- Revisar estos números contra la cita original (no solo el resumen web)
-- antes de defenderlos en el tribunal — están marcados como "a revisar"
-- en la columna `fuente` a propósito.
-- ============================================================================

create table if not exists public.rom_funcional_referencia (
  id_referencia    integer generated always as identity primary key,
  articulacion     text not null,
  actividad        text not null,
  grados_minimos   numeric(5,1) not null,
  fuente           text not null,
  orden            smallint not null default 0,
  unique (articulacion, actividad)
);

insert into public.rom_funcional_referencia
  (articulacion, actividad, grados_minimos, fuente, orden)
values
  ('cadera', 'Levantarse de una silla / usar el inodoro', 90.0,
   'ROM funcional de cadera en AVD (sit-to-stand, inodoro) — revisar cita original', 1),
  ('cadera', 'Subir o bajar de la cama o el auto', 100.0,
   'ROM funcional de cadera en AVD (transferencias cama/auto) — revisar cita original', 2),
  ('cadera', 'Atarse los zapatos sentado', 120.0,
   'ROM funcional de cadera, la AVD mas exigente del estudio (junto con ~27° de abduccion) — revisar cita original', 3),
  ('rodilla', 'Subir o bajar escaleras', 90.0,
   'ROM funcional de rodilla para escaleras — revisar cita original', 1),
  ('rodilla', 'Levantarse de una silla', 93.0,
   'ROM funcional de rodilla para ponerse de pie desde una silla — revisar cita original', 2),
  ('rodilla', 'Levantar un objeto del suelo', 117.0,
   'ROM funcional de rodilla para agacharse a levantar un objeto — revisar cita original', 3),
  ('rodilla', 'Funcion general buena en las actividades diarias', 110.0,
   'Umbral citado en rehabilitacion para funcion articular completa en AVD (rango reportado 110-130°) — revisar cita original', 4)
on conflict (articulacion, actividad) do update
  set grados_minimos = excluded.grados_minimos,
      fuente = excluded.fuente,
      orden = excluded.orden;

-- Es dato de referencia (no es de ningún paciente): lectura abierta a
-- cualquier cuenta autenticada del panel, igual que el catálogo de
-- ejercicios. Nadie más que el superusuario la edita (solo por SQL).
alter table public.rom_funcional_referencia enable row level security;
drop policy if exists p_lectura_autenticados on public.rom_funcional_referencia;
create policy p_lectura_autenticados on public.rom_funcional_referencia
  for select to authenticated using (true);
grant select on public.rom_funcional_referencia to authenticated;

-- ----------------------------------------------------------------------------
-- RESULTADO 3 — ¿LE ALCANZA EL ROM PARA SU VIDA DIARIA?
-- ----------------------------------------------------------------------------
-- Por cada evaluación con goniómetro, qué actividades ya alcanza y cuáles le
-- faltan, usando el mejor dato disponible ese día (cámara si la hay, si no
-- el goniómetro). Las vistas de abajo heredan la seguridad de
-- evaluaciones_goniometro/pacientes a través del join — Postgres no aplica
-- RLS directo sobre una vista, lo hace sobre las tablas que lee.
create or replace view public.vista_rom_funcional_paciente as
select
  e.id_evaluacion,
  e.id_paciente,
  p.nombre_completo,
  p.codigo_anonimo,
  e.articulacion,
  e.lado,
  e.momento,
  e.fecha,
  e.angulo_maximo                                    as rom_goniometro,
  e.angulo_app                                        as rom_camara,
  coalesce(e.angulo_app, e.angulo_maximo)             as rom_evaluado,
  (
    select string_agg(r.actividad, ' · ' order by r.orden)
    from public.rom_funcional_referencia r
    where r.articulacion = e.articulacion
      and r.grados_minimos <= coalesce(e.angulo_app, e.angulo_maximo)
  )                                                    as actividades_alcanzadas,
  (
    select string_agg(r.actividad, ' · ' order by r.orden)
    from public.rom_funcional_referencia r
    where r.articulacion = e.articulacion
      and r.grados_minimos > coalesce(e.angulo_app, e.angulo_maximo)
  )                                                    as actividades_pendientes,
  (
    select min(r.grados_minimos) - coalesce(e.angulo_app, e.angulo_maximo)
    from public.rom_funcional_referencia r
    where r.articulacion = e.articulacion
      and r.grados_minimos > coalesce(e.angulo_app, e.angulo_maximo)
  )                                                    as grados_para_siguiente_meta
from public.evaluaciones_goniometro e
join public.pacientes p on p.id_paciente = e.id_paciente;

grant select on public.vista_rom_funcional_paciente to authenticated;

-- Resumen por paciente+articulación: inicial vs final, igual que
-- vista_evaluacion_pre_post pero contestando "¿ganó una actividad de la
-- vida diaria con el tratamiento?", no solo "¿ganó grados?".
create or replace view public.vista_rom_funcional_ganancia as
select
  ini.id_paciente,
  ini.nombre_completo,
  ini.codigo_anonimo,
  ini.articulacion,
  ini.lado,
  ini.rom_evaluado                                    as rom_inicial,
  ini.actividades_alcanzadas                          as actividades_al_inicio,
  fin.rom_evaluado                                     as rom_final,
  fin.actividades_alcanzadas                           as actividades_al_final,
  (
    select count(*) from public.rom_funcional_referencia r
    where r.articulacion = ini.articulacion
      and r.grados_minimos > coalesce(ini.rom_evaluado, 0)
      and r.grados_minimos <= coalesce(fin.rom_evaluado, 0)
  )                                                    as actividades_recuperadas
from public.vista_rom_funcional_paciente ini
left join public.vista_rom_funcional_paciente fin
  on fin.id_paciente = ini.id_paciente
 and fin.articulacion = ini.articulacion
 and fin.lado = ini.lado
 and fin.momento = 'final'
where ini.momento = 'inicial';

grant select on public.vista_rom_funcional_ganancia to authenticated;
