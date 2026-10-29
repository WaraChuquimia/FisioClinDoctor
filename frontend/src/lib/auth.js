// =============================================================================
// Autenticación con Supabase + Soporte de 2FA (Código OTP de 6 dígitos)
// =============================================================================
import { exigirConexion, setRecordarme } from './supabase';
import { urlFirmada } from './api';

const ERRORES = {
  'Invalid login credentials': 'Usuario o contraseña incorrectos.',
  'Email not confirmed': 'Tu correo todavía no está confirmado.',
};

const traducir = (err) => new Error(ERRORES[err?.message] || err?.message || 'No se pudo iniciar sesión.');

// -----------------------------------------------------------------------------
// Construcción de la sesión a partir de vista_sesion_actual
// -----------------------------------------------------------------------------
async function construirSesion() {
  const sb = exigirConexion();

  const { data, error } = await sb.from('vista_sesion_actual').select('*').maybeSingle();
  if (error) throw traducir(error);

  if (!data) {
    const { data: estado } = await sb.rpc('fn_estado_solicitud');
    const { data: authData } = await sb.auth.getUser();
    const authUser = authData?.user;
    return {
      pendiente: true,
      solicitud: estado || { estado: 'sin_solicitud' },
      cuenta: {
        email: authUser?.email || null,
        nombre: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || null,
      },
    };
  }

  await sb.rpc('fn_registrar_login');

  let avatarUrl = null;
  if (data.avatar_path) {
    try {
      avatarUrl = await urlFirmada(data.avatar_bucket || 'avatares', data.avatar_path);
    } catch {
      // Se muestran las iniciales si el bucket o enlace falla
    }
  }

  return {
    user: {
      id_usuario: data.id_usuario,
      auth_user_id: data.auth_user_id,
      nombre_usuario: data.nombre_usuario,
      email: data.email,
      nombre_rol: data.nombre_rol,
      activo: data.activo,
      debe_cambiar_password: data.debe_cambiar_password,
      nombre_completo: data.nombre_completo,
      avatar_bucket: data.avatar_bucket,
      avatar_path: data.avatar_path,
      avatar_url: avatarUrl,
    },
    medico: data.id_medico
      ? {
          id_medico: data.id_medico,
          nombre_completo: data.nombre_completo,
          tipo_profesional: data.tipo_profesional,
          especialidad: data.especialidad,
          unidad: data.unidad,
          consultorio: data.consultorio,
          horario_atencion: data.horario_atencion,
        }
      : null,
    paciente: null,
    permissions: data.permissions || {},
    preferencias: data.preferencias || {},
  };
}

// -----------------------------------------------------------------------------
// Paso 1: Solicitar Código OTP (Genera el token de 6 dígitos)
// -----------------------------------------------------------------------------
// =============================================================================
// Paso 1: Generar OTP en PostgreSQL y enviarlo por TU backend (sin límites de Supabase)
// =============================================================================
export async function requestOtp(identificador, password = null, recordarme = true) {
  const sb = exigirConexion();
  const texto = String(identificador || '').trim();
  const agente = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  setRecordarme(recordarme);

  // 1. Revisar bloqueo por fuerza bruta
  const { data: bloqueo } = await sb.rpc('fn_esta_bloqueado', { p_identificador: texto });
  if (bloqueo?.bloqueado) {
    throw new Error(`Demasiados intentos fallidos. Vuelve a intentar en ${bloqueo.minutos_restantes} minutos.`);
  }

  // 2. Si colocó usuario (ej. dr.martin), obtener su email de la tabla usuarios
  let email = texto;
  if (!texto.includes('@')) {
    const { data: emailRes, error: errEmail } = await sb.rpc('fn_email_de_usuario', { p_identificador: texto });
    if (errEmail) throw traducir(errEmail);
    if (!emailRes) throw new Error('Usuario o contraseña incorrectos.');
    email = emailRes;
  }

  // 3. Validar la contraseña contra Supabase si el formulario la incluyó
  if (password) {
    const { error: errPass } = await sb.auth.signInWithPassword({ email, password });
    if (errPass) {
      await sb.rpc('fn_registrar_intento', {
        p_identificador: texto,
        p_exito: false,
        p_motivo: errPass.message,
        p_user_agent: agente,
      });
      throw traducir(errPass);
    }
  }

  // 4. Generar el código en tu base de datos (PostgreSQL) usando tu función RPC
  const { data: rpcData, error: errRpc } = await sb.rpc('fn_solicitar_otp', {
    p_identificador: texto,
    p_user_agent: agente,
  });

  if (errRpc) throw traducir(errRpc);

  // 5. ENVIAR EL CORREO A TRAVÉS DE TU SERVIDOR LOCAL (GMAIL NODEMAILER)
  // ¡Aquí NO se llama a sb.auth.signInWithOtp! Eso es lo que te causaba el límite.
  const otpUrl = import.meta.env.VITE_OTP_URL || 'http://localhost:3001/api/enviar-otp';
  try {
    const resp = await fetch(otpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Otp-Secret': import.meta.env.VITE_OTP_SHARED_SECRET || '',
      },
      body: JSON.stringify({
        email: rpcData.email,
        codigo: rpcData.codigo_otp,
        nombre: rpcData.nombre_usuario,
      }),
    });

    if (!resp.ok) {
      const errorJson = await resp.json().catch(() => ({}));
      throw new Error(errorJson.detalle || 'Error al conectar con el servidor de correos local.');
    }
  } catch (errBackend) {
    console.error('Error enviando correo por backend local:', errBackend);
    throw new Error('No se pudo enviar el correo de verificación. Verifica que el servidor (node server.js en puerto 3001) esté encendido.');
  }

  return { email: rpcData.email };
}

