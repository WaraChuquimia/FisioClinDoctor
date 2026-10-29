import React, { useEffect, useState } from 'react';
import * as api from '../lib/api';

const inicialesDe = (nombre) => {
  const limpio = (nombre || '').trim();
  if (!limpio) return '?';
  return limpio.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
};

// =============================================================================
// La cara de cualquier persona del sistema, dibujada en UN solo lugar.
// -----------------------------------------------------------------------------
// Antes cada pantalla armaba su propio círculo con iniciales a mano —
// `Header.jsx` nunca miraba si había foto, aunque la sesión YA la traía.
// Media hora de trabajo (la subida) llevaba dormida porque nadie la conectó.
//
// Dos formas de usarlo:
//   <Avatar url={sesion.user.avatar_url} .../>
//     El usuario que entró: el enlace YA se resolvió una sola vez al armar
//     la sesión (auth.js). Se usa tal cual, sin pedir nada de nuevo aunque
//     aparezca repetido (barra de arriba, menú, Mi Perfil).
//
//   <Avatar bucket="avatares" path={medico.avatarPath} .../>
//     La foto de OTRA persona (tarjetas de médicos, filas de usuarios,
//     selector de médico tratante): no hay un enlace ya resuelto para ella,
//     así que este componente lo pide él mismo, una vez, y lo cachea.
//
// Reglas del depósito: es privado, así que el enlace vence a la hora. Si la
// imagen falla al cargar (por eso, o por lo que sea), cae a las iniciales en
// vez de dejar un recuadro roto.
// =============================================================================
export default function Avatar({
  url, bucket = 'avatares', path, nombre, tamano = 40, className = '',
}) {
  const [urlResuelta, setUrlResuelta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    setFallo(false);
    if (url || !path) {
      setUrlResuelta(null);
      return undefined;
    }
    let vivo = true;
    setCargando(true);
    api.urlFirmada(bucket, path)
      .then((u) => { if (vivo) setUrlResuelta(u); })
      .catch(() => { if (vivo) setFallo(true); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [url, bucket, path]);

  const srcFinal = url || urlResuelta;
  const estilo = { width: tamano, height: tamano, fontSize: Math.max(10, Math.round(tamano * 0.4)) };

  if (srcFinal && !fallo) {
    return (
      <img
        src={srcFinal}
        alt={nombre ? `Foto de ${nombre}` : 'Foto de perfil'}
        style={estilo}
        onError={() => setFallo(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  if (cargando) {
    return <span style={estilo} className={`inline-block shrink-0 animate-pulse rounded-full bg-slate-200 ${className}`} />;
  }

  return (
    <span
      style={estilo}
      className={`grid shrink-0 place-items-center rounded-full bg-green-800 font-bold text-white ${className}`}
    >
      {inicialesDe(nombre)}
    </span>
  );
}
