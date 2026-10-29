import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ShieldCheck, UserPlus, KeyRound, X, ScrollText, RefreshCw,
  Pencil, Users, Eye, EyeOff, Lock, Camera, Trash2, Check,
  Mail, Clock3, FileDown, Loader2, Stethoscope, Activity, User, Bot,
  ListChecks, CalendarRange, Tag, Plus,
} from 'lucide-react';
import { MODULOS, MODULO_LABEL, ROL_LABEL, fmtFechaHora } from '../lib/mappers';
import * as api from '../lib/api';
import { TIPOS_FOTO, recortarACuadrado } from '../lib/imagenes';
import Avatar from './Avatar';
import { C, CARD, TD, BTN, STATUS } from '../theme';
import EncabezadoModulo from './ui/EncabezadoModulo';
import BarraFiltros from './ui/BarraFiltros';
import FilterDropdown from './ui/FilterDropdown';
import Tabla from './ui/Tabla';
import Paginacion from './ui/Paginacion';
import Badge from './ui/Badge';
import ConfirmDialog from './ui/ConfirmDialog';
import { ModalShell, Field, TextInput } from './ModuloPacientes';
import { dibujarEncabezado, dibujarPiePagina, cargarLogoBase64, PDF_COLOR, hoyISO } from '../lib/pdfBranding';

// =============================================================================
// Gestión de usuarios — solo el superusuario.
// -----------------------------------------------------------------------------
// La matriz de permisos es la pieza que el enunciado pedía: "el superusuario
// debe permitir el acceso a ciertos módulos al médico". Cada casilla escribe en
// `usuarios.modulos_permitidos` a través de `fn_definir_modulos`, que exige ser
// superusuario EN LA BASE. Que este componente esté escondido en el frontend no
// es la seguridad; la seguridad es que la RPC rechaza a cualquier otro.
//
// La cuenta de ACCESO (Supabase Auth) es un paso aparte: "Nuevo profesional"
// crea la ficha y, si se le puso contraseña, también la cuenta — de un
// tirón, vía la Edge Function `gestionar-usuario` (necesita la llave
// `service_role`, que nunca puede estar en el navegador). Si se dejó la
// contraseña en blanco, o si entra con Google usando este correo antes de
// que alguien le cree la cuenta, el trigger `trg_auth_usuario_nuevo` lo
// enlaza solo con la ficha que ya existe.
// =============================================================================

