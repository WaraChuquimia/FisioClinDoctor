# FisioClin — Panel del fisiatra (COSSMIL)

SPA de tele-rehabilitación: panel clínico para el médico fisiatra, el
fisioterapeuta y el superusuario. El paciente no accede a esta herramienta.

## Estructura del repositorio

```
FisioClinDoctor/
├── frontend/          # SPA React (lo único que corre en el navegador)
│   ├── src/
│   ├── public/
│   └── ...
├── backend/            # Todo lo que corre del lado del servidor
│   ├── otp/             # Servidor Node/Express que envía el correo con el código OTP
│   ├── supabase/        # Config del CLI de Supabase + Edge Functions
│   └── sql/              # Esquema de la base de datos y migraciones
├── docs/               # Documentación del proyecto (planes, diagramas, capturas)
└── package.json        # Scripts raíz: delegan a frontend/ y backend/otp/
```

## Stack

- React 19 + Vite 8 (frontend)
- Tailwind CSS 4
- Supabase: Postgres + Auth + Storage + Realtime + Edge Functions (backend)
- Node + Express (servidor de envío de OTP)
- Iconos `lucide-react`
- Lint con `oxlint`

## Cómo está conectado todo

- `frontend/src/lib/auth.js` — login contra Supabase Auth + verificación por
  código OTP de 6 dígitos.
- `frontend/src/lib/api.js` — todas las consultas van contra las
  tablas/vistas/RPCs de Postgres descritas en `backend/sql/`. Los permisos
  los decide Postgres vía Row Level Security (RLS), nunca el frontend.
- `frontend/src/lib/mappers.js` — traductores entre las filas de la base y
  las formas que esperan los componentes.
- `backend/otp/` — microservicio que solo manda el correo con el código OTP
  (el código en sí se genera y valida en Postgres, no aquí).
- `backend/supabase/functions/gestionar-usuario/` — Edge Function que
  crea/desactiva cuentas y resetea contraseñas de terceros; valida que quien
  llama sea superusuario antes de usar la `service_role` key.

### Modo demo — sin backend (desactualizado)

También existen `frontend/src/lib/auth.demo.js` + `api.demo.js` +
`mockDb.js`, pensados para correr **sin Supabase**, con datos de muestra en
memoria (todo se pierde al recargar). Para usarlos hay que renombrarlos para
que reemplacen a `auth.js`/`api.js`. Hoy están desactualizados respecto a
`api.js` (les faltan funciones que los componentes ya usan: adjuntos, altas,
reportes PDF, etc.), así que varias pantallas fallarían si se activan tal
cual.

## Arrancar

```bash
npm install                # instala "concurrently" en la raíz
npm run install:all        # instala dependencias de frontend/ y backend/otp/

cp frontend/.env.example frontend/.env        # completa las llaves de Supabase
cp backend/otp/.env.example backend/otp/.env  # completa Gmail + OTP_SHARED_SECRET
# (OTP_SHARED_SECRET debe ser el mismo valor en ambos .env)

npm run dev        # solo el frontend, http://localhost:5173
npm run dev:all    # frontend + servidor de OTP en paralelo
npm run otp        # solo el servidor de OTP, http://localhost:3001
```

Otros scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Cuentas

El login es real contra Supabase: usuario/contraseña válidos + código OTP
enviado por correo. Los roles (superusuario, fisiatra, fisioterapeuta) se
asignan en la tabla `usuarios` de la base de datos, no en el frontend.
