// =============================================================================
// gestionar-usuario — crear, cambiar contraseña/correo, y activar/desactivar
// la cuenta de ACCESO (Supabase Auth) de un profesional.
// -----------------------------------------------------------------------------
// Por qué esto vive acá y no en el panel:
//
// Ponerle una contraseña a OTRA persona (o crear su cuenta directamente,
// sin pasar por el correo) exige la llave `service_role`. Esa llave salta
// TODA la seguridad del sistema — RLS incluido — así que jamás puede viajar
// al navegador: cualquiera que abriera las herramientas de desarrollador la
// vería y se saltaría todas las reglas. Por eso este código corre en el
// servidor de Supabase (una Edge Function), no en la computadora del médico.
// La llave `service_role` ya está disponible acá como variable de entorno;
// no hay que configurarla ni pegarla en ningún lado.
//
// El control de quién puede llamar a esto (más abajo, antes de tocar
// cualquier dato) es la parte más delicada de todo el sistema: sin él,
// cualquiera que descubra la dirección de esta función podría crearse un
// administrador.
// =============================================================================

// @ts-nocheck
// Este archivo corre en Deno (Supabase Edge Functions), no en Node: usa
// imports por URL y el global `Deno`. El editor revisa todo con el motor de
// TypeScript para Node por defecto, así que sin esto marca error en código
// que en producción funciona bien. Con la extensión "Deno" instalada y
// habilitada (ver .vscode/settings.json) esto deja de hacer falta.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MIN_PASSWORD = 8;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// -----------------------------------------------------------------------------
// accion: crear
// -----------------------------------------------------------------------------
// Si el correo YA tiene ficha en `usuarios` (el caso normal: se llama después
// de que el panel ya creó al profesional, o desde el botón "Crear cuenta" de
// alguien que nunca tuvo acceso), solo se le agrega la cuenta de Auth. Si NO
// tiene ficha, se crea de una — por eso acepta también tipo_profesional,
// cedula, telefono y especialidad.
//
// El orden importa: la ficha en `usuarios` se crea/confirma ANTES que la
// cuenta de Auth, porque el trigger `trg_auth_usuario_nuevo` (que corre
// cuando se crea el usuario de Auth) solo sabe ENLAZAR una ficha que ya
// existe con ese correo — no la crea él. Si no hubiera ficha todavía, el
// trigger abriría una solicitud pendiente en vez de dejarlo entrar directo.
// -----------------------------------------------------------------------------
async function accionCrear(admin: ReturnType<typeof createClient>, body: Record<string, unknown>, registrar: (accion: string, detalle: string) => Promise<void>) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const nombreCompleto = String(body.nombre_completo || '').trim();

  if (!email || !email.includes('@')) return json({ error: 'El correo no es válido.' }, 400);
  if (password.length < MIN_PASSWORD) {
    return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
  }

  const { data: existente, error: errBuscar } = await admin
    .from('usuarios')
    .select('id_usuario, auth_user_id, email')
    .ilike('email', email)
    .maybeSingle();
  if (errBuscar) return json({ error: `No se pudo verificar el correo: ${errBuscar.message}` }, 400);

  if (existente?.auth_user_id) {
    return json({ error: 'Este correo ya tiene una cuenta de acceso.' }, 409);
  }

  let idUsuario = existente?.id_usuario ?? null;
  const fichaYaExistia = Boolean(existente);

  if (!idUsuario) {
    if (!nombreCompleto || !body.tipo_profesional) {
      return json({ error: 'Faltan datos para crear la ficha: nombre completo y tipo de profesional.' }, 400);
    }

    const nombreUsuario = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9._]/g, '')
      || `prof${Date.now()}`;

    const { data: nuevoUsuario, error: errUsuario } = await admin
      .from('usuarios')
      .insert({
        nombre_usuario: nombreUsuario,
        email,
        rol: body.tipo_profesional,
        activo: true,
        debe_cambiar_password: true,
        modulos_permitidos: {},
      })
      .select('id_usuario')
      .single();
    if (errUsuario) return json({ error: `No se pudo crear el usuario: ${errUsuario.message}` }, 400);
    idUsuario = nuevoUsuario.id_usuario as number;

    // El superusuario no atiende pacientes: no lleva ficha en `medicos`
    // (esa tabla solo admite tipo_profesional medico_fisiatra/fisioterapeuta).
    if (body.tipo_profesional !== 'superusuario') {
      const { error: errMedico } = await admin.from('medicos').insert({
        id_usuario: idUsuario,
        nombre_completo: nombreCompleto,
        tipo_profesional: body.tipo_profesional,
        especialidad: body.especialidad || 'Medicina Física y Rehabilitación',
        cedula_profesional: body.cedula || `SIN-CEDULA-${idUsuario}`,
        telefono: body.telefono || null,
      });
      if (errMedico) {
        return json({ error: `Se creó el usuario pero no la ficha profesional: ${errMedico.message}` }, 400);
      }
    }
  }

  // Recién ahora la parte que necesitaba la llave maestra.
  const { error: errAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin esto queda esperando un correo de confirmación
    user_metadata: { full_name: nombreCompleto || undefined },
  });

  if (errAuth) {
    // La ficha ya quedó creada (o ya existía): no se pierde por esto. Se
    // puede reintentar con el botón "Crear cuenta".
    await registrar('insert', `No se pudo crear la cuenta de acceso de ${email}: ${errAuth.message}`);
    return json({ error: errAuth.message, ficha_creada: !fichaYaExistia, id_usuario: idUsuario }, 400);
  }

  await registrar('insert', `Creó la cuenta de acceso de ${email}`);
  return json({ ok: true, id_usuario: idUsuario, email });
}

