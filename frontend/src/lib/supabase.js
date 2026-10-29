// =============================================================================
// Conexión a Supabase.
// -----------------------------------------------------------------------------
// Necesita un archivo `.env` en la raíz del proyecto (junto a package.json) con:
//
//   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// Los dos valores salen de: Supabase -> Project Settings -> API.
// La "anon key" es pública, no pasa nada si se ve en el navegador: quien manda
// de verdad son las políticas RLS de la base (bloque 13 de 01_estructura.sql).
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
export const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hayConexion = Boolean(url && anonKey);

// -----------------------------------------------------------------------------
// Casilla "Recuérdame" del login.
// -----------------------------------------------------------------------------
// `persistSession: true` por sí solo deja al navegador con la sesión guardada
// para siempre (localStorage), sin importar lo que el checkbox diga: por eso
// alguien podía destildar "Recuérdame" y aun así el panel seguía abriendo
// directo al reabrir la pestaña. Esta marca decide, ANTES de cada login, en
// qué almacenamiento escribe el SDK de Supabase:
//   - "Recuérdame" tildado  -> localStorage  (sobrevive a cerrar el navegador)
//   - destildado            -> sessionStorage (se pierde al cerrar la pestaña
//                               o al abrir el enlace en una pestaña nueva)
// La marca en sí vive en localStorage porque el adaptador necesita leerla
// ANTES de saber dónde está guardada la sesión.
const RECORDARME_KEY = 'fisioclin_recordarme';

export function setRecordarme(recordar) {
  try {
    localStorage.setItem(RECORDARME_KEY, recordar ? '1' : '0');
  } catch {
    // Almacenamiento no disponible (modo privado estricto): no es crítico,
    // Supabase simplemente usará localStorage por defecto.
  }
}

function almacenActivo() {
  try {
    return localStorage.getItem(RECORDARME_KEY) === '0' ? sessionStorage : localStorage;
  } catch {
    return localStorage;
  }
}

const almacenamientoSesion = {
  getItem: (clave) => almacenActivo().getItem(clave),
  setItem: (clave, valor) => almacenActivo().setItem(clave, valor),
  removeItem: (clave) => {
    try { localStorage.removeItem(clave); } catch { /* noop */ }
    try { sessionStorage.removeItem(clave); } catch { /* noop */ }
  },
};

export const supabase = hayConexion
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storage: almacenamientoSesion,
        autoRefreshToken: true,
        detectSessionInUrl: true,  // necesario para el retorno de Google
      },
    })
  : null;

export function exigirConexion() {
  if (!supabase) {
    throw new Error(
      'Falta configurar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
