import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ShadingType,
} from 'docx';
import {
  FileBarChart2, Download, FileDown, FileText, Loader2, AlertTriangle, ExternalLink,
  BarChart3, User, Ruler, CheckSquare, Users, ShieldCheck, SlidersHorizontal,
  CalendarRange, Info,
} from 'lucide-react';
import * as api from '../lib/api';
import { fmtFechaHora, TIPO_REPORTE_LABEL, ROL_LABEL } from '../lib/mappers';
import { hoyISO, PDF_COLOR, cargarLogoBase64, dibujarEncabezado, dibujarPiePagina } from '../lib/pdfBranding';
import { C, CARD, TD, BTN, TONES, SHADOW } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';
import EstadoVacio from './ui/EstadoVacio';
import Badge from './ui/Badge';
import Tabla from './ui/Tabla';

const badgeTono = (toneKey) => {
  const t = TONES[toneKey];
  return t ? { bg: t.bg, color: t.icon } : 'slate';
};

const ESTADO_PLAN_INFO = {
  activo: { label: 'Activo', tone: 'green' },
  completado: { label: 'Completado', tone: 'blue' },
  suspendido: { label: 'Suspendido', tone: 'amber' },
  abandonado: { label: 'Abandonado', tone: 'red' },
};
const ROL_INFO = {
  superusuario: { label: ROL_LABEL.superusuario, tone: badgeTono('lilac') },
  medico_fisiatra: { label: ROL_LABEL.medico_fisiatra, tone: 'blue' },
  fisioterapeuta: { label: ROL_LABEL.fisioterapeuta, tone: 'green' },
};

const hace30Dias = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

// Los 6 reportes de la FASE 9. La consulta que hay detrás de cada uno es
// EXACTAMENTE la misma para el administrador y para el profesional — la base
// decide sola qué le entrega a cada quien (security_invoker, PASO 24).
//
// Aun así, "Resumen de la unidad", "Profesionales" y "Usuarios y accesos" son
// vistas de gestión de TODA la unidad (aunque cada fila venga recortada por
// RLS) — el médico/fisioterapeuta no debe ni verlas en el selector, solo lo
// que es sobre sus propios pacientes: su ficha, su evolución (evaluaciones) y
// su adherencia. `soloAdmin` filtra esas tres para cualquiera que no sea
// superusuario.
const REPORTES = [
  { id: 'resumen',      label: 'Resumen de la unidad',      tipoPdf: 'general',      porPaciente: false, icon: BarChart3,   tone: 'blue',  soloAdmin: true },
  { id: 'paciente',     label: 'Paciente',                  tipoPdf: 'individual',   porPaciente: true,  icon: User,        tone: 'green' },
  { id: 'evaluaciones', label: 'Evaluaciones (goniómetro)', tipoPdf: 'evaluaciones', porPaciente: false, icon: Ruler,       tone: 'teal' },
  { id: 'adherencia',   label: 'Adherencia',                tipoPdf: 'adherencia',   porPaciente: false, icon: CheckSquare, tone: 'amber' },
  { id: 'profesionales',label: 'Profesionales',              tipoPdf: 'profesionales',porPaciente: false, icon: Users,      tone: 'lilac', soloAdmin: true },
  { id: 'usuarios',     label: 'Usuarios y accesos',        tipoPdf: 'usuarios',     porPaciente: false, icon: ShieldCheck, tone: 'rose',  soloAdmin: true },
];

const TONO_POR_TIPO_PDF = Object.fromEntries(REPORTES.map((r) => [r.tipoPdf, r.tone]));

const CAMPO_LABEL_RESUMEN = {
  pacientesTotal: 'Pacientes totales',
  pacientesActivos: 'Pacientes activos',
  enTratamiento: 'En tratamiento',
  dadosDeAlta: 'Dados de alta',
  abandonos: 'Abandonos',
  klGrado2: 'Kellgren-Lawrence grado 2',
  klGrado3: 'Kellgren-Lawrence grado 3',
  profesionales: 'Profesionales',
  planesActivos: 'Planes activos',
  ejerciciosEnCatalogo: 'Ejercicios en catálogo',
  ejerciciosConVideo: 'Ejercicios con video',
  sesionesTotal: 'Sesiones totales',
  sesionesCompletadas: 'Sesiones completadas',
  sesionesUltimoMes: 'Sesiones último mes',
  repeticionesTotal: 'Repeticiones totales',
  citasCumplidas: 'Citas cumplidas',
  citasConAusencia: 'Citas con ausencia',
  evaluacionesTotal: 'Evaluaciones totales',
  evaluacionesIniciales: 'Evaluaciones iniciales',
  evaluacionesFinales: 'Evaluaciones finales',
  gananciaRomPromedio: 'Ganancia de ROM promedio (°)',
  reduccionDolorPromedio: 'Reducción de dolor promedio',
  errorCamaraPromedio: 'Error de cámara promedio (°)',
  acuerdoCamaraPorcentaje: '% de acuerdo de la cámara',
};