// -----------------------------------------------------------------------------
// accion: cambiar_password — para cuando alguien la olvida y no le llega el
// correo de recuperación (o directamente no tiene correo real).
// -----------------------------------------------------------------------------
async function accionCambiarPassword(admin: ReturnType<typeof createClient>, body: Record<string, unknown>, registrar: (accion: string, detalle: string) => Promise<void>) {
  const idUsuario = Number(body.id_usuario);
  const nueva = String(body.nueva || '');
  if (!idUsuario) return json({ error: 'Falta indicar el usuario.' }, 400);
  if (nueva.length < MIN_PASSWORD) {
    return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
  }

  const { data: fila, error: errBuscar } = await admin
    .from('usuarios').select('auth_user_id, email').eq('id_usuario', idUsuario).maybeSingle();
  if (errBuscar) return json({ error: errBuscar.message }, 400);
  if (!fila) return json({ error: 'Ese usuario no existe.' }, 404);
  if (!fila.auth_user_id) {
    return json({ error: 'Todavía no tiene cuenta de acceso — creala primero con "Crear cuenta".' }, 400);
  }

  const { error: errAuth } = await admin.auth.admin.updateUserById(fila.auth_user_id, { password: nueva });
  if (errAuth) return json({ error: errAuth.message }, 400);

  // Que la próxima vez que entre confirme que la contraseña es suya — la
  // puso el administrador, no ella.
  await admin.from('usuarios').update({ debe_cambiar_password: true }).eq('id_usuario', idUsuario);

  await registrar('update', `Cambió la contraseña de ${fila.email}`);
  return json({ ok: true });
}

// -----------------------------------------------------------------------------
// accion: cambiar_email — cambia el correo de acceso Y el de la ficha juntos;
// si quedaran distintos, el login por nombre de usuario dejaría de encontrarla.
// -----------------------------------------------------------------------------
async function accionCambiarEmail(admin: ReturnType<typeof createClient>, body: Record<string, unknown>, registrar: (accion: string, detalle: string) => Promise<void>) {
  const idUsuario = Number(body.id_usuario);
  const nuevoEmail = String(body.nuevo_email || '').trim().toLowerCase();
  if (!idUsuario) return json({ error: 'Falta indicar el usuario.' }, 400);
  if (!nuevoEmail || !nuevoEmail.includes('@')) return json({ error: 'El correo no es válido.' }, 400);

  const { data: fila, error: errBuscar } = await admin
    .from('usuarios').select('auth_user_id, email').eq('id_usuario', idUsuario).maybeSingle();
  if (errBuscar) return json({ error: errBuscar.message }, 400);
  if (!fila) return json({ error: 'Ese usuario no existe.' }, 404);
  if (!fila.auth_user_id) return json({ error: 'Todavía no tiene cuenta de acceso.' }, 400);

  const { error: errAuth } = await admin.auth.admin.updateUserById(fila.auth_user_id, {
    email: nuevoEmail,
    email_confirm: true,
  });
  if (errAuth) return json({ error: errAuth.message }, 400);

  const { error: errTabla } = await admin.from('usuarios').update({ email: nuevoEmail }).eq('id_usuario', idUsuario);
  if (errTabla) {
    return json({ error: `El correo se cambió en el acceso, pero no en la ficha: ${errTabla.message}` }, 400);
  }

  await registrar('update', `Cambió el correo de ${fila.email} a ${nuevoEmail}`);
  return json({ ok: true });
}

