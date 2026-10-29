// Enlaces de YouTube como alternativa a subir el archivo: igual que hace
// Google Drive, no se guarda el video — se guarda el enlace y YouTube hace
// de servidor de video. La miniatura tampoco hay que subirla: YouTube ya
// tiene una por cada video, en una dirección fija y predecible.

const PATRONES = [
  /(?:youtube\.com\/watch\?v=)([\w-]{6,})/,
  /(?:youtu\.be\/)([\w-]{6,})/,
  /(?:youtube\.com\/embed\/)([\w-]{6,})/,
  /(?:youtube\.com\/shorts\/)([\w-]{6,})/,
];

export function idDeYoutube(url) {
  const texto = String(url || '').trim();
  if (!texto) return null;
  for (const patron of PATRONES) {
    const m = texto.match(patron);
    if (m) return m[1];
  }
  return null;
}

export function esEnlaceYoutube(url) {
  return Boolean(idDeYoutube(url));
}

// `hqdefault.jpg` existe SIEMPRE para cualquier video público; `maxresdefault`
// se ve mejor pero no todos los videos lo tienen (y no hay forma de saberlo
// sin pedirlo primero), así que se usa la que nunca falla.
export function miniaturaYoutube(url) {
  const id = idDeYoutube(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function embedYoutube(url) {
  const id = idDeYoutube(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
