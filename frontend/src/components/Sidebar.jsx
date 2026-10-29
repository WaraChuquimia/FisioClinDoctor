import React from 'react';
import {
  Home, Users, Dumbbell, ClipboardList, Calendar, LineChart, Stethoscope,
  UserCog, Bell, CalendarClock, ScrollText, UserCircle, Ruler,
  FileBarChart2,
} from 'lucide-react';
import { SIDEBAR as C } from '../theme';

const LOGO_SRC = '/cossmil-logo.png';

/* ==================================================================
   MÓDULOS
   La clave de cada módulo es la misma de `usuarios.modulos_permitidos`.
   Si el superusuario desmarca la casilla, la entrada desaparece de aquí
   y además la base rechaza la consulta: no es solo que no se vea el botón.
   ================================================================== */
const MODULES = {
  inicio:         { label: 'Inicio', icon: Home },
  superadmin:     { label: 'Inicio', icon: Home },
  pacientes:      { label: 'Pacientes', icon: Users },
  medicos:        { label: 'Médicos', icon: Stethoscope },
  usuarios:       { label: 'Usuarios y Permisos', icon: UserCog },
  rutinas:        { label: 'Prescripción de Rutinas', icon: ClipboardList },
  ejercicios:     { label: 'Catálogo de Ejercicios', icon: Dumbbell },
  citas:          { label: 'Agenda de Controles', icon: CalendarClock },
  sesiones:       { label: 'Sesiones y Repeticiones', icon: Calendar },
  evolucion:      { label: 'Evolución Clínica', icon: LineChart },
  evaluaciones:   { label: 'Evaluaciones', icon: Ruler },
  reportes:       { label: 'Reportes', icon: FileBarChart2 },
  auditoria:      { label: 'Auditoría', icon: ScrollText },
  notificaciones: { label: 'Mensajes y Avisos', icon: Bell },
  perfil:         { label: 'Mi Perfil', icon: UserCircle },
};

// Mismas secciones para ambos roles; solo cambia qué módulos entran.
const SUPER_GROUPS = [
  ['General',        ['superadmin', 'pacientes', 'medicos', 'usuarios', 'auditoria']],
  ['Rehabilitación', ['rutinas', 'ejercicios', 'citas', 'sesiones', 'evolucion', 'evaluaciones', 'reportes']],
  ['Sistema',        ['notificaciones', 'perfil']],
];

const DOCTOR_GROUPS = [
  ['General',        ['inicio', 'pacientes']],
  ['Rehabilitación', ['rutinas', 'ejercicios', 'citas', 'sesiones', 'evolucion', 'evaluaciones', 'reportes']],
  ['Sistema',        ['notificaciones', 'perfil']],
];

/* ================= Ondas decorativas del fondo ================= */
function BackdropWaves() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] w-full"
      viewBox="0 0 272 330"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 78 C 78 116, 168 56, 272 22 L272 330 L0 330 Z" fill="rgba(255,255,255,.10)" />
      <path d="M0 158 C 90 192, 176 130, 272 100 L272 330 L0 330 Z" fill="rgba(255,255,255,.075)" />
      <path d="M0 238 C 96 268, 180 208, 272 182 L272 330 L0 330 Z" fill="rgba(255,255,255,.055)" />
    </svg>
  );
}

