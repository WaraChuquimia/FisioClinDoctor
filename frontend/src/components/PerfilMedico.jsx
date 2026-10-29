import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, User, KeyRound, X, Check, Trash2 } from 'lucide-react';
import * as api from '../lib/api';
import { TIPOS_FOTO, recortarACuadrado } from '../lib/imagenes';
import ModalCambiarPassword from './ModalCambiarPassword';
import Avatar from './Avatar';
import ConfirmDialog from './ui/ConfirmDialog';
import EncabezadoModulo from './ui/EncabezadoModulo';
import { Field, TextInput } from './ModuloPacientes';
import { C, CARD } from '../theme';

// =============================================================================
// Mi perfil.
// -----------------------------------------------------------------------------
// Lo que el profesional puede cambiar de sí mismo, y solo de sí mismo:
// `fc_medicos_propio_update` compara `id_medico` con `app.id_medico()`.
//
// Lo que NO aparece aquí a propósito: tipo_profesional y cédula profesional.
// De esos dos depende quién puede firmar qué acto clínico —los triggers de
// competencia los consultan— así que los cambia el superusuario, no el titular.
// =============================================================================
export default function PerfilMedico({ sesion, onActualizado, onShowNotification }) {
  // El superusuario no tiene ficha en `medicos` (no atiende pacientes): solo
  // puede editar su nombre para mostrar, nada de especialidad/consultorio/etc.
  const esSuperusuario = sesion.user.nombre_rol === 'superusuario';

  const [datos, setDatos] = useState({
    nombre_completo: '', especialidad: '', telefono: '',
    unidad: '', biografia: '', consultorio: '', horario_atencion: '',
  });
  // El enlace de la foto ya viene resuelto UNA vez en la sesión (auth.js) —
  // no hay que volver a pedirlo acá. `avatarLocal` es el override optimista
  // que se muestra al instante después de subir o quitar, antes de que
  // `onActualizado()` termine de refrescar la sesión entera.
  const [avatarLocal, setAvatarLocal] = useState(undefined);
  const avatar = avatarLocal !== undefined ? avatarLocal : sesion.user.avatar_url;
  useEffect(() => { setAvatarLocal(undefined); }, [sesion.user.avatar_url]);

  const [guardando, setGuardando] = useState(false);
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState(null); // { previewUrl, archivo } | null
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [quitandoFoto, setQuitandoFoto] = useState(false);
  const [confirmQuitarFoto, setConfirmQuitarFoto] = useState(false);
  const inputFoto = useRef(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (esSuperusuario) {
        // Sin ficha en `medicos`: solo hay nombre que cargar, y vive en
        // `usuarios.nombre_completo` (ver auth.js).
        setDatos((d) => ({ ...d, nombre_completo: sesion.user.nombre_completo || '' }));
        return;
      }

      const medicoFila = await api.cargarMedicos().then((ms) => ms.find((m) => m.id_medico === sesion.medico?.id_medico));
      if (!vivo) return;

      setDatos({
        nombre_completo: medicoFila?.nombre_completo || sesion.medico?.nombre_completo || '',
        especialidad: medicoFila?.especialidad || '',
        telefono: medicoFila?.telefono || '',
        unidad: medicoFila?.unidad || '',
        biografia: medicoFila?.biografia || '',
        consultorio: medicoFila?.consultorio || '',
        horario_atencion: medicoFila?.horario_atencion || '',
      });
    })().catch((e) => onShowNotification?.(e.message, 'error'));
    return () => { vivo = false; };
  }, [sesion.user.id_usuario]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (esSuperusuario) {
        await api.actualizarNombreUsuario(datos.nombre_completo);
      } else {
        await api.actualizarPerfilMedico(datos);
      }
      onShowNotification?.('Perfil actualizado');
      await onActualizado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // 1) Elegir el archivo: valida, recorta a cuadrado y muestra la vista
  //    previa — todavía NO sube nada. 2) Confirmar: recién ahí se sube.
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
      // El recorte devuelve un Blob crudo (sin nombre): se envuelve en un
      // File para que `subirAvatar` pueda sacarle la extensión y el tipo.
      const esBlobCrudo = !(fotoPendiente.archivo instanceof File);
      const archivoParaSubir = esBlobCrudo
        ? new File([fotoPendiente.archivo], fotoPendiente.nombreOriginal.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
        : fotoPendiente.archivo;

      const { url } = await api.subirAvatar(sesion.user.id_usuario, archivoParaSubir);
      setAvatarLocal(url || null);
      cancelarFotoPendiente();
      if (url) {
        onShowNotification?.('Foto de perfil actualizada');
      } else {
        // La foto SÍ se subió y se guardó; lo que falló fue solo generar el
        // enlace para mostrarla ahora. No es un error silencioso: se avisa,
        // pero sin decir que la subida falló porque no fue así.
        onShowNotification?.('La foto se guardó, pero no se pudo generar la vista previa. Recarga la página para verla.', 'error');
      }
      await onActualizado?.();
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
      await api.quitarAvatar(sesion.user.id_usuario, sesion.user.avatar_bucket, sesion.user.avatar_path);
      setAvatarLocal(null);
      onShowNotification?.('Foto de perfil eliminada');
      await onActualizado?.();
    } catch (err) {
      onShowNotification?.(err.message, 'error');
    } finally {
      setQuitandoFoto(false);
    }
  };

  const campo = (k) => ({
    value: datos[k],
    onChange: (e) => setDatos((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <div className="animate-slide-in mx-auto max-w-2xl space-y-3 pb-4">
      <EncabezadoModulo icon={User} title="Mi perfil" subtitle="Tus datos de identidad, foto y contraseña de acceso." />

      <form onSubmit={guardar} className={`p-5 ${CARD}`} style={{ borderColor: C.border }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar url={avatar} nombre={datos.nombre_completo} tamano={72} />
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="absolute -bottom-2 -right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white text-white shadow transition-colors"
              style={{ backgroundColor: C.greenDeep }}
              title="Cambiar foto"
            >
              <Camera className="h-4 w-4" />
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setConfirmQuitarFoto(true)}
                disabled={quitandoFoto}
                className="absolute -bottom-2 -left-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white text-white shadow transition-colors disabled:opacity-60"
                style={{ backgroundColor: C.dangerStr }}
                title="Quitar foto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <input
              ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={elegirFoto} className="hidden"
            />
          </div>
          <div className="text-[13px]">
            <p className="font-bold" style={{ color: C.navy }}>{sesion.user.email}</p>
            <p className="text-[12px]" style={{ color: C.muted }}>
              {esSuperusuario
                ? 'Administrador'
                : sesion.medico?.tipo_profesional === 'medico_fisiatra' ? 'Médico fisiatra' : 'Fisioterapeuta'}
            </p>
            <button
              type="button" onClick={() => setMostrarModalPassword(true)}
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              style={{ borderColor: C.fieldBd, color: C.body }}
            >
              <KeyRound className="h-3.5 w-3.5" /> Cambiar contraseña
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre completo"><TextInput required {...campo('nombre_completo')} /></Field>
          </div>
          {!esSuperusuario && (
            <>
              <Field label="Especialidad"><TextInput {...campo('especialidad')} /></Field>
              <Field label="Teléfono"><TextInput {...campo('telefono')} /></Field>
              <Field label="Consultorio"><TextInput placeholder="Ej: Consultorio 3, planta baja" {...campo('consultorio')} /></Field>
              <Field label="Horario de atención"><TextInput placeholder="Ej: Lun a Vie, 08:00–14:00" {...campo('horario_atencion')} /></Field>
              <div className="sm:col-span-2">
                <Field label="Unidad"><TextInput {...campo('unidad')} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Presentación (la lee el paciente en su ficha)">
                  <TextInput as="textarea" rows="2" {...campo('biografia')} />
                </Field>
              </div>
            </>
          )}
        </div>

        <button
          disabled={guardando}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[10px] px-5 py-2.5 text-[13px] font-bold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: C.greenDeep }}
        >
          <Save className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      {mostrarModalPassword && (
        <ModalCambiarPassword
          email={sesion.user.email}
          onClose={() => setMostrarModalPassword(false)}
          onSaved={() => {
            setMostrarModalPassword(false);
            onShowNotification?.('Contraseña actualizada');
          }}
        />
      )}

      {fotoPendiente && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !subiendoFoto) cancelarFotoPendiente(); }}
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl animate-slide-in">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Vista previa de tu foto</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ya se recortó al cuadrado. ¿La usamos?</p>
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
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-60 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarFoto}
                disabled={subiendoFoto}
                className="flex items-center gap-1.5 rounded-lg bg-green-800 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
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
        message="¿Quitar tu foto de perfil? Vas a volver a las iniciales."
        tone="danger"
        confirmLabel="Quitar foto"
        onConfirm={quitarFoto}
        onCancel={() => setConfirmQuitarFoto(false)}
      />
    </div>
  );
}