const CAMPO_LABEL_PACIENTE = {
  codigoAnonimo: 'Código',
  nombreCompleto: 'Nombre completo',
  edad: 'Edad',
  sexo: 'Sexo',
  gradoArtrosis: 'Grado de artrosis (KL)',
  articulacionPrincipal: 'Articulación principal',
  diagnosticoPrevio: 'Diagnóstico previo',
  fechaRegistro: 'Fecha de registro',
  medicoTratante: 'Médico tratante',
  fisioterapeuta: 'Fisioterapeuta',
  sesionesCompletadas: 'Sesiones completadas',
  citasCumplidas: 'Citas cumplidas',
  citasAusentes: 'Citas ausentes',
  dolorUltimoMes: 'Dolor promedio (últ. mes)',
  mejorRomCamara: 'Mejor ROM con cámara',
  romInicial: 'ROM inicial',
  romFinal: 'ROM final',
  gananciaRom: 'Ganancia de ROM',
  dolorInicial: 'Dolor inicial',
  dolorFinal: 'Dolor final',
  reduccionDolor: 'Reducción de dolor',
  diasDeTratamiento: 'Días de tratamiento',
  objetivoGeneral: 'Objetivo del plan',
  fechaInicioPlan: 'Inicio del plan',
  duracionEstimadaSemanas: 'Duración estimada (semanas)',
  estadoPlan: 'Estado del plan',
};

const formatearValor = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
};

// Convierte celdas que en realidad son un estado cerrado (sí/no, estado del
// plan, rol) en un badge de color en vez de texto plano — el resto de las
// celdas se queda como texto normal, tal como lo entrega `formatearValor`.
function renderCelda(key, crudo) {
  const formateado = formatearValor(crudo);
  if (key === 'dentroUmbral') {
    if (formateado === 'Sí') return <Badge tone="green" dot>Sí</Badge>;
    if (formateado === 'No') return <Badge tone="red" dot>No</Badge>;
    return formateado;
  }
  if (key === 'estadoPlan' && ESTADO_PLAN_INFO[crudo]) {
    const info = ESTADO_PLAN_INFO[crudo];
    return <Badge tone={info.tone}>{info.label}</Badge>;
  }
  if ((key === 'rol' || key === 'tipoProfesional') && ROL_INFO[crudo]) {
    const info = ROL_INFO[crudo];
    return <Badge tone={info.tone}>{info.label}</Badge>;
  }
  return formateado;
}