export default function Sidebar({
  currentView,
  onViewChange,
  sidebarOpen = true,
  currentUser,
  badges = {},
}) {
  const isSuper = currentUser?.nombre_rol === 'superusuario';
  const permissions = currentUser?.permissions || {};

  const isAllowed = (moduleId) => isSuper || permissions[moduleId] !== false;

  // Arma las secciones del rol y descarta las que se quedan sin módulos
  // porque el superusuario revocó los permisos.
  const groups = (isSuper ? SUPER_GROUPS : DOCTOR_GROUPS)
    .map(([title, ids]) => [title, ids.filter((id) => MODULES[id] && isAllowed(id))])
    .filter(([, ids]) => ids.length > 0);

  const renderNavItem = (id) => {
    const { label, icon: Icon } = MODULES[id];
    const active = currentView === id;
    const count = badges[id] ?? null;

    return (
      <button
        key={id}
        type="button"
        onClick={() => onViewChange(id)}
        title={!sidebarOpen ? label : undefined}
        className={`group relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-[11px] py-[9px] text-left text-[13px] transition-colors duration-200 ${
          sidebarOpen ? 'px-2.5' : 'justify-center px-0'
        } ${
          active
            ? 'font-bold shadow-[0_4px_14px_rgba(0,0,0,.22)]'
            : 'font-semibold hover:bg-white/[.06]'
        }`}
        style={
          active
            ? { background: `linear-gradient(100deg, ${C.activeFrom}, ${C.activeTo})`, color: C.activeText }
            : { color: C.itemText }
        }
      >
        {/* Barra de acento — altura completa, aparece en hover */}
        {!active && (
          <span
            className="absolute inset-y-0 left-0 w-[3px] scale-x-0 rounded-r-[2px] transition-transform duration-200 group-hover:scale-x-100"
            style={{ backgroundColor: C.accent, transformOrigin: 'left' }}
          />
        )}

        <span className="relative shrink-0">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
          {/* Colapsado: el badge se reduce a un punto sobre el icono */}
          {!sidebarOpen && count != null && (
            <span
              className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
              style={{ backgroundColor: C.badge, boxShadow: `0 0 0 2px ${C.bgMid}` }}
            />
          )}
        </span>

        {sidebarOpen && (
          <>
            <span className="truncate">{label}</span>
            {count != null && (
              <span
                className="ml-auto grid h-[19px] min-w-[19px] shrink-0 place-items-center rounded-full px-1.5 text-[10.5px] font-bold text-white"
                style={{ backgroundColor: C.badge }}
              >
                {count}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`sticky top-0 relative flex h-screen shrink-0 flex-col overflow-hidden text-white transition-[width] duration-300 ${
        sidebarOpen ? 'w-[272px]' : 'w-[84px]'
      }`}
      style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgMid} 48%, ${C.bgBot} 100%)` }}
    >
      {/* Scrollbar discreta sobre fondo oscuro */}
      <style>{`
        .cossmil-scroll::-webkit-scrollbar { width: 5px; }
        .cossmil-scroll::-webkit-scrollbar-track { background: transparent; }
        .cossmil-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.13); border-radius: 999px;
        }
        .cossmil-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.26); }
        .cossmil-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.16) transparent; }
      `}</style>

      <BackdropWaves />

      {/* ======================= Marca ======================= */}
      <div
        className={`relative z-10 shrink-0 border-b ${sidebarOpen ? 'px-4 pb-4 pt-5' : 'px-0 py-5'}`}
        style={{ borderColor: C.divider }}
      >
        <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
          <img
            src={LOGO_SRC}
            alt="Logo COSSMIL"
            className={`shrink-0 object-contain ${sidebarOpen ? 'h-[62px] w-[62px]' : 'h-11 w-11'}`}
          />
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] font-extrabold uppercase leading-none tracking-[.01em] text-white">
                COSSMIL
              </h1>
              <p
                className="mt-[3px] truncate text-[9.5px] font-semibold leading-tight"
                style={{ color: C.brandSub }}
              >
                Corporación del Seguro Social Militar
              </p>
              <span className="my-[5px] block h-px w-full" style={{ backgroundColor: C.brandRule }} />
              <p
                className="truncate text-[9px] font-bold uppercase leading-tight tracking-[.05em]"
                style={{ color: C.gold }}
              >
                Al servicio de la familia militar
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ======================= Navegación ======================= */}
      <nav className="cossmil-scroll relative z-10 flex-grow overflow-y-auto px-2.5 pb-6 pt-4">
        {groups.map(([title, ids]) => (
          <div key={title} className="mb-5 last:mb-0">
            <p
              className={`mb-1.5 px-2 text-[9.5px] font-bold uppercase leading-none tracking-[.16em] ${
                sidebarOpen ? '' : 'sr-only'
              }`}
              style={{ color: C.groupLabel }}
            >
              {title}
            </p>
            <div className="space-y-[3px]">{ids.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>
    </aside>
  );
}