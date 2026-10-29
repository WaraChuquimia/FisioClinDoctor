// Topes de tamaño compartidos por api.js y los componentes que suben video.
// Antes el mismo número (50 MB) vivía copiado en dos archivos y se
// desincronizaba entre sí: acá hay un solo lugar para cambiarlo.
export const MAX_VIDEO_MB = 100;

// A partir de acá se avisa que el video va a tardar en subir y en abrirse
// (no bloquea, solo pone en contexto antes de que el usuario se quede
// mirando la barra de progreso).
export const AVISO_VIDEO_GRANDE_MB = 50;