// Arma la tabla (columnas + filas) que se va a mostrar en pantalla, exportar
// a CSV y dibujar en el PDF. Los reportes de una sola fila (resumen,
// paciente) se aplanan a pares "campo/valor" para reusar la misma tabla.
function construirVista(tipo, datos) {
  if (!datos) return { columnas: [], filas: [] };

  switch (tipo) {
    case 'resumen':
      return {
        columnas: [{ key: 'campo', label: 'Indicador' }, { key: 'valor', label: 'Valor' }],
        filas: Object.entries(CAMPO_LABEL_RESUMEN).map(([k, label]) => ({
          campo: label, valor: formatearValor(datos[k]),
        })),
      };
    case 'paciente':
      return {
        columnas: [{ key: 'campo', label: 'Dato' }, { key: 'valor', label: 'Valor' }],
        filas: Object.entries(CAMPO_LABEL_PACIENTE).map(([k, label]) => ({
          campo: label, valor: formatearValor(datos[k]),
        })),
      };
    case 'evaluaciones':
      return {
        columnas: [
          { key: 'codigoAnonimo', label: 'Código' },
          { key: 'momento', label: 'Momento' },
          { key: 'fecha', label: 'Fecha' },
          { key: 'articulacion', label: 'Articulación' },
          { key: 'lado', label: 'Lado' },
          { key: 'romGoniometro', label: 'ROM goniómetro (°)' },
          { key: 'anguloApp', label: 'Ángulo cámara (°)' },
          { key: 'errorAbsoluto', label: 'Error (°)' },
          { key: 'dentroUmbral', label: '¿Dentro del umbral?' },
          { key: 'dolorEva', label: 'Dolor EVA' },
          { key: 'evaluador', label: 'Evaluador' },
        ],
        filas: (datos || []).map((d) => ({ ...d, dentroUmbral: formatearValor(d.dentroUmbral) })),
      };
    case 'adherencia':
      return {
        columnas: [
          { key: 'codigoAnonimo', label: 'Código' },
          { key: 'nombreCompleto', label: 'Paciente' },
          { key: 'medicoTratante', label: 'Médico tratante' },
          { key: 'estadoPlan', label: 'Estado del plan' },
          { key: 'sesionesEsperadasHastaHoy', label: 'Sesiones esperadas' },
          { key: 'sesionesRealizadas', label: 'Sesiones realizadas' },
          { key: 'adherenciaPorcentaje', label: '% adherencia' },
          { key: 'citasPerdidas', label: 'Citas perdidas' },
        ],
        filas: datos || [],
      };
    case 'profesionales':
      return {
        columnas: [
          { key: 'nombreCompleto', label: 'Profesional' },
          { key: 'tipoProfesional', label: 'Tipo' },
          { key: 'pacientesActivos', label: 'Pacientes activos' },
          { key: 'planesActivos', label: 'Planes activos' },
          { key: 'evaluacionesHechas', label: 'Evaluaciones hechas' },
          { key: 'altasDadas', label: 'Altas dadas' },
          { key: 'citasCumplidas', label: 'Citas cumplidas' },
          { key: 'citasConAusencia', label: 'Citas con ausencia' },
          { key: 'citasPorVenir', label: 'Citas por venir' },
        ],
        filas: datos || [],
      };
    case 'usuarios':
      return {
        columnas: [
          { key: 'nombreUsuario', label: 'Usuario' },
          { key: 'email', label: 'Correo' },
          { key: 'rol', label: 'Rol' },
          { key: 'actividad', label: 'Actividad' },
          { key: 'modulosConcedidos', label: 'Módulos concedidos' },
          { key: 'pacientesACargo', label: 'Pacientes a cargo' },
        ],
        filas: datos || [],
      };
    default:
      return { columnas: [], filas: [] };
  }
}

async function cargarDatosReporte(tipo, { idPaciente, desde, hasta }) {
  switch (tipo) {
    case 'resumen': return api.cargarReporteResumen();
    case 'paciente': return idPaciente ? api.cargarReportePaciente(Number(idPaciente)) : null;
    case 'evaluaciones': return api.cargarReporteEvaluaciones(desde || null, hasta || null);
    case 'adherencia': return api.cargarReporteAdherencia();
    case 'profesionales': return api.cargarReporteProfesionales();
    case 'usuarios': return api.cargarReporteUsuarios();
    default: return null;
  }
}

const ESTADO_PLAN_TEXTO = {
  activo: 'En tratamiento activo',
  completado: 'Tratamiento completado',
  suspendido: 'Tratamiento suspendido',
  abandonado: 'Tratamiento abandonado',
};

