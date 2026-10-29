import React, { useState, useRef, useEffect } from 'react';
import { Bell, Moon, Sun, ChevronDown, LogOut, Award, CircleHelp, Menu, User } from 'lucide-react';
import Avatar from './Avatar';
import { C } from '../theme';

/* ==================================================================
   HEADER
   `onToggleSidebar` contrae/expande el Sidebar; el estado vive en
   App.jsx porque ahí también lo necesita el propio Sidebar. Lo mismo
   para `darkMode`/`onToggleDarkMode`: App.jsx es quien pone/saca la
   clase `dark` en <html> y guarda la preferencia.
   ================================================================== */
export default function Header({
  notifications,
  onNotificationClick,
  currentUser,
  onLogout,
  onToggleSidebar,
  darkMode = false,
  onToggleDarkMode = () => {},
  onViewChange = () => {},
}) {
  const [openMenu, setOpenMenu] = useState(null); // 'notif' | 'profile' | null
  const rootRef = useRef(null);

  // Cierra el menú abierto al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!openMenu) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpenMenu(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const activeNotifications = notifications || [];
  const unreadCount = activeNotifications.filter((n) => !n.read).length;

  const getRoleLabel = (role) => {
    if (role === 'superusuario') return 'Superusuario';
    if (role === 'medico_fisiatra') return 'Médico Fisiatra';
    if (role === 'fisioterapeuta') return 'Fisioterapeuta';
    return 'Usuario Clínico';
  };

  const getDisplayName = () => {
    if (!currentUser) return 'Usuario COSSMIL';
    // Si existe la ficha del clínico se usa; si no, el usuario/email.
    return currentUser.nombre_completo || currentUser.nombre_usuario || 'Usuario COSSMIL';
  };

  const toggle = (menu) => setOpenMenu((prev) => (prev === menu ? null : menu));

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center gap-4 border-b bg-white dark:bg-slate-900 px-5 shadow-[0_1px_2px_rgba(16,40,64,.04)]"
      style={{ borderColor: C.border }}
    >
      {/* Animación de entrada de los desplegables. Va aquí y no en
          tailwind.config.js para que el componente sea autocontenido. */}
      <style>{`
        @keyframes cossmilDrop {
          from { opacity: 0; transform: translateY(-6px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cossmil-drop { animation: cossmilDrop .16s ease-out; transform-origin: top right; }
        @media (prefers-reduced-motion: reduce) { .cossmil-drop { animation: none; } }
      `}</style>

      {/* ===================== Hamburguesa ===================== */}
      <button
        type="button"
        onClick={onToggleSidebar}
        title="Menú"
        aria-label="Alternar menú lateral"
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        style={{ color: C.icon }}
      >
        <Menu className="h-[23px] w-[23px]" strokeWidth={2.2} />
      </button>

      {/* ===================== Modo oscuro ===================== */}
      <button
        type="button"
        onClick={onToggleDarkMode}
        title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        aria-label="Alternar modo oscuro"
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        style={{ color: C.icon }}
      >
        {darkMode ? <Sun className="h-[21px] w-[21px]" strokeWidth={2.1} /> : <Moon className="h-[21px] w-[21px]" strokeWidth={2.1} />}
      </button>

      {/* ===================== Controles derecha ===================== */}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        {/* --------- Campana --------- */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('notif')}
            title="Notificaciones"
            className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: C.iconDark }}
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
                style={{ backgroundColor: C.dangerStr }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {openMenu === 'notif' && (
            <div
              className="cossmil-drop absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-white dark:bg-slate-900 py-1 shadow-xl"
              style={{ borderColor: C.border }}
            >
              <div
                className="flex items-center justify-between border-b bg-slate-50 dark:bg-slate-800 px-4 py-2"
                style={{ borderColor: C.border }}
              >
                <span className="text-xs font-semibold" style={{ color: C.navy }}>
                  Notificaciones Clínicas
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {unreadCount} Pendientes
                  </span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {activeNotifications.length === 0 ? (
                  <p className="py-6 text-center text-xs" style={{ color: C.muted }}>
                    No hay nuevas notificaciones
                  </p>
                ) : (
                  activeNotifications.map((notif) => (
                    <button
                      key={notif.id || notif.id_notificacion}
                      type="button"
                      onClick={() => {
                        if (onNotificationClick) onNotificationClick(notif);
                        setOpenMenu(null);
                      }}
                      className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                        !notif.read ? 'bg-emerald-50/60 dark:bg-emerald-900/20' : ''
                      }`}
                    >
                      <p className={`text-xs ${!notif.read ? 'font-semibold' : ''}`} style={{ color: C.navy }}>
                        {notif.text || notif.mensaje}
                      </p>
                      <span className="text-[10px]" style={{ color: C.muted }}>
                        {notif.time ||
                          new Date(notif.fecha_creacion).toLocaleTimeString('es-BO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* --------- Ayuda --------- */}
        <button
          type="button"
          title="Ayuda"
          className="hidden h-10 w-10 cursor-pointer place-items-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 sm:grid"
          style={{ color: C.icon }}
        >
          <CircleHelp className="h-[22px] w-[22px]" strokeWidth={2} />
        </button>

        {/* --------- Perfil --------- */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('profile')}
            className="group flex cursor-pointer items-center gap-3 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Avatar url={currentUser?.avatar_url} nombre={getDisplayName()} tamano={40} />
            <span className="hidden text-left md:block">
              <span className="block text-[15px] font-bold leading-tight" style={{ color: C.navy }}>
                {getDisplayName()}
              </span>
              <span
                className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold leading-tight"
                style={{ color: C.green }}
              >
                <Award className="h-[13px] w-[13px] shrink-0" strokeWidth={2.2} />
                {getRoleLabel(currentUser?.nombre_rol)} - COSSMIL
              </span>
            </span>
            <ChevronDown
              className={`h-[18px] w-[18px] shrink-0 transition-transform ${
                openMenu === 'profile' ? 'rotate-180' : ''
              }`}
              style={{ color: C.icon }}
              strokeWidth={2.2}
            />
          </button>

          {openMenu === 'profile' && (
            <div
              className="cossmil-drop absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-xl"
              style={{ borderColor: C.border }}
            >
              {/* Ficha del usuario */}
              <div className="flex items-center gap-3 border-b px-4 py-3.5" style={{ borderColor: C.border }}>
                <Avatar url={currentUser?.avatar_url} nombre={getDisplayName()} tamano={48} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold leading-tight" style={{ color: C.navy }}>
                    {getDisplayName()}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-[11px] font-semibold leading-tight"
                    style={{ color: C.green }}
                  >
                    {getRoleLabel(currentUser?.nombre_rol)}
                  </span>
                </span>
              </div>

              {/* Sección: ir al perfil */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onViewChange('perfil');
                    setOpenMenu(null);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ color: C.navy }}
                >
                  <User className="h-[17px] w-[17px] shrink-0" style={{ color: C.green }} strokeWidth={2.1} />
                  Mi Perfil
                </button>
              </div>

              {/* Cerrar sesión */}
              <div className="border-t py-1" style={{ borderColor: C.border }}>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-[17px] w-[17px] shrink-0 text-red-500" strokeWidth={2.1} />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}