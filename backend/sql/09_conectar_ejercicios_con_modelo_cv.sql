-- ============================================================================
--  FisioClin — Conectar el catálogo clínico con el modelo de visión (cámara)
-- ----------------------------------------------------------------------------
--  SÍNTOMA
--    Las 3 prescripciones activas que ya tenían médicos reales (pacientes
--    4, 19, 23) aparecían en la app del paciente con la tarjeta
--    "Aún sin sesión con cámara" — deshabilitada, sin poder medir nada.
--
--  CAUSA
--    `ejercicios_catalogo.clase_lstm` (el código 'C01'..'R10' que conecta
--    un ejercicio del catálogo clínico con `ml/configuracion_ejercicios.json`
--    en la app FisioClin) estaba en NULL para los 3 ejercicios que existen.
--    Sin ese código, `obtener_catalogo_ejercicios()` devuelve `codigo_cv: null`
--    y la pantalla "Rehabilitar" del paciente no deja iniciar la cámara — es
--    justamente el resguardo para no medir un ejercicio sin calibración.
--
--  SOLUCIÓN
--    Se conectó cada ejercicio del catálogo clínico con su correspondiente
--    en el modelo (los 3 SÍ tienen calibración lista — `umbrales: true` en
--    ml/configuracion_ejercicios.json):
--
--      id_ejercicio 1  APERTURA DE CADERA EN CUADRUPEDIA  -> C10 (apertura_lateral_en_cuadrupedia)
--      id_ejercicio 2  ELEVACION DE RODILLA HACIA EL PECHO -> R06 (flexion_de_rodilla_al_pecho)
--      id_ejercicio 3  EL BICHO MUERTO                     -> C08 (dead_bug)
--
--  IMPORTANTE PARA EL FUTURO
--    Cada vez que se cree un ejercicio NUEVO en el catálogo clínico
--    (Catálogo de Ejercicios del panel), si se quiere que el paciente lo
--    pueda medir con la cámara, hay que ponerle su `clase_lstm` acá. La
--    lista completa de códigos disponibles y si ya están calibrados
--    ('umbrales') está en `C:\Users\WARA\FisioClin\ml\configuracion_ejercicios.json`.
--    Los códigos C09, R03 y R10 (extension_de_cadera_en_cuadrupedia,
--    abduccion_de_cadera_en_decubito, equilibrio_monopodal) TODAVÍA no
--    tienen calibración — no asignarlos hasta que se midan.
-- ============================================================================

update public.ejercicios_catalogo set clase_lstm = 'C10' where id_ejercicio = 1;
update public.ejercicios_catalogo set clase_lstm = 'R06' where id_ejercicio = 2;
update public.ejercicios_catalogo set clase_lstm = 'C08' where id_ejercicio = 3;

select id_ejercicio, nombre, clase_lstm from public.ejercicios_catalogo order by id_ejercicio;