// -----------------------------------------------------------------------------
// Informe clínico del paciente — como el formato de "INFORME MÉDICO" clásico
// (título, secciones en negrita, diagnóstico resaltado, recomendaciones), pero
// con los datos de fisioterapia que maneja este sistema en vez de los de un
// examen ocupacional (acá no hay audiometría, espirometría ni datos laborales).
// Reemplaza a la tabla genérica "Dato/Valor" SOLO para este tipo de reporte;
// el CSV sigue exportando esa tabla tal cual, para no perder ningún campo.
// -----------------------------------------------------------------------------
function dibujarInformePaciente(doc, datos) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const izq = 14;
  const der = ancho - 14;
  const centro = ancho / 2;
  const mitad = izq + (der - izq) / 2;
  let y = 44;

  // Título del documento, centrado en el contenido (no en la banda de
  // marca) — así es como pide el modelo de referencia.
  doc.setFont(undefined, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLOR.navy);
  doc.text('INFORME MÉDICO', centro, y, { align: 'center' });
  doc.setDrawColor(...PDF_COLOR.navy);
  doc.setLineWidth(0.3);
  const anchoTitulo = doc.getTextWidth('INFORME MÉDICO');
  doc.line(centro - anchoTitulo / 2, y + 2, centro + anchoTitulo / 2, y + 2);
  doc.setLineWidth(0.1);
  y += 14;

  const nuevaPaginaSiHaceFalta = (necesita) => {
    if (y + necesita > alto - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const seccion = (titulo) => {
    nuevaPaginaSiHaceFalta(14);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_COLOR.navy);
    doc.text(titulo.toUpperCase(), izq, y);
    doc.setDrawColor(...PDF_COLOR.greenDeep);
    doc.setLineWidth(0.4);
    doc.line(izq, y + 1.8, der, y + 1.8);
    doc.setLineWidth(0.1);
    y += 8;
  };

  // Hasta 2 pares [etiqueta, valor] por fila, alineados en dos columnas.
  const fila = (...pares) => {
    nuevaPaginaSiHaceFalta(7);
    pares.forEach(([label, valor], i) => {
      const x = i === 0 ? izq : mitad;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLOR.body);
      doc.text(`${label}:`, x, y);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...PDF_COLOR.navy);
      doc.text(formatearValor(valor), x + 40, y);
    });
    y += 6.5;
  };

  // Párrafo largo (diagnóstico, recomendaciones) con ajuste de línea.
  const parrafo = (texto, { negrita = false } = {}) => {
    const lineas = doc.splitTextToSize(texto, der - izq);
    nuevaPaginaSiHaceFalta(lineas.length * 5 + 2);
    doc.setFont(undefined, negrita ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_COLOR.navy);
    doc.text(lineas, izq, y);
    y += lineas.length * 5 + 2;
  };

  seccion('Datos del paciente');
  fila(['Código', datos.codigoAnonimo], ['Nombre completo', datos.nombreCompleto]);
  fila(['Edad', datos.edad != null ? `${datos.edad} años` : null], ['Sexo', datos.sexo]);
  fila(['Fecha de registro', datos.fechaRegistro], ['Médico tratante', datos.medicoTratante]);
  fila(['Fisioterapeuta', datos.fisioterapeuta]);
  y += 2;

  seccion('Evaluación clínica');
  fila(['Articulación principal', datos.articulacionPrincipal], ['Grado de artrosis (KL)', datos.gradoArtrosis]);
  fila(['Inicio del plan', datos.fechaInicioPlan], ['Duración estimada', datos.duracionEstimadaSemanas != null ? `${datos.duracionEstimadaSemanas} semanas` : null]);
  y += 1;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLOR.body);
  doc.text('Diagnóstico previo:', izq, y);
  y += 5.5;
  parrafo(datos.diagnosticoPrevio || 'Sin diagnóstico registrado.');
  y += 2;

  seccion('Evolución del tratamiento');
  fila(['ROM inicial', datos.romInicial], ['ROM final', datos.romFinal]);
  fila(['Ganancia de ROM', datos.gananciaRom], ['Dolor inicial (EVA)', datos.dolorInicial]);
  fila(['Dolor final (EVA)', datos.dolorFinal], ['Reducción de dolor', datos.reduccionDolor]);
  fila(['Sesiones completadas', datos.sesionesCompletadas], ['Días de tratamiento', datos.diasDeTratamiento]);
  fila(['Citas cumplidas', datos.citasCumplidas], ['Citas con ausencia', datos.citasAusentes]);
  y += 2;

  // --- Diagnóstico / estado actual, resaltado (como el highlight amarillo
  // del informe de referencia, con el verde institucional en vez de amarillo).
  // Es la CONCLUSIÓN, corta — el detalle ya está arriba en "Evaluación
  // clínica", repetirlo acá entero sería redundante.
  seccion('Diagnóstico');
  const textoEstado = ESTADO_PLAN_TEXTO[datos.estadoPlan] || formatearValor(datos.estadoPlan);
  const articulacionTxt = datos.articulacionPrincipal ? `Artrosis de ${datos.articulacionPrincipal}` : 'Sin articulación registrada';
  const gradoTxt = datos.gradoArtrosis != null ? ` grado ${datos.gradoArtrosis} (Kellgren-Lawrence)` : '';
  const diagnosticoTexto = `${articulacionTxt}${gradoTxt}. ${textoEstado}.`;
  const lineasDiag = doc.splitTextToSize(diagnosticoTexto, der - izq - 8);
  const altoCaja = lineasDiag.length * 5 + 7;
  nuevaPaginaSiHaceFalta(altoCaja);
  doc.setFillColor(...PDF_COLOR.greenSoft);
  doc.roundedRect(izq, y - 5, der - izq, altoCaja, 2, 2, 'F');
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_COLOR.greenDeep);
  doc.text(lineasDiag, izq + 4, y);
  y += altoCaja + 4;

  seccion('Recomendaciones');
  parrafo(datos.objetivoGeneral || 'Continuar con el plan de tratamiento vigente y el control periódico con el médico tratante.');
}

