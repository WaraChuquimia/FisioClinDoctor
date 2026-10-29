// Membrete de marca para los PDF generados con jsPDF — compartido entre
// Reportes.jsx y la Auditoría de GestionUsuarios.jsx. Vive en `lib/` (no en
// un componente) para que ninguno de los dos dependa del otro con un import
// cruzado, y para que Fast Refresh no se queje de un archivo que exporta
// funciones sueltas junto a un componente de React.
export const hoyISO = () => new Date().toISOString().slice(0, 10);

// Colores de marca en RGB (jsPDF no entiende hex con setFillColor), tomados
// de theme.js: greenDeep, greenSoft y navy.
export const PDF_COLOR = {
  greenDeep: [11, 93, 59],
  greenSoft: [210, 232, 222],
  navy: [18, 60, 104],
  body: [90, 100, 112],
  border: [226, 232, 240],
  zebra: [246, 249, 252],
};

// El logo se pide una sola vez por sesión de navegador (no por cada PDF).
let logoPromise = null;
export function cargarLogoBase64() {
  if (!logoPromise) {
    logoPromise = fetch('/cossmil-logo.png')
      .then((r) => r.blob())
      .then((blob) => new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => resolve(null);
        lector.readAsDataURL(blob);
      }))
      .catch(() => null);
  }
  return logoPromise;
}

export function dibujarEncabezado(doc, { logo, titulo, desde, hasta, ocultarFecha = false }) {
  const ancho = doc.internal.pageSize.getWidth();
  const altoBanda = 30;

  // Membrete: banda de color de marca en vez de texto suelto sobre blanco.
  doc.setFillColor(...PDF_COLOR.greenDeep);
  doc.rect(0, 0, ancho, altoBanda, 'F');

  const x0 = logo ? 32 : 14;
  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.circle(20, 15, 9, 'F');
      doc.addImage(logo, 'PNG', 12, 7, 16, 16);
    } catch { /* el logo es decorativo, no bloquea el PDF */ }
  }

  doc.setFont(undefined, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('COSSMIL', x0, 12);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLOR.greenSoft);
  doc.text('Unidad de Medicina Física y Rehabilitación', x0, 17);
  // El informe de paciente pone su propio título centrado en el contenido
  // ("INFORME MÉDICO"), así que acá no se repite ninguno.
  if (titulo) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, x0, 25.5);
  }

  // "Fotografía del ..." solo tiene sentido en los reportes de corte (resumen,
  // profesionales, usuarios): el informe clínico del paciente ya trae sus
  // propias fechas (registro, inicio de plan) en el cuerpo.
  if (!ocultarFecha) {
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLOR.body);
    const rango = desde || hasta ? `Rango: ${desde || '—'} a ${hasta || '—'}` : `Fotografía del ${hoyISO()}`;
    doc.text(rango, 14, altoBanda + 8);
  }
  doc.setDrawColor(...PDF_COLOR.border);
  doc.line(14, altoBanda + (ocultarFecha ? 6 : 12), ancho - 14, altoBanda + (ocultarFecha ? 6 : 12));
}

export function dibujarPiePagina(doc, { generadoPor }) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const alto = doc.internal.pageSize.getHeight();
    const ancho = doc.internal.pageSize.getWidth();
    doc.setDrawColor(...PDF_COLOR.border);
    doc.line(14, alto - 14, ancho - 14, alto - 14);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Generado por ${generadoPor} · ${new Date().toLocaleString('es-BO')}`, 14, alto - 8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...PDF_COLOR.greenDeep);
    doc.text(`Página ${i} de ${total}`, ancho - 14, alto - 8, { align: 'right' });
  }
}
