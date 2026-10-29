import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Info, ChevronDown } from 'lucide-react';
import Avatar from './Avatar';

export default function ModalNuevoPaciente({ isOpen, onClose, onSave, currentUser, profesionales }) {
  // `birthDate` y no `age`: la columna `fecha_nacimiento` es NOT NULL y lleva un
  // CHECK (entre 1900 y hoy). Guardar la edad obligaba a inventar la fecha, y
  // además la edad caduca sola: dentro de un año el dato es falso.
  const ESTADO_INICIAL = {
    name: '',
    birthDate: '',
    gender: 'Masculino',
    ci: '',
    phone: '',
    email: '',
    address: '',
    diagnosis: '',
    // Obligatorios en la base: `pacientes_grado_kl_check` solo admite 2 o 3, y
    // `articulacion_principal` es del enum `articulacion`.
    gradoArtrosis: 2,
    articulacion: 'rodilla',
    // El superusuario no atiende pacientes: no tiene ficha en `medicos`, así que
    // tiene que elegir a qué médico se lo asigna. Un médico o fisioterapeuta
    // queda preseleccionado con él mismo, pero puede cambiarlo.
    id_medico_tratante: '',
    id_fisioterapeuta: '',
    status: 'Activo'
  };

  const [formData, setFormData] = useState(ESTADO_INICIAL);

  const [errors, setErrors] = useState({});

  const esSuperusuario = currentUser?.user?.nombre_rol === 'superusuario';
  const propioIdMedico = currentUser?.medico?.id_medico || '';
  // Sin ficha de médico, la base va a rechazar el alta (política RLS). Se avisa
  // al abrir la ventana, no después de llenar los 12 campos del formulario.
  const sinFichaDeMedico = !esSuperusuario && !propioIdMedico;

  // Cada vez que se abre la ventana, arrancar limpia y con el médico tratante
  // precargado (si quien registra atiende pacientes).
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...ESTADO_INICIAL,
        id_medico_tratante: esSuperusuario ? '' : propioIdMedico,
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const setCampo = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleChange = (e) => setCampo(e.target.name, e.target.value);

  const validate = () => {
    const tempErrors = {};
    if (!formData.name) tempErrors.name = 'El nombre completo es requerido.';
    if (!formData.birthDate) {
      tempErrors.birthDate = 'La fecha de nacimiento es requerida.';
    } else {
      const d = new Date(formData.birthDate);
      if (Number.isNaN(d.getTime()) || d >= new Date() || d < new Date('1900-01-02')) {
        tempErrors.birthDate = 'Fecha fuera de rango.';
      }
    }
    if (!formData.ci) tempErrors.ci = 'El Carnet de Identidad es requerido.';
    if (!formData.phone) tempErrors.phone = 'El teléfono/celular es requerido.';
    if (!formData.diagnosis) tempErrors.diagnosis = 'El diagnóstico clínico es requerido.';
    if (!formData.id_medico_tratante) {
      tempErrors.id_medico_tratante = 'Elige a qué médico se le asigna este paciente.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (sinFichaDeMedico) return;
    if (!validate()) return;

    // Save patient
    onSave(formData);
    setFormData(ESTADO_INICIAL);
    onClose();
  };

  // Portal directo sobre <body>: si quedara anidado en la página, la
  // animación de entrada de esta (animate-slide-in) deja un `transform`
  // activo en el contenedor, y eso rompe `fixed` — el modal se ancla al
  // tamaño de esa caja en vez de a toda la pantalla.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in my-8">

        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-700" />
            <h2 className="text-base font-extrabold tracking-wide text-slate-800 dark:text-slate-200 m-0">Registrar Nuevo Paciente</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-750 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {sinFichaDeMedico ? (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs text-red-800 flex gap-2">
              <Info className="w-4 h-4 text-red-700 dark:text-red-300 shrink-0 mt-0.5" />
              <p>
                Tu usuario no tiene ficha de profesional. Pídele al administrador que la cree antes de registrar pacientes.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
              <Info className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
              <p>
                Complete los datos del afiliado militar o familiar. Esta información formará parte de su historial clínico permanente en <strong>FisioClin</strong>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nombre Completo *</label>
              <input 
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej. Sbtte. Rodrigo Rojas"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.name ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
              />
              {errors.name && <span className="text-[10px] text-red-500 font-medium">{errors.name}</span>}
            </div>

            {/* Carnet de Identidad */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Carnet de Identidad (CI) *</label>
              <input 
                type="text"
                name="ci"
                value={formData.ci}
                onChange={handleChange}
                placeholder="Ej. 6829103 LP"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.ci ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
              />
              {errors.ci && <span className="text-[10px] text-red-500 font-medium">{errors.ci}</span>}
            </div>

            {/* Age */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Fecha de nacimiento *</label>
                <input 
                  type="date"
                  name="birthDate"
                  max={new Date().toISOString().slice(0, 10)}
                  value={formData.birthDate}
                  onChange={handleChange}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.birthDate ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                />
                {errors.birthDate && <span className="text-[10px] text-red-500 font-medium">{errors.birthDate}</span>}
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Género</label>
                <select 
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-white dark:bg-slate-900"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Teléfono / Celular *</label>
              <input 
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. +591 71294829"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
              />
              {errors.phone && <span className="text-[10px] text-red-500 font-medium">{errors.phone}</span>}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Correo Electrónico (Opcional)</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ej. rodrigo.rojas@cossmil.mil"
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Datos clínicos obligatorios */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Articulación *</label>
                <select
                  name="articulacion"
                  value={formData.articulacion}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-white dark:bg-slate-900"
                >
                  <option value="rodilla">Rodilla</option>
                  <option value="cadera">Cadera</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Grado artrosis (K-L) *</label>
                <select
                  name="gradoArtrosis"
                  value={formData.gradoArtrosis}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-white dark:bg-slate-900"
                >
                  <option value="2">Grado II</option>
                  <option value="3">Grado III</option>
                </select>
              </div>
            </div>

            {/* Médico tratante */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Médico tratante *</label>
              <SelectorProfesional
                opciones={profesionales?.medicos || []}
                value={formData.id_medico_tratante}
                onChange={(id) => setCampo('id_medico_tratante', id)}
                placeholder="Selecciona un médico..."
                error={Boolean(errors.id_medico_tratante)}
                disabled={!esSuperusuario}
              />
              {errors.id_medico_tratante && <span className="text-[10px] text-red-500 font-medium">{errors.id_medico_tratante}</span>}
              {!esSuperusuario && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Solo el administrador puede reasignar esto.</span>
              )}
            </div>

            {/* Fisioterapeuta asignado: a diferencia del médico tratante, esto
                sí lo puede elegir el doctor que registra al paciente — es él
                quien decide a qué fisioterapeuta deriva la parte de terapia. */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Fisioterapeuta asignado</label>
              <SelectorProfesional
                opciones={profesionales?.fisioterapeutas || []}
                value={formData.id_fisioterapeuta}
                onChange={(id) => setCampo('id_fisioterapeuta', id)}
                placeholder="Sin asignar"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Dirección (Opcional)</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ej. Av. Ballivián 1234, La Paz"
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          {/* Diagnosis */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Diagnóstico Clínico Inicial *</label>
            <textarea 
              name="diagnosis"
              value={formData.diagnosis}
              onChange={handleChange}
              placeholder="Ej. Gonartrosis grado II con limitación funcional leve..."
              rows="3"
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.diagnosis ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
            ></textarea>
            {errors.diagnosis && <span className="text-[10px] text-red-500 font-medium">{errors.diagnosis}</span>}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sinFichaDeMedico}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-green-700/20 cursor-pointer disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
            >
              Guardar Paciente
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>,
    document.body
  );
}

/* -------- Selector de médico/fisioterapeuta con foto -------- */
// Un <select> nativo no puede mostrar una foto adentro de sus <option>: por
// eso este es un botón + lista propia, no un <select> de verdad. Muestra la
// misma foto que el resto del sistema (Header, Médicos, Usuarios) junto al
// nombre, para reconocer a la persona de un vistazo y no solo por el nombre.
function SelectorProfesional({ opciones, value, onChange, placeholder, error, disabled }) {
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!abierto || disabled) return undefined;
    const onClickFuera = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAbierto(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', onClickFuera);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto, disabled]);

  const actual = (opciones || []).find((o) => String(o.id_medico) === String(value)) || null;

  const elegir = (id) => {
    onChange(id);
    setAbierto(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setAbierto((v) => !v); }}
        disabled={disabled}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-green-600 ${
          disabled ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'cursor-pointer bg-white dark:bg-slate-900'
        } ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700'}`}
      >
        {actual ? (
          <>
            <Avatar bucket={actual.avatar_bucket} path={actual.avatar_path} nombre={actual.nombre_completo} tamano={30} />
            <span className={`min-w-0 flex-1 truncate font-medium ${disabled ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{actual.nombre_completo}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-slate-400 dark:text-slate-500">{placeholder}</span>
        )}
        {!disabled && (
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        )}
      </button>

      {abierto && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-lg">
          <button
            type="button"
            onClick={() => elegir('')}
            className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            {placeholder}
          </button>
          {(opciones || []).length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">No hay nadie disponible.</p>
          )}
          {(opciones || []).map((o) => (
            <button
              key={o.id_medico}
              type="button"
              onClick={() => elegir(o.id_medico)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <Avatar bucket={o.avatar_bucket} path={o.avatar_path} nombre={o.nombre_completo} tamano={28} />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{o.nombre_completo}</span>
              <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                {o.pacientes_a_cargo} paciente{o.pacientes_a_cargo === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