const haceTiempo = (iso) => {
  if (!iso) return 'nunca ingresó';
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} mes${meses === 1 ? '' : 'es'}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} año${anios === 1 ? '' : 's'}`;
};

const fechaHoraAuditoria = (valor) => {
  if (!valor) return { fecha: '—', hora: '' };
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return { fecha: '—', hora: '' };
  return {
    fecha: fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
  };
};

// Mientras cualquiera de los modales de este archivo está abierto, la página
// de atrás no debe poder desplazarse: sin esto, la barra de scroll del body
// sigue viva detrás del modal y la tabla "se mueve" por debajo con la rueda
// del mouse o las flechas, algo que ningún otro modal del panel permite.
function useBloquearScrollBody() {
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, []);
}

function ModalNuevoProfesional({ onCerrar, onCreado, onShowNotification }) {
  useBloquearScrollBody();
  const [f, setF] = useState({
    nombre_completo: '', email: '', cedula_profesional: '',
    tipo_profesional: 'fisioterapeuta', especialidad: 'Medicina Física y Rehabilitación',
    telefono: '', password: '',
  });
  const [guardando, setGuardando] = useState(false);
  const esSuperusuario = f.tipo_profesional === 'superusuario';

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.crearProfesional({
        nombre_completo: f.nombre_completo,
        email: f.email,
        cedula_profesional: f.cedula_profesional,
        tipo_profesional: f.tipo_profesional,
        especialidad: f.especialidad,
        telefono: f.telefono,
      });

      // La cuenta de Auth es opcional: sin ella el profesional igual puede
      // entrar con Google, o alguien se la crea después con "Crear cuenta".
      // Si falla acá (correo repetido, la Edge Function no está desplegada,
      // lo que sea) se avisa, pero el alta ya quedó hecha y no se pierde.
      if (f.password) {
        try {
          await api.crearCuentaAcceso({
            email: f.email, password: f.password, nombre: f.nombre_completo,
          });
        } catch (err) {
          onShowNotification?.(
            `Profesional creado, pero la cuenta de acceso no: ${err.message}. Puede entrar con Google.`,
            'error',
          );
        }
      }

      onShowNotification?.(`${f.nombre_completo} dado de alta`);
      await onCreado();
      onCerrar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const campo = (k) => ({
    value: f[k],
    onChange: (e) => setF((v) => ({ ...v, [k]: e.target.value })),
    className: 'mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm font-normal',
  });

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={enviar} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200">Nuevo profesional</h2>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 sm:col-span-2">
            Nombre completo<input required {...campo('nombre_completo')} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 sm:col-span-2">
            Correo (Gmail institucional o personal)
            <input required type="email" placeholder="nombre@gmail.com" {...campo('email')} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 sm:col-span-2">
            Rol
            <select {...campo('tipo_profesional')}>
              <option value="fisioterapeuta">Fisioterapeuta</option>
              <option value="medico_fisiatra">Médico fisiatra</option>
              <option value="superusuario">Administrador (superusuario)</option>
            </select>
          </label>
          {esSuperusuario ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
              El administrador ve y aprueba todo el sistema; no atiende pacientes,
              así que no necesita cédula profesional ni especialidad.
            </p>
          ) : (
            <>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Cédula profesional<input required {...campo('cedula_profesional')} />
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Especialidad<input {...campo('especialidad')} />
              </label>
            </>
          )}
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Teléfono<input {...campo('telefono')} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 sm:col-span-2">
            Contraseña inicial <span className="font-normal text-slate-400 dark:text-slate-500">(opcional: en blanco, entra con Google)</span>
            <input type="text" minLength={8} {...campo('password')} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 p-5">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400">
            Cancelar
          </button>
          <button disabled={guardando} className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {guardando ? 'Creando…' : 'Dar de alta'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

/* ==================================================================
   INTERRUPTOR DE CUENTA (Activo/Inactivo)
   Mismo patrón visual que el de Pacientes, con los tonos de STATUS.
   ================================================================== */
function ToggleActivo({ activo, onToggle }) {
  const tone = STATUS[activo ? 'Activo' : 'Inactivo'];
  return (
    <button
      type="button"
      onClick={onToggle}
      title={activo ? 'Desactivar cuenta' : 'Activar cuenta'}
      aria-pressed={activo}
      className="inline-flex cursor-pointer items-center gap-2"
    >
      <span
        className="relative h-[21px] w-[38px] shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: activo ? tone.dot : C.faded }}
      >
        <span
          className="absolute top-[2.5px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-all"
          style={{ left: activo ? 19.5 : 2.5 }}
        />
      </span>
      <span className="text-[12.5px] font-bold" style={{ color: activo ? tone.color : C.muted }}>
        {activo ? 'Activo' : 'Inactivo'}
      </span>
    </button>
  );
}

/* ==================================================================
   MODAL DE CONTRASEÑA
   Reemplaza el `window.prompt` nativo (feo, sin validación, inconsistente
   con el resto del panel) tanto para "Crear cuenta de acceso" como para
   "Ponerle una contraseña nueva" — mismo formulario, solo cambia el título
   y qué función de la API dispara al aceptar.
   ================================================================== */
function ModalPassword({ usuario, modo, onCerrar, onConfirmar }) {
  useBloquearScrollBody();
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const esCorta = password.length > 0 && password.length < 8;

  const enviar = async (e) => {
    e.preventDefault();
    if (password.length < 8) return;
    setGuardando(true);
    try {
      await onConfirmar(password);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <form onSubmit={enviar} className={`w-full max-w-sm overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: C.mintTile }}>
              <Lock className="h-[18px] w-[18px]" style={{ color: C.green }} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold" style={{ color: C.navy }}>
                {modo === 'crear' ? 'Crear cuenta de acceso' : 'Contraseña nueva'}
              </h2>
              <p className="mt-0.5 text-[11.5px]" style={{ color: C.body }}>
                {usuario.medico_nombre || usuario.paciente_nombre || usuario.nombre_usuario} · {usuario.email}
              </p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: C.muted }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 p-5">
          <label className="block text-[12px] font-bold" style={{ color: C.navy }}>
            {modo === 'crear' ? 'Contraseña inicial' : 'Contraseña nueva'}
            <div className="relative mt-1.5">
              <input
                autoFocus
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-[10px] border py-2.5 pl-3 pr-10 text-[13px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]"
                style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.navy }}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: C.muted }}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {esCorta && (
            <p className="text-[11.5px] font-semibold" style={{ color: C.dangerStr }}>
              Necesita al menos 8 caracteres.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-5" style={{ borderColor: C.border }}>
          <button type="button" onClick={onCerrar} className="cursor-pointer rounded-[10px] border px-4 py-2 text-[12.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" style={{ borderColor: C.fieldBd, color: C.body }}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || password.length < 8}
            className="cursor-pointer rounded-[10px] px-4 py-2 text-[12.5px] font-bold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: C.greenDeep }}
          >
            {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear cuenta' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==================================================================
   MODAL "EDITAR PERFIL"
   Para cuando hay que corregir un dato mal cargado (nombre, cédula,
   especialidad, teléfono, correo, foto o contraseña) sin pasar por "dar de
   baja y crear de nuevo". Solo para médicos/fisioterapeutas y el
   superusuario: el perfil clínico completo del paciente (CI, fecha de
   nacimiento, etc.) se edita desde su propia ficha, en el módulo de
   Pacientes.
   ================================================================== */
function ReadField({ label, value }) {
  return (
    <div className="rounded-[10px] p-2.5" style={{ backgroundColor: C.fieldBg }}>
      <span className="block text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>{label}</span>
      <p className="mt-0.5 truncate text-[13px] font-bold" style={{ color: C.navy }}>{value || '—'}</p>
    </div>
  );
}

function ModalEditarProfesional({ usuario, onCerrar, onGuardar, onCambiarPassword, onAvatarCambiado, onToggleEstado, onShowNotification }) {
  const esMedico = Boolean(usuario.id_medico);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    nombre_completo: usuario.medico_nombre || usuario.nombre_usuario || '',
    email: usuario.email || '',
    cedula_profesional: usuario.cedula_profesional || '',
    especialidad: '',
    telefono: '',
  });
  const [guardando, setGuardando] = useState(false);
  // `especialidad` y `telefono` no vienen en la fila de la lista (ver
  // `cargarFichaMedico`): se piden aparte apenas se abre el modal, para no
  // arrancar el formulario con esos dos campos en blanco.
  const [cargandoFicha, setCargandoFicha] = useState(esMedico);

  useEffect(() => {
    if (!esMedico) return;
    let vivo = true;
    api.cargarFichaMedico(usuario.id_medico)
      .then((ficha) => {
        if (!vivo) return;
        setF((v) => ({
          ...v,
          nombre_completo: ficha.nombre_completo || v.nombre_completo,
          cedula_profesional: ficha.cedula_profesional || v.cedula_profesional,
          especialidad: ficha.especialidad || '',
          telefono: ficha.telefono || '',
        }));
      })
      .finally(() => { if (vivo) setCargandoFicha(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id_medico]);

  // ------------------------------------------------------- FOTO DE PERFIL
  // Mismo flujo de recorte que "Mi perfil" (PerfilMedico.jsx), pero subiendo
  // a nombre de OTRO usuario — `subirAvatar`/`quitarAvatar` ya aceptan
  // cualquier `id_usuario`, no solo el propio.
  const inputFoto = useRef(null);
  const [avatarLocal, setAvatarLocal] = useState(undefined); // undefined = sin cambios; null = se quitó
  const [fotoPendiente, setFotoPendiente] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [quitandoFoto, setQuitandoFoto] = useState(false);
  const [confirmQuitarFoto, setConfirmQuitarFoto] = useState(false);
  const tieneFoto = avatarLocal !== undefined ? Boolean(avatarLocal) : Boolean(usuario.avatar_path);

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    if (!TIPOS_FOTO.includes(archivo.type)) {
      onShowNotification?.('Formato no admitido. Sube una foto JPG, PNG, WEBP o HEIC.', 'error');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      onShowNotification?.('La foto no puede pesar más de 5 MB', 'error');
      return;
    }

    let recortada = archivo;
    try {
      recortada = await recortarACuadrado(archivo);
    } catch {
      // HEIC u otro formato que el navegador no puede dibujar en un canvas:
      // se sube tal cual el original en vez de bloquear todo por esto.
      onShowNotification?.('No se pudo recortar automáticamente esta foto; se subirá tal cual.');
    }
    setFotoPendiente({ archivo: recortada, nombreOriginal: archivo.name, previewUrl: URL.createObjectURL(recortada) });
  };

  const cancelarFotoPendiente = () => {
    if (fotoPendiente?.previewUrl) URL.revokeObjectURL(fotoPendiente.previewUrl);
    setFotoPendiente(null);
  };

  const confirmarFoto = async () => {
    if (!fotoPendiente) return;
    setSubiendoFoto(true);
    try {
      const esBlobCrudo = !(fotoPendiente.archivo instanceof File);
      const archivoParaSubir = esBlobCrudo
        ? new File([fotoPendiente.archivo], fotoPendiente.nombreOriginal.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
        : fotoPendiente.archivo;

      const { url } = await api.subirAvatar(usuario.id_usuario, archivoParaSubir);
      setAvatarLocal(url || null);
      cancelarFotoPendiente();
      onShowNotification?.(url ? 'Foto de perfil actualizada' : 'La foto se guardó, pero no se pudo generar la vista previa.');
      await onAvatarCambiado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async () => {
    setConfirmQuitarFoto(false);
    setQuitandoFoto(true);
    try {
      await api.quitarAvatar(usuario.id_usuario, usuario.avatar_bucket, usuario.avatar_path);
      setAvatarLocal(null);
      onShowNotification?.('Foto de perfil eliminada');
      await onAvatarCambiado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setQuitandoFoto(false);
    }
  };

  const campo = (k) => ({
    value: f[k],
    onChange: (e) => setF((v) => ({ ...v, [k]: e.target.value })),
  });

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar(f);
      setEditing(false);
    } finally {
      setGuardando(false);
    }
  };

  const nombreMostrado = f.nombre_completo || usuario.medico_nombre || usuario.nombre_usuario;

  return (
    <>
      <ModalShell
        wide
        icon={Pencil}
        kicker="Ficha del profesional"
        title={nombreMostrado}
        subtitle={usuario.email}
        badge={ROL_LABEL[usuario.rol] || usuario.rol}
        onClose={onCerrar}
        footer={
          <>
            <span className="mr-auto flex items-center gap-2 text-[12px]" style={{ color: C.muted }}>
              Cuenta activa
              <ToggleActivo activo={usuario.activo} onToggle={onToggleEstado} />
            </span>
            {editing ? (
              <>
                <button type="button" onClick={() => setEditing(false)} className={`${BTN} border px-3.5 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
                  Cancelar
                </button>
                <button type="submit" form="form-editar-profesional" disabled={guardando || cargandoFicha} className={`${BTN} px-3.5 py-1.5 text-white disabled:opacity-60`} style={{ backgroundColor: C.greenDeep }}>
                  <Check className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </>
            ) : (
              <button type="button" onClick={onCerrar} className={`${BTN} border px-3.5 py-1.5`} style={{ borderColor: C.fieldBd, color: C.body }}>
                Cerrar
              </button>
            )}
          </>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* -------- Foto y acceso -------- */}
          <section className="mb-5 flex items-center gap-4 rounded-[12px] p-3.5" style={{ backgroundColor: C.fieldBg }}>
            <div className="relative shrink-0">
              {avatarLocal !== undefined ? (
                <Avatar url={avatarLocal} nombre={nombreMostrado} tamano={68} />
              ) : (
                <Avatar bucket={usuario.avatar_bucket} path={usuario.avatar_path} nombre={nombreMostrado} tamano={68} />
              )}
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                disabled={subiendoFoto}
                className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-white text-white shadow transition-colors disabled:opacity-60"
                style={{ backgroundColor: C.greenDeep }}
                title="Cambiar foto"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              {tieneFoto && (
                <button
                  type="button"
                  onClick={() => setConfirmQuitarFoto(true)}
                  disabled={quitandoFoto}
                  className="absolute -bottom-1 -left-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-white text-white shadow transition-colors disabled:opacity-60"
                  style={{ backgroundColor: C.dangerStr }}
                  title="Quitar foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={inputFoto} type="file" accept={TIPOS_FOTO.join(',')}
                onChange={elegirFoto} className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[.07em]" style={{ color: C.muted }}>Acceso a la cuenta</p>
              <p className="mt-0.5 truncate text-[13.5px] font-bold" style={{ color: C.navy }}>
                {usuario.tiene_cuenta_auth ? 'Habilitado' : 'Sin cuenta todavía'}
              </p>
            </div>

            <button
              type="button"
              onClick={onCambiarPassword}
              className={`${BTN} shrink-0 border px-3 py-2 text-[12.5px]`}
              style={{ borderColor: C.fieldBd, color: C.body, backgroundColor: C.white }}
            >
              <KeyRound className="h-4 w-4" />
              {usuario.tiene_cuenta_auth ? 'Cambiar contraseña' : 'Crear cuenta'}
            </button>
          </section>

          {/* -------- Datos del profesional -------- */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: C.muted }}>
                Datos del profesional
              </h4>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className={`${BTN} border px-2.5 py-1`} style={{ borderColor: C.border, color: C.green }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              )}
            </div>

            {editing ? (
              <form id="form-editar-profesional" onSubmit={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nombre completo"><TextInput value={f.nombre_completo} onChange={campo('nombre_completo').onChange} required /></Field>
                <Field label="Correo"><TextInput type="email" value={f.email} onChange={campo('email').onChange} required /></Field>
                {esMedico && (
                  <>
                    <Field label="Cédula profesional">
                      <TextInput value={f.cedula_profesional} onChange={campo('cedula_profesional').onChange} disabled={cargandoFicha} required />
                    </Field>
                    <Field label="Especialidad">
                      <TextInput value={f.especialidad} onChange={campo('especialidad').onChange} disabled={cargandoFicha} placeholder={cargandoFicha ? 'Cargando…' : ''} />
                    </Field>
                    <Field label="Teléfono">
                      <TextInput value={f.telefono} onChange={campo('telefono').onChange} disabled={cargandoFicha} placeholder={cargandoFicha ? 'Cargando…' : ''} />
                    </Field>
                  </>
                )}
              </form>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ReadField label="Nombre completo" value={nombreMostrado} />
                <ReadField label="Correo" value={usuario.email} />
                {esMedico && (
                  <>
                    <ReadField label="Cédula profesional" value={f.cedula_profesional} />
                    <ReadField label="Especialidad" value={cargandoFicha ? 'Cargando…' : f.especialidad} />
                    <ReadField label="Teléfono" value={cargandoFicha ? 'Cargando…' : f.telefono} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </ModalShell>

      {fotoPendiente && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !subiendoFoto) cancelarFotoPendiente(); }}
        >
          <div className={`w-full max-w-sm animate-slide-in p-5 ${CARD}`} style={{ borderColor: C.border }}>
            <h3 className="text-[14px] font-extrabold" style={{ color: C.navy }}>Vista previa de la foto</h3>
            <p className="mt-1 text-[11.5px]" style={{ color: C.muted }}>Ya se recortó al cuadrado. ¿La usamos?</p>
            <img
              src={fotoPendiente.previewUrl}
              alt="Vista previa de la nueva foto de perfil"
              className="mx-auto mt-4 h-40 w-40 rounded-full object-cover"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelarFotoPendiente}
                disabled={subiendoFoto}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border px-3.5 py-2 text-[12px] font-bold transition-colors disabled:opacity-60"
                style={{ borderColor: C.fieldBd, color: C.body }}
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarFoto}
                disabled={subiendoFoto}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12px] font-bold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: C.greenDeep }}
              >
                <Check className="h-3.5 w-3.5" /> {subiendoFoto ? 'Subiendo…' : 'Usar esta foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmQuitarFoto}
        title="Quitar foto de perfil"
        message={`${nombreMostrado || usuario.email} va a quedar con sus iniciales en vez de la foto.`}
        tone="danger"
        confirmLabel="Quitar foto"
        onConfirm={quitarFoto}
        onCancel={() => setConfirmQuitarFoto(false)}
      />
    </>
  );
}

/* ==================================================================
   MODAL "APROBAR SOLICITUD"
   Pide el rol (médico fisiatra / fisioterapeuta / administrador) y, si no
   es administrador, la cédula profesional — antes de aprobar. Vive acá
   (y no en un módulo aparte) porque "Solicitudes de acceso" se fusionó con
   "Usuarios y permisos": son la misma gestión de personas, no dos pantallas.
   ================================================================== */
function ModalAprobarSolicitud({ solicitud, onCerrar, onConfirmar }) {
  useBloquearScrollBody();
  const [rol, setRol] = useState(solicitud.tipo_profesional || 'medico_fisiatra');
  const [cedula, setCedula] = useState(solicitud.cedula_profesional || '');
  const [especialidad, setEspecialidad] = useState('Medicina Física y Rehabilitación');
  const [guardando, setGuardando] = useState(false);
  const esSuperusuario = rol === 'superusuario';

  const confirmar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onConfirmar(rol, { cedula: esSuperusuario ? null : cedula, especialidad: esSuperusuario ? null : especialidad });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <form onSubmit={confirmar} className={`w-full max-w-md overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: C.mintTile }}>
              <Check className="h-4 w-4" style={{ color: C.green }} strokeWidth={2.2} />
            </span>
            <h2 className="text-[15px] font-extrabold" style={{ color: C.navy }}>Aprobar solicitud</h2>
          </div>
          <button type="button" onClick={onCerrar} className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: C.muted }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          <p className="text-[12.5px]" style={{ color: C.body }}>
            <b style={{ color: C.navy }}>{solicitud.nombre_completo}</b> · {solicitud.email}
          </p>

          <label className="block text-xs font-bold" style={{ color: C.body }}>
            Entra como
            <select
              value={rol} onChange={(e) => setRol(e.target.value)}
              className="mt-1 w-full rounded-[10px] border p-2.5 text-[13px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#0E8154]"
              style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.navy }}
            >
              <option value="medico_fisiatra">Médico fisiatra</option>
              <option value="fisioterapeuta">Fisioterapeuta</option>
              <option value="superusuario">Administrador (superusuario)</option>
            </select>
          </label>

          {esSuperusuario ? (
            <p className="rounded-[10px] p-2.5 text-[11.5px]" style={{ backgroundColor: C.fieldBg, color: C.muted }}>
              El administrador ve y aprueba todo el sistema; no atiende pacientes, así que no necesita cédula profesional ni especialidad.
            </p>
          ) : (
            <>
              <Field label="Cédula profesional"><TextInput required value={cedula} onChange={(e) => setCedula(e.target.value)} /></Field>
              <Field label="Especialidad"><TextInput value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} /></Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: C.border }}>
          <button type="button" onClick={onCerrar} className="cursor-pointer rounded-[10px] border px-4 py-2 text-[12.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" style={{ borderColor: C.fieldBd, color: C.body }}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="cursor-pointer rounded-[10px] px-4 py-2 text-[12.5px] font-bold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: C.greenDeep }}
          >
            {guardando ? 'Aprobando…' : 'Aprobar acceso'}
          </button>
        </div>
      </form>
    </div>
  );
}

const ROL_FILTRO_OPCIONES = {
  medicos: ['Todos', 'Médico Fisiatra', 'Fisioterapeuta'],
  usuarios: ['Todos', 'Médico Fisiatra', 'Fisioterapeuta', 'Superusuario', 'Paciente'],
};

/* ==================================================================
   AUDITORÍA EN LENGUAJE LLANO
   La bitácora guarda jerga técnica (`accion: 'update'`, `tabla: 'usuarios'`)
   porque así la escriben los disparadores de la base — "Entendible por
   todos" quiere decir que ACÁ, en la pantalla, se traduce a una frase
   corriente antes de mostrarla. `categoriaDe` agrupa esa misma jerga en
   unos pocos baldes (Accesos, Cambios de datos, Permisos, Alertas
   automáticas) para el filtro desplegable.
   ================================================================== */
const TABLA_LABEL_AUDITORIA = {
  usuarios: 'una cuenta de usuario',
  medicos: 'un profesional',
  pacientes: 'un paciente',
  citas: 'una cita',
  planes_tratamiento: 'un plan de tratamiento',
  prescripciones_ejercicio: 'una prescripción de ejercicio',
  ejercicios_catalogo: 'un ejercicio del catálogo',
  evaluaciones_goniometro: 'una evaluación con goniómetro',
  altas_paciente: 'un alta',
  sesiones: 'una sesión de ejercicio',
  historial_clinico: 'una nota del historial clínico',
  registro_dolor: 'un registro de dolor',
  metricas_articulares: 'una métrica articular',
  solicitudes_acceso: 'una solicitud de acceso',
  notificaciones: 'notificaciones',
  intentos_login: 'un intento de ingreso',
};

function descripcionEventoAuditoria(b) {
  const tablaTxt = TABLA_LABEL_AUDITORIA[b.tabla] || b.tabla;
  switch (b.accion) {
    case 'insert': return `Creó ${tablaTxt}`;
    case 'update': return `Editó ${tablaTxt}`;
    case 'delete': return `Eliminó ${tablaTxt}`;
    case 'login': return 'Inició sesión en el panel';
    case 'logout': return 'Cerró sesión';
    case 'login_bloqueado': return 'Cuenta bloqueada por intentos fallidos';
    case 'acceso_denegado': return 'Intento de acceso denegado';
    case 'cambio_permisos': return 'Cambió los permisos de un usuario';
    case 'aprobacion_acceso': return 'Aprobó una solicitud de acceso';
    case 'rechazo_acceso': return 'Rechazó una solicitud de acceso';
    case 'recuperacion_password': return 'Pidió recuperar su contraseña';
    case 'cambio_password': return 'Cambió su contraseña';
    case 'reset_forzado': return 'Forzó el reinicio de una contraseña';
    case 'revision_alertas': return 'Revisión automática de alertas';
    case 'rpc': return 'Ejecutó una operación del sistema';
    default: return b.accion;
  }
}

// Icono por tipo de evento — puramente decorativo, ayuda a "escanear" la
// columna Evento de un vistazo sin tener que leer cada frase.
const ICONO_AUDITORIA = {
  insert: Plus, update: Pencil, delete: Trash2, login: KeyRound, logout: KeyRound,
  login_bloqueado: Lock, acceso_denegado: Lock, cambio_permisos: ShieldCheck,
  aprobacion_acceso: Check, rechazo_acceso: X, recuperacion_password: Mail,
  cambio_password: KeyRound, reset_forzado: Lock, revision_alertas: Clock3, rpc: ScrollText,
};

const CATEGORIA_AUDITORIA_OPCIONES = ['Todo', 'Accesos', 'Cambios de datos', 'Permisos', 'Alertas automáticas'];

function categoriaDeAuditoria(b) {
  if (['login', 'logout', 'login_bloqueado', 'acceso_denegado', 'aprobacion_acceso', 'rechazo_acceso', 'recuperacion_password', 'cambio_password', 'reset_forzado'].includes(b.accion)) {
    return 'Accesos';
  }
  if (b.accion === 'cambio_permisos') return 'Permisos';
  if (b.accion === 'revision_alertas') return 'Alertas automáticas';
  return 'Cambios de datos'; // insert/update/delete sobre cualquier tabla
}

// "Tipo de evento" es un segundo filtro, más fino que la categoría: dentro
// de "Accesos" por ejemplo deja elegir solo "Inicios de sesión" o solo
// "Bloqueos por intentos" en vez de ver los siete mezclados.
const ACCION_LABEL_AUDITORIA = {
  insert: 'Creaciones', update: 'Ediciones', delete: 'Eliminaciones',
  login: 'Inicios de sesión', logout: 'Cierres de sesión',
  login_bloqueado: 'Bloqueos por intentos', acceso_denegado: 'Accesos denegados',
  cambio_permisos: 'Cambios de permisos', aprobacion_acceso: 'Aprobaciones de acceso',
  rechazo_acceso: 'Rechazos de acceso', recuperacion_password: 'Solicitudes de recuperación',
  cambio_password: 'Cambios de contraseña', reset_forzado: 'Reinicios forzados',
  revision_alertas: 'Revisiones automáticas', rpc: 'Operaciones del sistema',
};
const TIPO_EVENTO_AUDITORIA_OPCIONES = ['Todos', ...new Set(Object.values(ACCION_LABEL_AUDITORIA))];

const RANGO_FECHAS_AUDITORIA_OPCIONES = ['Todo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días'];
function dentroDeRangoAuditoria(fechaISO, rango) {
  if (rango === 'Todo') return true;
  const fecha = new Date(fechaISO);
  const ahora = new Date();
  if (rango === 'Hoy') return fecha.toDateString() === ahora.toDateString();
  const dias = rango === 'Últimos 7 días' ? 7 : 30;
  return ahora.getTime() - fecha.getTime() <= dias * 24 * 60 * 60 * 1000;
}

// La bitácora solo guarda hechos ya ocurridos — no hay un "en curso" — así
// que "Estado" acá distingue lo que salió bien de lo que no: un bloqueo por
// intentos fallidos o un acceso denegado SON el resultado esperado del
// sistema, pero desde la mirada de quien lo intentó, fallaron.
function estadoDeAuditoria(b) {
  if (b.accion === 'login_bloqueado' || b.accion === 'acceso_denegado') return { label: 'Fallido', tone: 'red' };
  if (b.accion === 'rechazo_acceso') return { label: 'Rechazado', tone: 'amber' };
  return { label: 'Exitoso', tone: 'green' };
}

const ROL_TONE_AUDITORIA = { superusuario: 'blue', medico_fisiatra: 'green', fisioterapeuta: 'slate', paciente: 'amber' };
const ROL_ICONO_AUDITORIA = { superusuario: ShieldCheck, medico_fisiatra: Stethoscope, fisioterapeuta: Activity, paciente: User };
function rolVisualAuditoria(rol) {
  return {
    label: ROL_LABEL[rol] || (rol === 'anonimo' ? 'Anónimo' : rol) || 'Sistema',
    tone: ROL_TONE_AUDITORIA[rol] || 'slate',
    Icono: ROL_ICONO_AUDITORIA[rol] || Bot,
  };
}

function fmtSoloFechaAuditoria(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// La primera palabra de MODULO_LABEL ("Prescripción", "Catálogo"...) no entra
// en una columna de 46px — son palabras sin espacios, así que no pueden
// partirse en dos líneas y terminan superpuestas sobre la columna vecina.
// Un código corto y parejo para las 16 columnas evita eso; el nombre
// completo sigue disponible al pasar el mouse (title).
const MODULO_CODIGO = {
  inicio: 'INI', superadmin: 'ADM', pacientes: 'PAC', ejercicios: 'EJE',
  rutinas: 'RUT', sesiones: 'SES', evolucion: 'EVO', evaluaciones: 'EVA',
  reportes: 'REP', citas: 'CIT', notificaciones: 'AVI', perfil: 'PER',
  usuarios: 'USR', medicos: 'MED', auditoria: 'AUD',
};

function ModalDetalleAuditoria({ evento: b, onCerrar }) {
  const { label: rolLabel, tone: rolTone, Icono: RolIcono } = rolVisualAuditoria(b.rol);
  const estado = estadoDeAuditoria(b);
  const EventoIcono = ICONO_AUDITORIA[b.accion] || ScrollText;

  return (
    <ModalShell icon={ScrollText} kicker="Auditoría" title={descripcionEventoAuditoria(b)} subtitle={fmtFechaHora(b.fecha)} onClose={onCerrar}>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={rolTone}><RolIcono className="h-3 w-3" /> {rolLabel}</Badge>
          <Badge tone={estado.tone}>{estado.label}</Badge>
          <Badge tone="slate"><EventoIcono className="h-3 w-3" /> {ACCION_LABEL_AUDITORIA[b.accion] || b.accion}</Badge>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadField label="Autor" value={b.autor || 'Sistema'} />
          <ReadField label="Registro afectado" value={b.id_registro ? `#${b.id_registro}` : '—'} />
          <ReadField label="Tabla" value={TABLA_LABEL_AUDITORIA[b.tabla] || b.tabla} />
          <ReadField label="Fecha y hora" value={fmtFechaHora(b.fecha)} />
        </dl>

        {b.detalle && (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Detalle</p>
            <p className="rounded-[10px] border p-3 text-[13px]" style={{ borderColor: C.border, color: C.body }}>{b.detalle}</p>
          </div>
        )}

        {(b.datos_antes || b.datos_despues) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {b.datos_antes && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Antes</p>
                <pre className="max-h-48 overflow-auto rounded-[10px] border p-2.5 text-[11px] leading-snug" style={{ borderColor: C.border, color: C.muted, backgroundColor: C.fieldBg }}>
                  {JSON.stringify(b.datos_antes, null, 2)}
                </pre>
              </div>
            )}
            {b.datos_despues && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Después</p>
                <pre className="max-h-48 overflow-auto rounded-[10px] border p-2.5 text-[11px] leading-snug" style={{ borderColor: C.border, color: C.muted, backgroundColor: C.fieldBg }}>
                  {JSON.stringify(b.datos_despues, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export default function GestionUsuarios({ vista = 'usuarios', onShowNotification }) {
  const [usuarios, setUsuarios] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState(false);
  const [modalPassword, setModalPassword] = useState(null); // { usuario, modo: 'crear'|'cambiar' }
  const [modalEditar, setModalEditar] = useState(null);      // usuario | null
  const [cargando, setCargando] = useState(true);
  const [subVistaUsuarios, setSubVistaUsuarios] = useState('usuarios');

  // Solicitudes de acceso pendientes (fusionado acá: ver la nota arriba de
  // ModalAprobarSolicitud).
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [solicitudAAprobar, setSolicitudAAprobar] = useState(null);

  // Auditoría
  const [busquedaAuditoria, setBusquedaAuditoria] = useState('');
  const [categoriaAuditoria, setCategoriaAuditoria] = useState('Todo');
  const [tipoEventoAuditoria, setTipoEventoAuditoria] = useState('Todos');
  const [rangoFechasAuditoria, setRangoFechasAuditoria] = useState('Todo');
  const [eventoAuditoriaAVer, setEventoAuditoriaAVer] = useState(null);
  const [pageAuditoria, setPageAuditoria] = useState(1);
  const [pageSizeAuditoria, setPageSizeAuditoria] = useState(15);
  const [generandoPdfAuditoria, setGenerandoPdfAuditoria] = useState(false);
  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((usuario) => [usuario.id_usuario, usuario])),
    [usuarios],
  );

  const recargar = async () => {
    setCargando(true);
    try {
      const [us, bit] = await Promise.all([
        api.cargarUsuarios(),
        vista === 'auditoria' ? api.cargarBitacora(200) : Promise.resolve([]),
      ]);
      setUsuarios(us || []);
      setBitacora(bit || []);
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const recargarSolicitudes = async () => {
    if (vista !== 'usuarios') return;
    setCargandoSolicitudes(true);
    try {
      setSolicitudes(await api.cargarSolicitudes());
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setCargandoSolicitudes(false);
    }
  };

  useEffect(() => { recargar(); recargarSolicitudes(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vista]);

  // Cada vez que cambian los filtros hay que volver a la página 1: si no,
  // una búsqueda que deja 2 resultados pero deja a alguien parado en la
  // página 4 muestra una tabla vacía sin que se note por qué.
  useEffect(() => { setPage(1); }, [busqueda, rolFiltro, vista]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios
      .filter((u) => (vista === 'medicos' ? u.id_medico != null : true))
      .filter((u) => rolFiltro === 'Todos' || ROL_LABEL[u.rol] === rolFiltro)
      .filter((u) =>
        !q ||
        [u.email, u.nombre_usuario, u.medico_nombre, u.paciente_nombre]
          .filter(Boolean).some((x) => x.toLowerCase().includes(q)),
      );
  }, [usuarios, busqueda, rolFiltro, vista]);

  const totalPages = Math.max(1, Math.ceil(lista.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = lista.slice(from, from + pageSize);

  const resetFiltros = () => {
    setBusqueda('');
    setRolFiltro('Todos');
    setPage(1);
  };

  const alternarModulo = async (u, modulo, valor) => {
    try {
      await api.definirModulos(u.id_usuario, { [modulo]: valor });
      setUsuarios((prev) =>
        prev.map((x) =>
          x.id_usuario === u.id_usuario
            ? { ...x, modulos_permitidos: { ...x.modulos_permitidos, [modulo]: valor } }
            : x,
        ),
      );
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  const alternarEstado = async (u) => {
    try {
      await api.cambiarEstadoUsuario(u.id_usuario, !u.activo);
      onShowNotification?.(`${u.email} ${u.activo ? 'desactivado' : 'reactivado'}`);
      await recargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  // Las dos abren el mismo ModalPassword (ver más abajo); la diferencia la
  // marca `modo`, que decide el título y qué llamada a la API hacer al
  // confirmar.
  const confirmarPassword = async (password) => {
    const { usuario, modo } = modalPassword;
    try {
      if (modo === 'crear') {
        await api.crearCuentaAcceso({ email: usuario.email, password, nombre: usuario.medico_nombre || usuario.nombre_usuario });
        onShowNotification?.('Cuenta de acceso creada. Ya puede iniciar sesión.');
      } else {
        await api.cambiarPasswordDeOtro(usuario.id_usuario, password);
        onShowNotification?.(`Contraseña de ${usuario.email} actualizada. Va a tener que confirmarla la próxima vez que entre.`);
      }
      setModalPassword(null);
      await recargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  // No cierra la ficha: igual que al editar un paciente, guarda y se queda
  // mostrando los datos ya actualizados — recién "Cerrar" la saca de pantalla.
  const guardarEdicion = async (datos) => {
    try {
      await api.actualizarProfesionalComoAdmin(modalEditar, datos);
      onShowNotification?.('Perfil actualizado correctamente.');
      setModalEditar((prev) => prev && ({
        ...prev,
        email: datos.email,
        cedula_profesional: datos.cedula_profesional,
        medico_nombre: prev.id_medico ? datos.nombre_completo : prev.medico_nombre,
        nombre_usuario: prev.id_medico ? prev.nombre_usuario : datos.nombre_completo,
      }));
      await recargar();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  // ------------------------------------------------- SOLICITUDES DE ACCESO
  const confirmarAprobacion = async (rol, { cedula, especialidad }) => {
    try {
      await api.aprobarSolicitud(solicitudAAprobar.id_solicitud, null, null, {
        rol,
        tipo: rol === 'superusuario' ? null : rol,
        cedula,
        especialidad,
      });
      onShowNotification?.(
        rol === 'superusuario'
          ? 'Solicitud aprobada como administrador.'
          : 'Solicitud aprobada. El profesional ya puede entrar con su correo.',
      );
      setSolicitudAAprobar(null);
      await Promise.all([recargar(), recargarSolicitudes()]);
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  const rechazarSolicitud = async (solicitud) => {
    try {
      await api.rechazarSolicitud(solicitud.id_solicitud, null, 'Rechazada desde Usuarios y permisos');
      onShowNotification?.('Solicitud rechazada');
      await recargarSolicitudes();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    }
  };

  // ------------------------------------------------------------- AUDITORÍA
  if (vista === 'auditoria') {
    const bitacoraFiltrada = (() => {
      let lista = bitacora;
      if (categoriaAuditoria !== 'Todo') {
        lista = lista.filter((b) => categoriaDeAuditoria(b) === categoriaAuditoria);
      }
      if (tipoEventoAuditoria !== 'Todos') {
        lista = lista.filter((b) => (ACCION_LABEL_AUDITORIA[b.accion] || b.accion) === tipoEventoAuditoria);
      }
      if (rangoFechasAuditoria !== 'Todo') {
        lista = lista.filter((b) => dentroDeRangoAuditoria(b.fecha, rangoFechasAuditoria));
      }
      const q = busquedaAuditoria.trim().toLowerCase();
      if (!q) return lista;
      return lista.filter((b) =>
        [b.autor, descripcionEventoAuditoria(b), b.detalle, ROL_LABEL[b.rol]]
          .filter(Boolean).some((x) => x.toLowerCase().includes(q)));
    })();
    const totalPaginasAuditoria = Math.max(1, Math.ceil(bitacoraFiltrada.length / pageSizeAuditoria));
    const safePageAuditoria = Math.min(pageAuditoria, totalPaginasAuditoria);
    const fromAuditoria = (safePageAuditoria - 1) * pageSizeAuditoria;
    const filasAuditoria = bitacoraFiltrada.slice(fromAuditoria, fromAuditoria + pageSizeAuditoria);

    const rangoTexto = (() => {
      if (!bitacoraFiltrada.length) return null;
      const fechas = bitacoraFiltrada.map((b) => new Date(b.fecha).getTime()).filter((t) => !Number.isNaN(t));
      if (!fechas.length) return null;
      const desde = fmtSoloFechaAuditoria(Math.min(...fechas));
      const hasta = fmtSoloFechaAuditoria(Math.max(...fechas));
      if (!desde || !hasta) return null;
      return desde === hasta ? desde : `${desde} – ${hasta}`;
    })();

    const limpiarFiltrosAuditoria = () => {
      setBusquedaAuditoria('');
      setCategoriaAuditoria('Todo');
      setTipoEventoAuditoria('Todos');
      setRangoFechasAuditoria('Todo');
      setPageAuditoria(1);
    };

    const generarPdfAuditoria = async () => {
      if (!bitacoraFiltrada.length) return onShowNotification?.('No hay eventos para generar el PDF.', 'error');
      setGenerandoPdfAuditoria(true);
      try {
        const doc = new jsPDF({ orientation: 'landscape' });
        const logo = await cargarLogoBase64();
        const partesTitulo = ['Auditoría del sistema'];
        if (categoriaAuditoria !== 'Todo') partesTitulo.push(categoriaAuditoria);
        if (tipoEventoAuditoria !== 'Todos') partesTitulo.push(tipoEventoAuditoria);
        if (rangoFechasAuditoria !== 'Todo') partesTitulo.push(rangoFechasAuditoria);
        dibujarEncabezado(doc, { logo, titulo: partesTitulo.join(' — ') });
        autoTable(doc, {
          startY: 46,
          head: [['Fecha', 'Autor', 'Rol', 'Evento', 'Registro', 'Detalle', 'Estado']],
          body: bitacoraFiltrada.map((b) => [
            fmtFechaHora(b.fecha), b.autor || '—', rolVisualAuditoria(b.rol).label,
            descripcionEventoAuditoria(b), b.id_registro ?? '—', b.detalle || '—', estadoDeAuditoria(b).label,
          ]),
          styles: { fontSize: 8, cellPadding: 2.8, textColor: [45, 55, 65], lineColor: PDF_COLOR.border, lineWidth: 0.1 },
          headStyles: { fillColor: PDF_COLOR.greenDeep, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
          alternateRowStyles: { fillColor: PDF_COLOR.zebra },
          margin: { top: 46 },
        });
        dibujarPiePagina(doc, { generadoPor: 'Administrador' });
        const sufijo = [categoriaAuditoria, tipoEventoAuditoria].filter((v) => v !== 'Todo' && v !== 'Todos')
          .map((v) => `_${v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')}`).join('');
        doc.save(`auditoria${sufijo}_${hoyISO()}.pdf`);
      } finally {
        setGenerandoPdfAuditoria(false);
      }
    };

    return (
      <div className="space-y-3 pb-4 animate-slide-in">
        <EncabezadoModulo
          icon={ScrollText}
          title="Auditoría"
          subtitle="Todo lo que se hizo en el sistema: altas y cambios de usuarios, pacientes, planes, citas, sesiones, historial clínico y dolor registrado — también lo que hacen los pacientes con la app."
        />

        <BarraFiltros
          searchValue={busquedaAuditoria}
          onSearchChange={(v) => { setBusquedaAuditoria(v); setPageAuditoria(1); }}
          searchPlaceholder="Buscar por autor, evento o detalle..."
          onLimpiar={limpiarFiltrosAuditoria}
          endContent={(
            <button
              type="button"
              onClick={generarPdfAuditoria}
              disabled={generandoPdfAuditoria || !bitacoraFiltrada.length}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-[12.5px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: C.greenDeep }}
            >
              {generandoPdfAuditoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {generandoPdfAuditoria ? 'Generando PDF…' : 'Generar PDF'}
            </button>
          )}
        >
          <FilterDropdown
            icon={CalendarRange}
            label="Rango de fechas"
            value={rangoFechasAuditoria}
            options={RANGO_FECHAS_AUDITORIA_OPCIONES}
            onChange={(v) => { setRangoFechasAuditoria(v); setPageAuditoria(1); }}
          />
          <FilterDropdown
            icon={ScrollText}
            label="Categoría"
            value={categoriaAuditoria}
            options={CATEGORIA_AUDITORIA_OPCIONES}
            onChange={(v) => { setCategoriaAuditoria(v); setPageAuditoria(1); }}
          />
          <FilterDropdown
            icon={Tag}
            label="Tipo de evento"
            value={tipoEventoAuditoria}
            options={TIPO_EVENTO_AUDITORIA_OPCIONES}
            onChange={(v) => { setTipoEventoAuditoria(v); setPageAuditoria(1); }}
          />
        </BarraFiltros>

        <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: C.border, backgroundColor: C.headBg }}>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" style={{ color: C.green }} />
              <h2 className="text-[13px] font-extrabold" style={{ color: C.navy }}>Registros de actividad</h2>
              <Badge tone="slate">Total: {bitacoraFiltrada.length} registros</Badge>
            </div>
            <div className="flex items-center gap-2">
              {rangoTexto && (
                <span className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{rangoTexto}</span>
              )}
              <button
                type="button" onClick={recargar}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border px-2.5 text-[12px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ backgroundColor: C.fieldBg, borderColor: C.fieldBd, color: C.body }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Actualizar
              </button>
            </div>
          </div>

          <Tabla
            minWidth="1060px"
            columnas={[
              { label: 'Fecha y hora' }, { label: 'Autor' }, { label: 'Rol' }, { label: 'Evento' },
              { label: 'Registro' }, { label: 'Detalle' }, { label: 'Estado' }, { label: 'Ver' },
            ]}
            anchos={['w-[155px]', 'w-[190px]', 'w-[140px]', 'w-[230px]', 'w-[100px]', '', 'w-[110px]', 'w-[60px]']}
            filas={filasAuditoria}
            pageSize={pageSizeAuditoria}
            cargando={cargando}
            mensajeVacio="Sin eventos registrados."
            renderFila={(b) => {
              const rolVisual = rolVisualAuditoria(b.rol);
              const estado = estadoDeAuditoria(b);
              const EventoIcono = ICONO_AUDITORIA[b.accion] || ScrollText;
              const fechaHora = fechaHoraAuditoria(b.fecha);
              const usuarioAutor = usuariosPorId.get(b.id_usuario);
              return (
                <tr key={b.id_evento} className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60" style={{ borderColor: C.border }}>
                  <td className={`${TD} whitespace-nowrap`} title={fmtFechaHora(b.fecha)}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-semibold leading-tight" style={{ color: C.navy }}>{fechaHora.fecha}</span>
                      <span className="text-[11px] leading-tight" style={{ color: C.muted }}>{fechaHora.hora}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-2">
                      <Avatar
                        bucket={usuarioAutor?.avatar_bucket || 'avatares'}
                        path={usuarioAutor?.avatar_path}
                        nombre={b.autor}
                        tamano={30}
                      />
                      <span className="truncate text-[12.5px] font-bold" style={{ color: C.navy }}>{b.autor || 'Sistema'}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <Badge tone={rolVisual.tone}>
                      <rolVisual.Icono className="h-3 w-3" /> {rolVisual.label}
                    </Badge>
                  </td>
                  <td className={`${TD} text-[12.5px] font-semibold`} style={{ color: C.body }}>
                    <span className="flex items-center gap-1.5">
                      <EventoIcono className="h-3.5 w-3.5 shrink-0" style={{ color: C.muted }} />
                      {descripcionEventoAuditoria(b)}
                    </span>
                  </td>
                  <td className={`${TD} text-[12px]`} style={{ color: C.muted }}>{b.id_registro ? `#${b.id_registro}` : '—'}</td>
                  <td className={`${TD} max-w-[280px] truncate text-[12px]`} style={{ color: C.muted }}>{b.detalle || '—'}</td>
                  <td className={TD}><Badge tone={estado.tone}>{estado.label}</Badge></td>
                  <td className={TD}>
                    <button
                      type="button" onClick={() => setEventoAuditoriaAVer(b)}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      style={{ borderColor: C.fieldBd, color: C.body }}
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            }}
          />

          <Paginacion
            page={safePageAuditoria}
            totalPages={totalPaginasAuditoria}
            onPageChange={setPageAuditoria}
            total={bitacoraFiltrada.length}
            from={fromAuditoria}
            pageSize={pageSizeAuditoria}
            onPageSizeChange={(n) => { setPageSizeAuditoria(n); setPageAuditoria(1); }}
            etiqueta="eventos"
          />
        </div>

        {eventoAuditoriaAVer && (
          <ModalDetalleAuditoria evento={eventoAuditoriaAVer} onCerrar={() => setEventoAuditoriaAVer(null)} />
        )}
      </div>
    );
  }

  // -------------------------------------------------- USUARIOS Y PERMISOS
  // La matriz de permisos (qué módulo ve cada quién) vive SOLO en "Usuarios y
  // permisos": ahí es donde entran médicos, administradores y pacientes
  // juntos, para comparar y repartir accesos entre todos. La pestaña
  // "Médicos" es la ficha de identidad del profesional — contraseña, cuenta,
  // último ingreso, estado — sin la grilla de 16 casillas, que ahí no pinta
  // nada (el médico no se autogestiona permisos).
  const mostrarPermisos = vista !== 'medicos';

  const columnas = [
    { label: 'Usuario' },
    { label: 'Rol' },
    { label: 'Acceso' },
    { label: 'Último acceso' },
    ...(mostrarPermisos ? MODULOS.map((m) => ({ label: MODULO_CODIGO[m] || m, title: MODULO_LABEL[m] })) : []),
    { label: 'Estado' },
    { label: 'Acciones' },
  ];
  const anchos = mostrarPermisos
    ? [
        '', 'w-[140px]', 'w-[150px]', 'w-[110px]',
        ...MODULOS.map(() => 'w-[54px]'),
        'w-[110px]', 'w-[110px]',
      ]
    : ['w-[30%]', 'w-[16%]', 'w-[14%]', 'w-[15%]', 'w-[13%]', 'w-[12%]'];

  return (
    <div className="space-y-3 pb-4 animate-slide-in">
      <EncabezadoModulo
        icon={ShieldCheck}
        title={vista === 'medicos' ? 'Médicos' : 'Usuarios y permisos'}
        subtitle={
          mostrarPermisos
            ? 'Marca qué módulos ve cada persona (médicos, administradores y pacientes). El cambio es inmediato y queda en la bitácora.'
            : 'Cuentas, contraseñas y último ingreso de cada profesional. Los permisos de módulo se reparten desde "Usuarios y permisos".'
        }
        actionLabel="Nuevo profesional"
        actionIcon={UserPlus}
        onAction={() => setModal(true)}
      />

      {vista === 'usuarios' && (
        <div className="flex gap-2 overflow-x-auto border-b" role="tablist" aria-label="Secciones de usuarios y accesos" style={{ borderColor: C.border }}>
          <button
            type="button"
            role="tab"
            aria-selected={subVistaUsuarios === 'usuarios'}
            onClick={() => setSubVistaUsuarios('usuarios')}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-bold transition-colors ${
              subVistaUsuarios === 'usuarios' ? '' : 'border-transparent'
            }`}
            style={subVistaUsuarios === 'usuarios'
              ? { borderColor: C.green, color: C.green }
              : { color: C.muted }}
          >
            <Users className="h-4 w-4" />
            Usuarios y permisos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subVistaUsuarios === 'accesos'}
            onClick={() => setSubVistaUsuarios('accesos')}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-bold transition-colors ${
              subVistaUsuarios === 'accesos' ? '' : 'border-transparent'
            }`}
            style={subVistaUsuarios === 'accesos'
              ? { borderColor: C.green, color: C.green }
              : { color: C.muted }}
          >
            <ShieldCheck className="h-4 w-4" />
            Control de accesos
            {solicitudes.length > 0 && <Badge tone="amber">{solicitudes.length}</Badge>}
          </button>
        </div>
      )}

      {vista === 'usuarios' && subVistaUsuarios === 'accesos' && (
        <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.border, backgroundColor: C.headBg }}>
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold" style={{ color: C.navy }}>
              <ShieldCheck className="h-4 w-4" style={{ color: C.green }} />
              Accesos: solicitudes pendientes
              {solicitudes.length > 0 && <Badge tone="amber">{solicitudes.length}</Badge>}
            </h2>
            <button
              type="button" onClick={recargarSolicitudes}
              className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: C.muted }}
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${cargandoSolicitudes ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!cargandoSolicitudes && solicitudes.length === 0 && (
            <p className="p-4 text-[12.5px]" style={{ color: C.muted }}>
              No hay solicitudes de acceso pendientes por ahora.
            </p>
          )}

          <div className="divide-y" style={{ borderColor: C.border }}>
            {solicitudes.map((s) => (
              <div key={s.id_solicitud} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: C.greenDeep }}>
                  {(s.nombre_completo || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold" style={{ color: C.navy }}>{s.nombre_completo}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: C.muted }}>
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>
                    {s.cedula_profesional && <span>Matrícula/CI: {s.cedula_profesional}</span>}
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {s.antiguedad}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button" onClick={() => setSolicitudAAprobar(s)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:brightness-110"
                    style={{ backgroundColor: C.greenDeep }}
                  >
                    <Check className="h-3.5 w-3.5" /> Aprobar
                  </button>
                  <button
                    type="button" onClick={() => rechazarSolicitud(s)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ borderColor: C.fieldBd, color: C.dangerStr }}
                  >
                    <X className="h-3.5 w-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(vista !== 'usuarios' || subVistaUsuarios === 'usuarios') && (
        <>
          <BarraFiltros
            searchValue={busqueda}
            onSearchChange={setBusqueda}
            searchPlaceholder="Buscar por nombre o correo..."
            onLimpiar={resetFiltros}
          >
            <FilterDropdown
              icon={Users}
              label="Rol"
              value={rolFiltro}
              options={ROL_FILTRO_OPCIONES[vista] || ROL_FILTRO_OPCIONES.usuarios}
              onChange={setRolFiltro}
            />
          </BarraFiltros>

          <div className={`overflow-hidden ${CARD}`} style={{ borderColor: C.border }}>
        <Tabla
          anchos={anchos}
          minWidth={mostrarPermisos ? '1500px' : '1000px'}
          columnas={columnas}
          filas={pageRows}
          cargando={cargando}
          mensajeVacio="No se encontraron usuarios coincidentes."
          renderFila={(u) => {
            const esSuper = u.rol === 'superusuario';
            // Los pacientes no usan este panel clínico — no hay módulo que
            // tenga sentido concederles, así que su fila nunca tiene nada
            // marcable acá (sí pueden verse, para que el superusuario
            // audite quién es quién, pero sin casillas para tocar).
            const esPaciente = u.rol === 'paciente';
            const esMedico = Boolean(u.id_medico);
            const mods = u.modulos_permitidos || {};
            const nombre = u.medico_nombre || u.paciente_nombre || u.nombre_usuario;
            const celdaClass = vista === 'medicos' ? 'px-3 py-2' : TD;
            const datosProfesional = [
              u.cedula_profesional,
              `${u.pacientes_a_cargo || 0} ${(u.pacientes_a_cargo || 0) === 1 ? 'paciente' : 'pacientes'}`,
            ].filter(Boolean).join(' · ');

            return (
              <tr
                key={u.id_usuario}
                className="border-b transition-colors last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/60"
                style={{ borderColor: C.border }}
              >
                <td className={celdaClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar bucket={u.avatar_bucket} path={u.avatar_path} nombre={nombre} tamano={vista === 'medicos' ? 38 : 32} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold leading-tight" style={{ color: C.navy }}>{nombre}</p>
                      <p className="truncate text-[11.5px] leading-tight" style={{ color: C.muted }}>{u.email}</p>
                      {esMedico && datosProfesional && (
                        <p className="truncate text-[11px] leading-tight" style={{ color: C.faded }}>
                          {datosProfesional}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                <td className={`${celdaClass} text-[12.5px]`} style={{ color: C.body }}>
                  {vista === 'medicos'
                    ? <Badge tone={u.rol === 'medico_fisiatra' ? 'blue' : 'green'}>{ROL_LABEL[u.rol] || u.rol}</Badge>
                    : ROL_LABEL[u.rol] || u.rol}
                </td>

                <td className={celdaClass}>
                  {(esMedico || esSuper) ? (
                    // Para médicos y el administrador, cambiar la contraseña o
                    // crear la cuenta ya se hace desde "Editar" (Acciones): acá
                    // solo se informa el estado, sin un botón duplicado.
                    <Badge tone={u.tiene_cuenta_auth ? 'green' : 'amber'}>
                      {u.tiene_cuenta_auth ? 'Habilitado' : 'Sin cuenta'}
                    </Badge>
                  ) : u.tiene_cuenta_auth ? (
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone="green">Habilitado</Badge>
                      <button
                        type="button"
                        onClick={() => setModalPassword({ usuario: u, modo: 'cambiar' })}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[8px] border px-2 py-1 text-[11px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                        style={{ borderColor: C.border, color: C.body }}
                        title="Ponerle una contraseña nueva"
                      >
                        <KeyRound className="h-3 w-3" /> Contraseña
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalPassword({ usuario: u, modo: 'crear' })}
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[8px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"
                      title="Crear la cuenta de Supabase Auth con una contraseña inicial"
                    >
                      <KeyRound className="h-3 w-3" /> Sin cuenta
                    </button>
                  )}
                </td>

                <td className={`${celdaClass} text-[12px]`} style={{ color: C.muted }}>{haceTiempo(u.ultimo_acceso)}</td>

                {mostrarPermisos && MODULOS.map((m) => (
                  <td key={m} className={`${TD} text-center`}>
                    <input
                      type="checkbox"
                      disabled={esSuper || esPaciente}
                      checked={esSuper ? true : esPaciente ? false : mods[m] === true}
                      onChange={(e) => alternarModulo(u, m, e.target.checked)}
                      className="h-4 w-4 accent-green-800 disabled:opacity-40"
                      title={
                        esSuper ? 'El superusuario siempre tiene todo'
                          : esPaciente ? 'Los pacientes no usan este panel: no tienen módulos que conceder'
                            : MODULO_LABEL[m]
                      }
                    />
                  </td>
                ))}

                <td className={celdaClass}>
                  <ToggleActivo activo={u.activo} onToggle={() => alternarEstado(u)} />
                </td>

                <td className={celdaClass}>
                  {(esMedico || esSuper) ? (
                    <button
                      type="button"
                      onClick={() => setModalEditar(u)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-[var(--c-green)] hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20"
                      style={{ borderColor: C.border, color: C.navy }}
                      title="Editar perfil"
                    >
                      <Pencil className="h-[13px] w-[13px]" style={{ color: C.green }} strokeWidth={2} />
                      Editar
                    </button>
                  ) : (
                    <span className="text-[12px]" style={{ color: C.faded }}>—</span>
                  )}
                </td>
              </tr>
            );
          }}
        />

        <Paginacion
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          total={lista.length}
          from={from}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          etiqueta={vista === 'medicos' ? 'profesionales' : 'usuarios'}
        />
          </div>
        </>
      )}

      {modal && (
        <ModalNuevoProfesional
          onCerrar={() => setModal(false)}
          onCreado={recargar}
          onShowNotification={onShowNotification}
        />
      )}

      {modalPassword && (
        <ModalPassword
          usuario={modalPassword.usuario}
          modo={modalPassword.modo}
          onCerrar={() => setModalPassword(null)}
          onConfirmar={confirmarPassword}
        />
      )}

      {modalEditar && (
        <ModalEditarProfesional
          usuario={modalEditar}
          onCerrar={() => setModalEditar(null)}
          onGuardar={guardarEdicion}
          onShowNotification={onShowNotification}
          onAvatarCambiado={recargar}
          onToggleEstado={async () => {
            await alternarEstado(modalEditar);
            setModalEditar((prev) => prev && { ...prev, activo: !prev.activo });
          }}
          onCambiarPassword={() => {
            setModalPassword({ usuario: modalEditar, modo: modalEditar.tiene_cuenta_auth ? 'cambiar' : 'crear' });
            setModalEditar(null);
          }}
        />
      )}

      {solicitudAAprobar && (
        <ModalAprobarSolicitud
          solicitud={solicitudAAprobar}
          onCerrar={() => setSolicitudAAprobar(null)}
          onConfirmar={confirmarAprobacion}
        />
      )}
    </div>
  );
}
