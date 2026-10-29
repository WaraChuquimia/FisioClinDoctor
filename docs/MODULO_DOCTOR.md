# Módulo del médico y del superusuario

Qué hace cada parte del panel. Todo funciona en **modo demo**, con datos de
muestra en memoria (`src/lib/mockDb.js`); no hay base de datos ni backend.

---

## 1. Roles

| Rol | Qué ve |
|---|---|
| Superusuario | Centro de control, gestión de usuarios y permisos, médicos, solicitudes de acceso, auditoría, y todos los módulos clínicos. |
| Médico fisiatra | Sus pacientes, prescripción de rutinas, catálogo de ejercicios, agenda de controles, sesiones, evolución clínica, mensajes y su perfil. |
| Fisioterapeuta | Igual que el médico pero sin prescripción de rutinas, catálogo ni evolución. |

El paciente **no** tiene acceso a este panel: es una herramienta clínica interna.

El login está en `src/lib/auth.js` (ver `README.md` para las cuentas de prueba).
Los permisos por módulo se definen en `permisosMedicoBase` (auth.js) y en
`mockDb.usuarios[].modulos_permitidos`.

---

## 2. Módulos (barra lateral)

La lista vive en `MODULOS` de `src/lib/mappers.js` y sus claves coinciden con
`modulos_permitidos`:

`inicio, pacientes, ejercicios, rutinas, sesiones, evolucion, citas,
notificaciones, reportes, perfil, solicitudes, usuarios, medicos, auditoria,
configuracion`.

El chequeo del navegador oculta los botones de un módulo no permitido; en
`App.jsx` (`onViewChange`) también se bloquea el cambio de vista.

---

## 3. Componentes principales

| Archivo | Qué hace |
|---|---|
| `DashboardInicio.jsx` | Resumen del médico: pacientes, próximas citas, avisos. |
| `ModuloPacientes.jsx` | Lista y ficha del paciente (resumen, historial, rutina, sesiones). |
| `PrescripcionRutinas.jsx` | Arma el plan y las prescripciones de ejercicios. |
| `CatalogoEjercicios.jsx` | Alta y edición de ejercicios. |
| `AgendaCitas.jsx` | Programar, reprogramar, marcar asistencia, cancelar. |
| `HistorialSesiones.jsx` | Sesiones con repeticiones correctas, ángulo, ROM y dolor. |
| `GraficosEvolucion.jsx` | Dolor y ROM por semana. |
| `MensajesPacientes.jsx` | Escribir a uno o varios pacientes + bandeja de avisos. |
| `PerfilMedico.jsx` | Editar perfil, foto (preview local), preferencias. |
| `GestionUsuarios.jsx` | Matriz de permisos, activar/desactivar cuentas, alta de profesionales, auditoría. |
| `SuperadminViews.jsx` | Centro de control del superusuario. |
| `ModuloAccesos.jsx` | Solicitudes de acceso. |

---

## 4. Capa de datos

`src/lib/api.js` expone las funciones que consumen los componentes
(`cargarPacientes`, `guardarRutina`, `programarCita`, `enviarMensajePaciente`,
…). Cada una lee o muta los arreglos de
`src/lib/mockDb.js` con un pequeño retraso simulado. Las firmas están pensadas
para poder cambiar esta capa por una conectada sin tocar los componentes.