// -----------------------------------------------------------------------------
// accion: desactivar / reactivar — bloquea o habilita la cuenta de Auth (si
// ya tiene una) y siempre sincroniza `usuarios.activo`, que es lo que de
// verdad usan las políticas RLS para cortar el acceso a los datos.
// -----------------------------------------------------------------------------
async function accionEstado(admin: ReturnType<typeof createClient>, accion: string, body: Record<string, unknown>, registrar: (accion: string, detalle: string) => Promise<void>) {
  const idUsuario = Number(body.id_usuario);
  if (!idUsuario) return json({ error: 'Falta indicar el usuario.' }, 400);
  const activar = accion === 'reactivar';

  const { data: fila, error: errBuscar } = await admin
    .from('usuarios').select('auth_user_id, email').eq('id_usuario', idUsuario).maybeSingle();
  if (errBuscar) return json({ error: errBuscar.message }, 400);
  if (!fila) return json({ error: 'Ese usuario no existe.' }, 404);

  if (fila.auth_user_id) {
    // 'none' saca cualquier bloqueo; ~100 años equivale a bloquearlo
    // indefinidamente sin borrar la cuenta ni sus datos.
    const { error: errAuth } = await admin.auth.admin.updateUserById(fila.auth_user_id, {
      ban_duration: activar ? 'none' : '876000h',
    });
    if (errAuth) return json({ error: errAuth.message }, 400);
  }

  const { error: errTabla } = await admin.from('usuarios').update({ activo: activar }).eq('id_usuario', idUsuario);
  if (errTabla) return json({ error: errTabla.message }, 400);

  await registrar('update', `${activar ? 'Reactivó' : 'Desactivó'} a ${fila.email}`);
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no admitido.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---------------------------------------------------------------------------
  // EL CONTROL QUE DE VERDAD IMPORTA — va antes que cualquier otra cosa.
  // 1) Leer el token de quien llama. 2) Averiguar quién es. 3) Confirmar que
  // es superusuario. Si cualquiera de los tres pasos falla, no se sigue.
  // ---------------------------------------------------------------------------
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Falta el token de autorización.' }, 401);

  const { data: authData, error: errAuthUser } = await admin.auth.getUser(token);
  if (errAuthUser || !authData?.user) {
    return json({ error: 'Token inválido o vencido.' }, 401);
  }

  const { data: llamador, error: errLlamador } = await admin
    .from('usuarios')
    .select('id_usuario, rol, activo')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (errLlamador || !llamador) {
    return json({ error: 'No se pudo verificar quién sos.' }, 403);
  }
  if (llamador.rol !== 'superusuario' || !llamador.activo) {
    return json({ error: 'Solo el superusuario puede gestionar cuentas de acceso.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'El cuerpo del pedido no es JSON válido.' }, 400);
  }

  const registrar = async (accionBitacora: string, detalle: string) => {
    await admin.from('bitacora_auditoria').insert({
      id_usuario: llamador.id_usuario,
      rol: llamador.rol,
      accion: accionBitacora,
      tabla: 'usuarios',
      detalle,
    });
  };

  const accion = String(body.accion || '');

  try {
    if (accion === 'crear') return await accionCrear(admin, body, registrar);
    if (accion === 'cambiar_password') return await accionCambiarPassword(admin, body, registrar);
    if (accion === 'cambiar_email') return await accionCambiarEmail(admin, body, registrar);
    if (accion === 'desactivar' || accion === 'reactivar') return await accionEstado(admin, accion, body, registrar);
    return json({ error: `Acción desconocida: "${accion}".` }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
  }
});
