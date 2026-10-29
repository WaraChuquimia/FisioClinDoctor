// =============================================================================
// Movimientos que la app del paciente puede medir con la cámara.
// -----------------------------------------------------------------------------
// Es lo que se guarda en `ejercicios_catalogo.clase_lstm`. Sin este código la
// app del paciente muestra "Este ejercicio todavía no tiene seguimiento con
// cámara" y no deja iniciar la sesión.
//
// Sale de C:\Users\WARA\FisioClin\ml\configuracion_ejercicios.json. Solo están
// los 17 que tienen calibración medida (`umbrales`). C09, R03 y R10 NO están a
// propósito: sin calibración la app no puede contar repeticiones.
// =============================================================================
export const MOVIMIENTOS_CAMARA = [
  { codigo: 'C01', nombre: 'Puente de glúteos', zona: 'cadera' },
  { codigo: 'C02', nombre: 'Almeja (clamshell)', zona: 'cadera' },
  { codigo: 'C03', nombre: 'Elevación lateral de pierna', zona: 'cadera' },
  { codigo: 'C04', nombre: 'Rotación de cadera', zona: 'cadera' },
  { codigo: 'C05', nombre: 'Extensión de rodilla con cojín', zona: 'cadera' },
  { codigo: 'C06', nombre: 'Flexión de cadera', zona: 'cadera' },
  { codigo: 'C07', nombre: 'Estiramiento de recto anterior', zona: 'cadera' },
  { codigo: 'C08', nombre: 'Bicho muerto (dead bug)', zona: 'cadera' },
  { codigo: 'C10', nombre: 'Apertura lateral en cuadrupedia', zona: 'cadera' },
  { codigo: 'R01', nombre: 'Extensión y flexión de rodilla', zona: 'rodilla' },
  { codigo: 'R02', nombre: 'Elevación de pierna recta', zona: 'rodilla' },
  { codigo: 'R04', nombre: 'Hip thrust', zona: 'rodilla' },
  { codigo: 'R05', nombre: 'Extensión de rodilla en prono', zona: 'rodilla' },
  { codigo: 'R06', nombre: 'Elevación de rodilla hacia el pecho', zona: 'rodilla' },
  { codigo: 'R07', nombre: 'Sentadilla con peso muerto', zona: 'rodilla' },
  { codigo: 'R08', nombre: 'Sentadilla profunda', zona: 'rodilla' },
  { codigo: 'R09', nombre: 'Sentadilla búlgara', zona: 'rodilla' },
];

export const nombreMovimiento = (codigo) =>
  MOVIMIENTOS_CAMARA.find((m) => m.codigo === codigo)?.nombre || null;