// -----------------------------------------------------------------------------
// Paso 2: Verificar Código OTP de 6 dígitos
// -----------------------------------------------------------------------------
export async function verifyOtp(emailOIdentificador, token, recordarme = true) {
  const sb = exigirConexion();
  const agente = typeof navigator !== 'undefined' ? navigator.userAgent : null;
  setRecordarme(recordarme);

  let email = String(emailOIdentificador || '').trim();
  if (!email.includes('@')) {
    const { data } = await sb.rpc('fn_email_de_usuario', { p_identificador: email });
    if (data) email = data;
  }

  // 1. Validar el código de 6 dígitos en PostgreSQL
  const { error: errRpcValidar } = await sb.rpc('fn_validar_otp', {
    p_identificador: email,
    p_codigo: String(token || '').trim(),
    p_user_agent: agente,
  });

  if (errRpcValidar) {
    throw new Error(errRpcValidar.message || 'Código incorrecto o expirado.');
  }

  // 2. Levantar la sesión clínica
  return construirSesion();
}

// -----------------------------------------------------------------------------
// Login tradicional (Usuario + Contraseña)
// -----------------------------------------------------------------------------
export async function signIn(identificador, password, recordarme = true) {
  const sb = exigirConexion();
  const texto = String(identificador || '').trim();
  const agente = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  setRecordarme(recordarme);

  const { data: bloqueo } = await sb.rpc('fn_esta_bloqueado', { p_identificador: texto });
  if (bloqueo?.bloqueado) {
    throw new Error(`Demasiados intentos fallidos. Vuelve a intentar en ${bloqueo.minutos_restantes} minutos.`);
  }

  let email = texto;
  if (!texto.includes('@')) {
    const { data, error } = await sb.rpc('fn_email_de_usuario', { p_identificador: texto });
    if (error) throw traducir(error);
    if (!data) throw new Error('Usuario o contraseña incorrectos.');
    email = data;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });

  await sb.rpc('fn_registrar_intento', {
    p_identificador: texto,
    p_exito: !error,
    p_motivo: error ? error.message : null,
    p_user_agent: agente,
  });

  if (error) throw traducir(error);
  return construirSesion();
}

// -----------------------------------------------------------------------------
// Ingreso / registro con Google
// -----------------------------------------------------------------------------
export async function signInWithGoogle() {
  const sb = exigirConexion();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw traducir(error);
  return null;
}

export async function restoreSession() {
  const sb = exigirConexion();
  const { data } = await sb.auth.getSession();
  if (!data?.session) return null;
  return construirSesion();
}

export async function refreshSession() {
  return construirSesion();
}

export async function solicitarAcceso({ nombre, email, tipo, cedula, telefono }) {
  const sb = exigirConexion();
  const { data, error } = await sb.rpc('fn_solicitar_acceso', {
    p_nombre: nombre,
    p_email: email,
    p_tipo: tipo,
    p_cedula: cedula,
    p_telefono: telefono || null,
  });
  if (error) throw traducir(error);
  return data;
}

export async function cambiarPassword(nueva) {
  const sb = exigirConexion();
  const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) throw traducir(error);

  const { error: e2 } = await sb.rpc('fn_password_cambiada');
  if (e2) throw traducir(e2);
  return true;
}

export async function cambiarPasswordDesdePerfil(email, actual, nueva) {
  const sb = exigirConexion();
  const { error: errActual } = await sb.auth.signInWithPassword({ email, password: actual });
  if (errActual) throw new Error('La contraseña actual no es correcta.');
  return cambiarPassword(nueva);
}

export async function recuperarPassword(identificador) {
  const sb = exigirConexion();
  const texto = String(identificador || '').trim();
  const generico = 'Si la cuenta existe, te enviamos el enlace a tu correo. Revisa tu bandeja y la carpeta de spam.';

  let email = texto;
  if (!texto.includes('@')) {
    const { data } = await sb.rpc('fn_email_de_usuario', { p_identificador: texto });
    if (!data) return generico;
    email = data;
  }

  const { data: res, error } = await sb.rpc('fn_solicitar_recuperacion', {
    p_email: email,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });
  if (error) throw traducir(error);

  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#recuperar`,
  });

  return res?.mensaje || generico;
}

export function esRetornoDeRecuperacion() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  return hash.includes('type=recovery') || hash.includes('recuperar');
}

export async function forzarCambioPassword(idUsuario, motivo) {
  const sb = exigirConexion();
  const { data, error } = await sb.rpc('fn_forzar_cambio_password', {
    p_id_usuario: idUsuario,
    p_motivo: motivo || null,
  });
  if (error) throw traducir(error);

  if (data?.email) {
    await sb.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/#recuperar`,
    });
  }
  return data;
}

export async function signOut() {
  const sb = exigirConexion();
  await sb.auth.signOut();
  return true;
}