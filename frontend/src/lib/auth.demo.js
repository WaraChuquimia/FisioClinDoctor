// =============================================================================
// Autenticación FALSA — sin Supabase, sin red.
// -----------------------------------------------------------------------------
// Cualquier usuario/contraseña entra. El ROL se decide por lo que escribas en
// el campo de usuario:
//
//   · contiene "super" o "admin"  -> Superusuario (ve todo, los 6 pacientes)
//   · contiene "rojas"            -> Dra. Daniela Rojas
//   · contiene "carlos" / "fisio" -> Lic. Carlos Mamani (fisioterapeuta)
//   · cualquier otra cosa         -> Dr. Alejandro Martin (por defecto)
//
// El paciente no tiene acceso a este panel: es una herramienta clínica.
// La sesión no se persiste: al recargar la página vuelve a pedir login.
// =============================================================================
import { MODULOS } from './mappers';
import { medicos, preferencias } from './mockDb';

const permisosMedicoBase = {
  inicio: true, pacientes: true, ejercicios: true, rutinas: true, sesiones: true,
  evolucion: true, citas: true, notificaciones: true, reportes: true, perfil: true,
  solicitudes: false, usuarios: false, medicos: false, auditoria: false, configuracion: true,
};

const permisos = (esSuper, base = permisosMedicoBase) =>
  Object.fromEntries(MODULOS.map((m) => [m, esSuper ? true : base[m] === true]));

function sesionSuperusuario() {
  return {
    user: {
      id_usuario: 1, auth_user_id: 'demo-super', nombre_usuario: 'superadmin',
      email: 'superadmin@fisioclin.demo', nombre_rol: 'superusuario', activo: true,
      debe_cambiar_password: false, avatar_path: null, avatar_bucket: null,
    },
    medico: null,
    paciente: null,
    permissions: permisos(true),
    preferencias: { ...preferencias },
  };
}

function sesionMedico(idMedico = 2) {
  const m = medicos.find((x) => x.id_medico === idMedico) || medicos[0];
  return {
    user: {
      id_usuario: m.id_usuario, auth_user_id: `demo-medico-${m.id_medico}`,
      nombre_usuario: m.nombre_completo.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, ''),
      email: `${m.id_medico === 3 ? 'dra.rojas' : 'dr.martin'}@fisioclin.demo`,
      nombre_rol: m.tipo_profesional === 'fisioterapeuta' ? 'fisioterapeuta' : 'medico_fisiatra',
      activo: true, debe_cambiar_password: false, avatar_path: null, avatar_bucket: null,
    },
    medico: {
      id_medico: m.id_medico, nombre_completo: m.nombre_completo,
      tipo_profesional: m.tipo_profesional, especialidad: m.especialidad, unidad: m.unidad,
    },
    paciente: null,
    permissions: permisos(false),
    preferencias: { ...preferencias },
  };
}

function construirSesion(identificador = '') {
  const id = String(identificador).toLowerCase();
  if (id.includes('super') || id.includes('admin')) return sesionSuperusuario();
  if (id.includes('rojas') || id.includes('daniela')) return sesionMedico(3);
  if (id.includes('carlos') || id.includes('fisio')) return sesionMedico(4);
  return sesionMedico(2);
}

// -----------------------------------------------------------------------------
export async function signIn(identifier /* , password */) {
  return construirSesion(identifier);
}

export async function signInWithGoogle() {
  // Sin OAuth: devolvemos directamente la sesión por defecto (Dr. Martin).
  return construirSesion('');
}

// No hay sesión persistida: siempre arranca en la pantalla de login.
export async function restoreSession() {
  return null;
}

export async function refreshSession() {
  return null;
}

export async function cambiarPassword() {
  return true;
}

export async function cambiarPasswordDesdePerfil() {
  return true;
}

export async function signOut() {
  return true;
}