// -----------------------------------------------------------------------------
// Mismo informe, como .docx — para que el médico lo pueda retocar a mano (una
// palabra del diagnóstico, una recomendación) antes de imprimirlo o mandarlo,
// algo que un PDF no permite. Misma estructura y el mismo texto que el PDF.
// -----------------------------------------------------------------------------
function filaWord(...pares) {
  const children = [];
  pares.forEach(([label, valor], i) => {
    if (i > 0) children.push(new TextRun({ text: '          ' }));
    children.push(new TextRun({ text: `${label}: `, bold: true, color: '5A6470' }));
    children.push(new TextRun({ text: formatearValor(valor), color: '123C68' }));
  });
  return new Paragraph({ children, spacing: { after: 160 } });
}

function seccionWord(texto) {
  return new Paragraph({
    children: [new TextRun({ text: texto.toUpperCase(), bold: true, color: '123C68', size: 22 })],
    spacing: { before: 320, after: 160 },
    border: { bottom: { color: '0B5D3B', space: 2, style: BorderStyle.SINGLE, size: 6 } },
  });
}

async function generarWordInformePaciente(datos) {
  const textoEstado = ESTADO_PLAN_TEXTO[datos.estadoPlan] || formatearValor(datos.estadoPlan);
  const articulacionTxt = datos.articulacionPrincipal ? `Artrosis de ${datos.articulacionPrincipal}` : 'Sin articulación registrada';
  const gradoTxt = datos.gradoArtrosis != null ? ` grado ${datos.gradoArtrosis} (Kellgren-Lawrence)` : '';

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { color: '123C68', space: 4, style: BorderStyle.SINGLE, size: 6 } },
          children: [new TextRun({ text: 'INFORME MÉDICO', bold: true, size: 32, color: '123C68' })],
          spacing: { after: 120 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'COSSMIL · Unidad de Medicina Física y Rehabilitación', italics: true, size: 19, color: '6E8AA6' })],
          spacing: { after: 320 },
        }),

        seccionWord('Datos del paciente'),
        filaWord(['Código', datos.codigoAnonimo], ['Nombre completo', datos.nombreCompleto]),
        filaWord(['Edad', datos.edad != null ? `${datos.edad} años` : null], ['Sexo', datos.sexo]),
        filaWord(['Fecha de registro', datos.fechaRegistro], ['Médico tratante', datos.medicoTratante]),
        filaWord(['Fisioterapeuta', datos.fisioterapeuta]),

        seccionWord('Evaluación clínica'),
        filaWord(['Articulación principal', datos.articulacionPrincipal], ['Grado de artrosis (KL)', datos.gradoArtrosis]),
        filaWord(['Inicio del plan', datos.fechaInicioPlan], ['Duración estimada', datos.duracionEstimadaSemanas != null ? `${datos.duracionEstimadaSemanas} semanas` : null]),
        new Paragraph({ children: [new TextRun({ text: 'Diagnóstico previo:', bold: true, color: '5A6470' })], spacing: { before: 120, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: datos.diagnosticoPrevio || 'Sin diagnóstico registrado.', color: '123C68' })], spacing: { after: 160 } }),

        seccionWord('Evolución del tratamiento'),
        filaWord(['ROM inicial', datos.romInicial], ['ROM final', datos.romFinal]),
        filaWord(['Ganancia de ROM', datos.gananciaRom], ['Dolor inicial (EVA)', datos.dolorInicial]),
        filaWord(['Dolor final (EVA)', datos.dolorFinal], ['Reducción de dolor', datos.reduccionDolor]),
        filaWord(['Sesiones completadas', datos.sesionesCompletadas], ['Días de tratamiento', datos.diasDeTratamiento]),
        filaWord(['Citas cumplidas', datos.citasCumplidas], ['Citas con ausencia', datos.citasAusentes]),

        seccionWord('Diagnóstico'),
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'D2E8DE' },
          children: [new TextRun({ text: `${articulacionTxt}${gradoTxt}. ${textoEstado}.`, bold: true, color: '0B5D3B' })],
          spacing: { before: 100, after: 100 },
        }),

        seccionWord('Recomendaciones'),
        new Paragraph({
          children: [new TextRun({
            text: datos.objetivoGeneral || 'Continuar con el plan de tratamiento vigente y el control periódico con el médico tratante.',
          })],
        }),
      ],
    }],
  });

  return Packer.toBlob(doc);
}

