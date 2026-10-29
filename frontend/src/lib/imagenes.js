// Helpers de imagen compartidos entre "Mi perfil" (PerfilMedico.jsx) y la
// edición de perfil de otros profesionales desde el panel de administración
// (GestionUsuarios.jsx) — antes vivía duplicado en el primero.

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Recorta al cuadrado central y reduce a un tamaño razonable para un avatar
// (600px de lado alcanza de sobra). Sin esto, una foto vertical de celular
// sale deformada en todos los círculos donde se use.
// HEIC no siempre se puede dibujar en un <canvas> (el navegador no lo
// decodifica) — en ese caso se avisa y se sube la foto tal cual, sin recorte.
export function recortarACuadrado(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new window.Image();
    img.onload = () => {
      const lado = Math.min(img.width, img.height);
      const sx = (img.width - lado) / 2;
      const sy = (img.height - lado) / 2;
      const destino = Math.min(lado, 600);
      const canvas = document.createElement('canvas');
      canvas.width = destino;
      canvas.height = destino;
      canvas.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, destino, destino);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error('No se pudo procesar la imagen.'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}