const csvCelda = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Reportes({ patients, currentUser, onShowNotification }) {
  const esSuperusuario = currentUser?.user?.nombre_rol === 'superusuario';
  const reportesVisibles = useMemo(
    () => REPORTES.filter((r) => esSuperusuario || !r.soloAdmin),
    [esSuperusuario],
  );

  const [tipo, setTipo] = useState(esSuperusuario ? 'resumen' : 'paciente');
  const [idPaciente, setIdPaciente] = useState('');
  const [desde, setDesde] = useState(hace30Dias());
  const [hasta, setHasta] = useState(hoyISO());

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [generando, setGenerando] = useState(false);

  const [generados, setGenerados] = useState([]);
  const [cargandoGenerados, setCargandoGenerados] = useState(false);

  const reporte = reportesVisibles.find((r) => r.id === tipo) || reportesVisibles[0];
  const vista = useMemo(() => construirVista(tipo, datos), [tipo, datos]);

  useEffect(() => {
    if (reporte.porPaciente && !idPaciente) { setDatos(null); setError(null); return; }
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const d = await cargarDatosReporte(tipo, { idPaciente, desde, hasta });
        if (!cancelado) setDatos(d);
      } catch (err) {
        if (!cancelado) { setError(err.message); setDatos(null); }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, idPaciente, desde, hasta]);

  const cargarGenerados = async () => {
    setCargandoGenerados(true);
    try {
      setGenerados(await api.cargarReportesGenerados());
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setCargandoGenerados(false);
    }
  };

  useEffect(() => { cargarGenerados(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const exportarCSV = () => {
    if (!vista.filas.length) return;
    const encabezados = vista.columnas.map((c) => c.label);
    const filas = vista.filas.map((f) => vista.columnas.map((c) => csvCelda(f[c.key])));
    const csv = [encabezados, ...filas].map((f) => f.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${tipo}_${hoyISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Para "Paciente": en vez de CSV, un .docx con el mismo informe — el médico
  // lo puede retocar (una palabra del diagnóstico, una recomendación) antes
  // de imprimirlo o mandarlo, cosa que un PDF no deja hacer fácil.
  const [generandoWord, setGenerandoWord] = useState(false);
  const exportarWord = async () => {
    if (!datos) return;
    setGenerandoWord(true);
    try {
      const blob = await generarWordInformePaciente(datos);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_paciente_${datos.codigoAnonimo || hoyISO()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGenerandoWord(false);
    }
  };

  const generarPDF = async () => {
    if (!vista.filas.length) return onShowNotification?.('No hay datos para generar este reporte.', 'error');
    setGenerando(true);
    try {
      const doc = new jsPDF({ orientation: vista.columnas.length > 6 ? 'landscape' : 'portrait' });
      const logo = await cargarLogoBase64();
      const generadoPor = currentUser?.user?.nombre_completo || currentUser?.medico?.nombre_completo || currentUser?.user?.nombre_usuario || 'Usuario';

      dibujarEncabezado(doc, {
        logo, titulo: tipo === 'paciente' ? null : reporte.label,
        desde: tipo === 'evaluaciones' ? desde : null,
        hasta: tipo === 'evaluaciones' ? hasta : null,
        ocultarFecha: tipo === 'paciente',
      });

      if (tipo === 'paciente') {
        dibujarInformePaciente(doc, datos);
      } else {
        autoTable(doc, {
          startY: 46,
          head: [vista.columnas.map((c) => c.label)],
          body: vista.filas.map((f) => vista.columnas.map((c) => formatearValor(f[c.key]))),
          styles: {
            fontSize: 8.5, cellPadding: 3.2,
            textColor: [45, 55, 65], lineColor: PDF_COLOR.border, lineWidth: 0.1,
          },
          headStyles: { fillColor: PDF_COLOR.greenDeep, textColor: 255, fontStyle: 'bold', fontSize: 9 },
          alternateRowStyles: { fillColor: PDF_COLOR.zebra },
          // Reportes de "Dato/Valor" (resumen): la primera columna resalta en
          // negrita+navy para que se lea como etiqueta, no como dato.
          columnStyles: vista.columnas.length === 2 ? { 0: { fontStyle: 'bold', textColor: PDF_COLOR.navy, cellWidth: 70 } } : {},
          margin: { top: 46 },
        });
      }

      dibujarPiePagina(doc, { generadoPor });

      const nombreArchivo = `reporte_${tipo}_${hoyISO()}.pdf`;
      const blob = doc.output('blob');

      await api.subirReportePDF(blob, nombreArchivo, {
        idPaciente: reporte.porPaciente ? Number(idPaciente) : null,
        desde: desde || null,
        hasta: hasta || null,
        tipo: reporte.tipoPdf,
      });

      doc.save(nombreArchivo);
      await cargarGenerados();
      onShowNotification?.('Reporte generado y guardado.');
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGenerando(false);
    }
  };

  const handleDescargar = async (fila) => {
    try {
      const url = await api.urlReporte(fila.ruta);
      if (!url) throw new Error('No se pudo generar el enlace de descarga.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  const tonoActivo = TONES[reporte.tone];

  return (
    <div className="space-y-5 animate-slide-in">
      <EncabezadoModulo
        icon={FileBarChart2}
        title="Reportes"
        subtitle={
          esSuperusuario
            ? 'Los 6 reportes de la unidad: los de gestión (resumen, profesionales, usuarios) y los clínicos de tus pacientes.'
            : 'Los reportes de tus propios pacientes: su ficha, su evolución en las evaluaciones y su adherencia al plan.'
        }
      />

      {/* ------------------------------- Selector de reporte ------------------------------- */}
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${reportesVisibles.length > 4 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
        {reportesVisibles.map((r) => {
          const t = TONES[r.tone];
          const activo = tipo === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => { setTipo(r.id); setDatos(null); }}
              className="flex cursor-pointer flex-col items-start gap-2.5 rounded-[14px] border p-3 text-left transition-all"
              style={{
                borderColor: activo ? t.icon : C.border,
                backgroundColor: activo ? t.bg : C.white,
                boxShadow: activo ? SHADOW.card : 'none',
              }}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                style={{ backgroundColor: t.tile, color: t.icon }}
              >
                <r.icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="text-[12.5px] font-bold leading-tight" style={{ color: C.navy }}>
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------- Filtros ------------------------------- */}
      <div className={`${CARD} p-4`} style={{ borderColor: C.border }}>
        <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.navy }}>
          <SlidersHorizontal className="h-4 w-4" style={{ color: C.muted }} /> Filtros del reporte
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reporte.porPaciente && (
            <label className="text-[11px] font-bold uppercase" style={{ color: C.muted }}>
              Paciente
              <select
                value={idPaciente}
                onChange={(e) => setIdPaciente(e.target.value)}
                className="mt-1 w-full rounded-[10px] border bg-white p-2.5 text-[13px] font-medium outline-none focus:ring-2"
                style={{ borderColor: C.fieldBd, color: C.navy }}
              >
                <option value="">Selecciona…</option>
                {(patients || []).map((p) => (
                  <option key={p.db_id} value={p.db_id}>{p.name} · {p.id}</option>
                ))}
              </select>
            </label>
          )}

          <label className="text-[11px] font-bold uppercase" style={{ color: C.muted }}>
            Desde
            <input
              type="date" value={desde} max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 w-full rounded-[10px] border bg-white p-2.5 text-[13px] font-medium outline-none focus:ring-2"
              style={{ borderColor: C.fieldBd, color: C.navy }}
            />
          </label>
          <label className="text-[11px] font-bold uppercase" style={{ color: C.muted }}>
            Hasta
            <input
              type="date" value={hasta} min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 w-full rounded-[10px] border bg-white p-2.5 text-[13px] font-medium outline-none focus:ring-2"
              style={{ borderColor: C.fieldBd, color: C.navy }}
            />
          </label>
        </div>

        {tipo !== 'evaluaciones' && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
            <Info className="h-3.5 w-3.5 shrink-0" />
            Este reporte es una fotografía del momento: el rango de fechas solo queda anotado como
            referencia en el PDF, no filtra los datos.
          </p>
        )}
        {(tipo === 'resumen' || tipo === 'evaluaciones') && (
          <p
            className="mt-3 flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold"
            style={{ backgroundColor: TONES.amber.bg, color: TONES.amber.icon }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Este reporte usa solo el código anónimo del paciente, nunca su nombre.
          </p>
        )}
      </div>

      {/* ------------------------------- Vista previa ------------------------------- */}
      <div className={`${CARD} overflow-hidden`} style={{ borderColor: C.border }}>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b p-4"
          style={{ borderColor: C.border, backgroundColor: C.headBg }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
              style={{ backgroundColor: tonoActivo.tile, color: tonoActivo.icon }}
            >
              <reporte.icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[13px] font-extrabold" style={{ color: C.navy }}>Vista previa</h2>
              {vista.filas.length > 0 && (
                <p className="text-[11px]" style={{ color: C.muted }}>{vista.filas.length} fila{vista.filas.length === 1 ? '' : 's'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tipo === 'paciente' ? (
              <button
                type="button" onClick={exportarWord} disabled={!vista.filas.length || generandoWord}
                className={`${BTN} border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                style={{ borderColor: C.fieldBd, color: C.navy, backgroundColor: C.white }}
              >
                {generandoWord ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {generandoWord ? 'Generando…' : 'Exportar Word'}
              </button>
            ) : (
              <button
                type="button" onClick={exportarCSV} disabled={!vista.filas.length}
                className={`${BTN} border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                style={{ borderColor: C.fieldBd, color: C.navy, backgroundColor: C.white }}
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
            )}
            <button
              type="button" onClick={generarPDF} disabled={!vista.filas.length || generando}
              className={`${BTN} px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50`}
              style={{ backgroundColor: C.greenDeep }}
            >
              {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              {generando ? 'Generando…' : 'Generar PDF'}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="m-4 flex items-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: TONES.rose.border, backgroundColor: TONES.rose.bg, color: TONES.rose.icon }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {reporte.porPaciente && !idPaciente ? (
          <div className="p-4">
            <EstadoVacio icon={User} title="Elige un paciente" hint="Selecciona un paciente arriba para ver su reporte individual." />
          </div>
        ) : !cargando && !vista.filas.length ? (
          <div className="p-4">
            <EstadoVacio icon={reporte.icon} title="No hay datos para este reporte todavía" />
          </div>
        ) : (
          <Tabla
            minWidth="640px"
            columnas={vista.columnas.map((c) => ({ label: c.label }))}
            filas={vista.filas}
            cargando={cargando}
            renderFila={(f, i) => (
              <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50/70" style={{ borderColor: C.border }}>
                {vista.columnas.map((c) => (
                  <td key={c.key} className={`${TD} whitespace-nowrap`} style={{ color: C.body }}>
                    {renderCelda(c.key, f[c.key])}
                  </td>
                ))}
              </tr>
            )}
          />
        )}
      </div>

      {/* ------------------------------- Reportes ya generados ------------------------------- */}
      <div className={`${CARD} overflow-hidden`} style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2.5 border-b p-4" style={{ borderColor: C.border, backgroundColor: C.headBg }}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ backgroundColor: C.mintTile, color: C.green }}>
            <CalendarRange className="h-4 w-4" strokeWidth={2} />
          </span>
          <h2 className="text-[13px] font-extrabold" style={{ color: C.navy }}>Reportes generados</h2>
        </div>
        {cargandoGenerados ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold" style={{ color: C.muted }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : generados.length === 0 ? (
          <div className="p-4">
            <EstadoVacio icon={FileBarChart2} title="Todavía no se generó ningún reporte" hint="Los PDF que generes con el botón de arriba van a aparecer acá." />
          </div>
        ) : (
          <Tabla
            minWidth="1070px"
            anchos={['w-[170px]', 'w-[140px]', 'w-[220px]', 'w-[200px]', 'w-[190px]', 'w-[150px]']}
            columnas={[
              { label: 'Tipo' }, { label: 'Paciente' }, { label: 'Rango' },
              { label: 'Generado por' }, { label: 'Fecha' }, { label: '' },
            ]}
            filas={generados}
            renderFila={(g) => (
              <tr key={g.id} className="border-b last:border-b-0 hover:bg-slate-50/70" style={{ borderColor: C.border }}>
                <td className={TD}>
                  <Badge tone={badgeTono(TONO_POR_TIPO_PDF[g.tipo])}>{TIPO_REPORTE_LABEL[g.tipo] || g.tipo}</Badge>
                </td>
                <td className={TD} style={{ color: C.body }}>{g.paciente || '—'}</td>
                <td className={`${TD} break-words`} style={{ color: C.body }}>
                  {g.desde || g.hasta ? `${g.desde || '—'} a ${g.hasta || '—'}` : '—'}
                </td>
                <td className={`${TD} break-words`} style={{ color: C.body }}>{g.generadoPor}</td>
                <td className={`${TD} whitespace-nowrap`} style={{ color: C.body }}>{fmtFechaHora(g.fechaGeneracion)}</td>
                <td className={`${TD} text-right`}>
                  <button
                    type="button" onClick={() => handleDescargar(g)}
                    className={`${BTN} border px-3 py-1.5 text-[11px]`}
                    style={{ borderColor: C.fieldBd, color: C.navy }}
                  >
                    <ExternalLink className="h-3 w-3" /> Descargar
                  </button>
                </td>
              </tr>
            )}
          />
        )}
      </div>
    </div>
  );
}
