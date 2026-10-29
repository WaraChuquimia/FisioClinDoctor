import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  HeartPulse,
  Plus,
  LogIn,
  Building2,
  Stethoscope,
  KeyRound,
  ArrowLeft,
  MailCheck,
  RotateCcw,
} from 'lucide-react';

import { requestOtp, verifyOtp, signInWithGoogle } from '../lib/auth';
import ModalRecuperarPassword from './ModalRecuperarPassword';
import imgParejaAncianos from '../assets/pareja-de-ancianos-abrazados.jpg';
import { C as THEME } from '../theme';

const HERO_IMG = imgParejaAncianos;
const HERO_POS = '62% 30%';

// Los mismos tokens que usa el resto de la app (cambian solos con el modo
// oscuro) más unos pocos propios del login: el texto sobre la foto y el
// "fade" que la difumina necesitan su propio contraste, no el genérico.
const C = {
  navy:         THEME.navy,
  navySoft:     THEME.body,
  body:         THEME.body,
  muted:        THEME.muted,
  green:        THEME.green,
  greenDeep:    THEME.greenDeep,
  panel:        THEME.pageBg,
  card:         THEME.white,
  border:       THEME.border,
  fieldBg:      THEME.fieldBg,
  fieldBd:      THEME.fieldBd,
  onPhotoTitle: 'var(--login-onPhotoTitle)',
  onPhotoBody:  'var(--login-onPhotoBody)',
  decor:        'var(--login-decor)',
  decorSoft:    'var(--login-decorSoft)',
  fadeRgb:      'var(--login-fade-rgb)',
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.52 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.92-2.14 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const Feature = ({ icon: Icon, title, children, tone = 'green' }) => (
  <div className="flex items-start gap-4">
    <div
      className={`flex h-[clamp(48px,5.9vh,58px)] w-[clamp(48px,5.9vh,58px)] shrink-0 items-center justify-center rounded-[16px] ${
        tone === 'blue'
          ? 'bg-[#E6EFF8] text-[#2A6FA8] dark:bg-[#1B3653] dark:text-[#5B9BD5]'
          : 'bg-[#E4F3EC] text-[#0E7B58] dark:bg-[#1B4E3B] dark:text-[#2FBE85]'
      }`}
    >
      <Icon size={23} strokeWidth={2} />
    </div>

    <div>
      <h3
        className="text-[clamp(15px,2vh,17.5px)] font-bold leading-tight"
        style={{ color: C.onPhotoTitle }}
      >
        {title}
      </h3>
      <p
        className="mt-1 max-w-[250px] text-[clamp(12.5px,1.65vh,14.5px)] font-medium leading-[1.45]"
        style={{ color: C.onPhotoBody }}
      >
        {children}
      </p>
    </div>
  </div>
);

export default function Login({ onLoginSuccess, onOpenSolicitarAcceso }) {
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recuperarOpen, setRecuperarOpen] = useState(false);

  // Estados para OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [correoDestino, setCorreoDestino] = useState('');
  const [cuentaRegresiva, setCuentaRegresiva] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (step === 'otp' && cuentaRegresiva > 0) {
      timer = setInterval(() => setCuentaRegresiva((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, cuentaRegresiva]);

  // Paso 1: Enviar credenciales y disparar código OTP
  const handleSubmitCredentials = async (event) => {
    event.preventDefault();

    if (!username || !password) {
      setError('Ingrese usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await requestOtp(username, password, rememberMe);
      setCorreoDestino(res.email);
      setStep('otp');
      setCuentaRegresiva(60);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setError(err.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  // Manejo de inputs del código OTP
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const nuevoOtp = [...otp];
    nuevoOtp[index] = value.slice(-1);
    setOtp(nuevoOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pegado = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pegado)) {
      setOtp(pegado.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  // Paso 2: Verificar el código OTP
  const handleSubmitOtp = async (event) => {
    event.preventDefault();
    const codigoCompleto = otp.join('');

    if (codigoCompleto.length < 6) {
      setError('Por favor complete los 6 dígitos del código.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sesion = await verifyOtp(correoDestino || username, codigoCompleto, rememberMe);
      onLoginSuccess(sesion);
    } catch (err) {
      setError(err.message || 'Código OTP incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  // Reenviar código OTP
  const handleReenviarOtp = async () => {
    if (cuentaRegresiva > 0 || loading) return;
    setLoading(true);
    setError(null);

    try {
      await requestOtp(username, password, rememberMe);
      setCuentaRegresiva(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Error al reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  const inputClass =
    'h-[clamp(50px,6.4vh,58px)] w-full rounded-[14px] border border-[var(--c-fieldBd)] bg-[var(--c-fieldBg)] ' +
    'pl-[52px] pr-4 text-[clamp(14.5px,1.9vh,16.5px)] text-[var(--c-navy)] placeholder:text-[var(--c-muted)] ' +
    'outline-none transition focus:border-[var(--c-green)] focus:bg-[var(--c-white)] focus:ring-4 focus:ring-[var(--c-green)]/10';

  const labelClass =
    'mb-2 flex items-center gap-2 text-[clamp(13px,1.7vh,15px)] font-bold';

  return (
    <main className="h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans">
      <div className="mx-auto flex h-full w-full max-w-[1600px] overflow-hidden bg-white dark:bg-slate-950">

        {/* PANEL IZQUIERDO */}
        <section
          className="relative hidden h-full w-1/2 shrink-0 overflow-hidden lg:block"
          style={{ backgroundColor: C.panel }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--c-white)_0%,var(--c-white)_34%,var(--c-fieldBg)_56%,var(--c-pageBg)_78%,var(--c-pageBg)_100%)]" />
          <div
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{ backgroundImage: `url('${HERO_IMG}')`, backgroundPosition: HERO_POS }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(100deg, rgba(${C.fadeRgb},.98) 0%, rgba(${C.fadeRgb},.96) 20%, rgba(${C.fadeRgb},.82) 31%, rgba(${C.fadeRgb},.42) 43%, rgba(${C.fadeRgb},.10) 55%, rgba(${C.fadeRgb},0) 66%)`,
            }}
          />

          <div className="relative z-10 flex h-full flex-col px-[clamp(32px,3.4vw,60px)] py-[3.4vh]">
            <header className="flex items-center gap-4">
              <img
                src="/cossmil-logo.png"
                alt="Logo COSSMIL"
                className="h-[clamp(68px,9vh,94px)] w-[clamp(68px,9vh,94px)] shrink-0 object-contain"
              />
              <div>
                <h1
                  className="text-[clamp(27px,3.6vh,36px)] font-extrabold leading-none tracking-[-.02em]"
                  style={{ color: C.greenDeep }}
                >
                  COSSMIL
                </h1>
                <p
                  className="mt-1.5 text-[clamp(13px,1.75vh,16px)] font-semibold"
                  style={{ color: C.onPhotoTitle }}
                >
                  Corporación del Seguro Social Militar
                </p>
                <p
                  className="mt-2 text-[clamp(9.5px,1.3vh,11.5px)] font-semibold uppercase tracking-[.22em]"
                  style={{ color: C.green }}
                >
                  Al servicio de la familia militar
                </p>
              </div>
            </header>

            <div className="mt-[5vh]">
              <div className="mb-[1.8vh] flex gap-1.5">
                <span className="h-[5px] w-12 rounded-full bg-[#2FA36B]" />
                <span className="h-[5px] w-12 rounded-full bg-[#1E5A8A]" />
              </div>

              <h2
                className="text-[clamp(34px,6.2vh,56px)] font-extrabold leading-[.95] tracking-[-.03em]"
                style={{ color: C.navy }}
              >
                Bienvenido a
                <br />
                <span style={{ color: C.green }}>COSSMIL</span>
              </h2>

              <p
                className="mt-[2.1vh] max-w-[330px] text-[clamp(14.5px,2.05vh,19px)] font-semibold leading-[1.35]"
                style={{ color: C.onPhotoBody }}
              >
                Tu plataforma segura para servicios de salud.
              </p>
            </div>

            <div className="mt-[4.2vh] space-y-[2.5vh]">
              <Feature icon={Stethoscope} title="Servicios médicos">
                Agenda tus citas y accede a servicios de salud.
              </Feature>

              <Feature icon={ShieldCheck} title="Seguridad y confidencialidad" tone="blue">
                Protegemos tu información con doble factor de autenticación OTP.
              </Feature>

              <Feature icon={Building2} title="Cobertura nacional">
                Atención en nuestras agencias a nivel nacional.
              </Feature>
            </div>

            <div className="mt-auto pt-[3vh]">
              <p
                className="text-[clamp(23px,3.5vh,33px)] leading-[1.05]"
                style={{ fontFamily: '"Caveat", "Segoe Script", cursive', color: C.navy }}
              >
                Tu salud,
                <br />
                nuestra prioridad
              </p>
              <svg width="225" height="17" viewBox="0 0 215 16" fill="none" className="mt-0.5">
                <path
                  d="M3 11C48 16 130 16 176 7C188 4.5 199 3.5 212 3.5"
                  stroke="#2FA36B"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* PANEL DERECHO */}
        <section
          className="relative flex h-full flex-1 items-center justify-center overflow-hidden px-[clamp(16px,2.2vw,40px)] py-[2.5vh]"
          style={{ backgroundColor: C.panel }}
        >
          <svg
            className="pointer-events-none absolute -right-[12%] -top-[20%] h-[64%] w-[78%]"
            viewBox="0 0 300 300"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M-10 300 C -10 128 128 -10 300 -10" stroke={C.decor} strokeWidth="34" />
          </svg>

          <Plus size={110} strokeWidth={5} className="pointer-events-none absolute -right-8 top-[24%]" style={{ color: C.decor }} />
          <Plus size={84}  strokeWidth={5} className="pointer-events-none absolute -right-5 bottom-[14%]" style={{ color: C.decor }} />
          <Plus size={58}  strokeWidth={5} className="pointer-events-none absolute left-0 bottom-[9%]" style={{ color: C.decorSoft }} />

          <div
            className="relative z-10 w-full max-w-[530px] rounded-[20px] border px-[clamp(28px,3vw,50px)] py-[clamp(28px,4vh,48px)] shadow-[0_16px_50px_rgba(18,60,104,.08)]"
            style={{ borderColor: C.border, backgroundColor: C.card }}
          >

            {step === 'credentials' ? (
              /* PASO 1: CREDENCIALES */
              <>
                <div className="mb-[2.9vh] flex flex-col items-center text-center">
                  <div className="relative mb-[1.7vh] flex h-[clamp(58px,7vh,68px)] w-[clamp(58px,7vh,68px)] items-center justify-center rounded-full border-[2.5px] border-[#1E5A8A]/20">
                    <HeartPulse size={31} strokeWidth={1.9} style={{ color: C.navy }} />
                    <span className="absolute -right-1 -top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full border-2 border-white bg-[#1A8A57]">
                      <Plus size={13} strokeWidth={4} className="text-white" />
                    </span>
                  </div>

                  <h2
                    className="text-[clamp(25px,3.5vh,33px)] font-extrabold tracking-[-.02em]"
                    style={{ color: C.navy }}
                  >
                    Inicio de sesión
                  </h2>
                  <p
                    className="mt-1.5 text-[clamp(14px,1.9vh,17px)]"
                    style={{ color: C.navySoft }}
                  >
                    Accede a tu cuenta COSSMIL
                  </p>
                </div>

                <form onSubmit={handleSubmitCredentials} className="space-y-[1.9vh]">
                  {error && (
                    <div className="flex items-center gap-2 rounded-[10px] border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
                      <AlertCircle size={15} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="username" className={labelClass} style={{ color: C.navy }}>
                      <User size={16} strokeWidth={2.2} />
                      Usuario o correo electrónico
                    </label>
                    <div className="relative">
                      <User size={19} className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="nombre.apellido"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className={labelClass} style={{ color: C.navy }}>
                      <Lock size={15} strokeWidth={2.2} />
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock size={18} className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-[52px]`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[var(--c-muted)] transition hover:text-[var(--c-green)] cursor-pointer"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[clamp(12.5px,1.65vh,14.5px)]">
                    <label className="flex cursor-pointer select-none items-center gap-2.5 font-semibold" style={{ color: C.navy }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-[17px] w-[17px] cursor-pointer rounded accent-[#0E8154]"
                      />
                      Recuérdame
                    </label>

                    <button
                      type="button"
                      onClick={() => setRecuperarOpen(true)}
                      className="font-bold transition hover:underline cursor-pointer"
                      style={{ color: C.green }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-[clamp(50px,6.4vh,58px)] w-full items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(90deg,#0A6540_0%,#0E7A4E_45%,#17A05E_100%)] text-[clamp(15px,1.95vh,17.5px)] font-bold text-white shadow-[0_9px_24px_rgba(14,122,78,.28)] transition hover:brightness-[1.07] active:scale-[.995] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <LogIn size={20} strokeWidth={2.3} />
                        Continuar
                      </>
                    )}
                  </button>
                </form>

                <div className="my-[2.2vh] flex items-center gap-4">
                  <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
                  <span
                    className="whitespace-nowrap text-[clamp(10px,1.3vh,11.5px)] font-bold uppercase tracking-[.14em]"
                    style={{ color: C.muted }}
                  >
                    O continúa con
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  className="flex h-[clamp(50px,6.4vh,58px)] w-full items-center justify-center gap-3 rounded-[14px] border border-[var(--c-fieldBd)] bg-[var(--c-white)] text-[clamp(14px,1.85vh,16px)] font-bold transition hover:border-[var(--c-green)]/30 hover:bg-[var(--c-fieldBg)] cursor-pointer"
                  style={{ color: C.navy }}
                >
                  <GoogleIcon />
                  Ingresar con Google
                </button>

                <p
                  className="mx-auto mt-[2.2vh] max-w-[350px] text-center text-[clamp(12px,1.6vh,13.5px)] leading-[1.5]"
                  style={{ color: C.navySoft }}
                >
                  ¿No tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={onOpenSolicitarAcceso}
                    className="font-bold transition hover:underline cursor-pointer"
                    style={{ color: C.green }}
                  >
                    Solicitar acceso
                  </button>
                </p>
              </>
            ) : (
              /* PASO 2: CÓDIGO OTP (6 DÍGITOS) */
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(null); }}
                  className="mb-3 flex items-center gap-1.5 text-xs font-bold text-[var(--c-body)] hover:text-[var(--c-navy)] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  Volver al inicio de sesión
                </button>

                <div className="mb-[2.9vh] flex flex-col items-center text-center">
                  <div className="relative mb-[1.7vh] flex h-[clamp(58px,7vh,68px)] w-[clamp(58px,7vh,68px)] items-center justify-center rounded-full border-[2.5px] border-[#10b981]/20 bg-emerald-50 dark:bg-emerald-950/30">
                    <MailCheck size={31} strokeWidth={2} className="text-[var(--c-green)]" />
                  </div>

                  <h2
                    className="text-[clamp(23px,3.2vh,30px)] font-extrabold tracking-[-.02em]"
                    style={{ color: C.navy }}
                  >
                    Verificación de seguridad
                  </h2>
                  <p
                    className="mt-1.5 max-w-[340px] text-[clamp(13px,1.75vh,15px)] leading-relaxed text-[var(--c-body)]"
                  >
                    Ingresa el código de 6 dígitos que enviamos a tu correo institucional.
                  </p>
                </div>

                <form onSubmit={handleSubmitOtp} className="space-y-[2.2vh]">
                  {error && (
                    <div className="flex items-center gap-2 rounded-[10px] border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-[12.5px] font-semibold text-red-700 dark:text-red-300">
                      <AlertCircle size={15} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-center text-xs font-bold uppercase tracking-wider text-[var(--c-body)]">
                      Código de 6 dígitos
                    </label>

                    <div className="flex justify-between gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                      {otp.map((digito, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (inputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digito}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="h-14 w-11 sm:w-13 rounded-xl border-2 border-[var(--c-fieldBd)] bg-[var(--c-fieldBg)] text-center text-2xl font-black text-[var(--c-navy)] outline-none transition-all focus:border-[var(--c-green)] focus:bg-[var(--c-white)] focus:ring-4 focus:ring-[var(--c-green)]/10"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.join('').length < 6}
                    className="flex h-[clamp(50px,6.4vh,58px)] w-full items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(90deg,#0A6540_0%,#0E7A4E_45%,#17A05E_100%)] text-[clamp(15px,1.95vh,17.5px)] font-bold text-white shadow-[0_9px_24px_rgba(14,122,78,.28)] transition hover:brightness-[1.07] active:scale-[.995] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <KeyRound size={20} strokeWidth={2.3} />
                        Confirmar y acceder
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    {cuentaRegresiva > 0 ? (
                      <p className="text-xs font-semibold text-[var(--c-muted)]">
                        Reenviar código en <span className="font-bold text-[var(--c-navy)]">{cuentaRegresiva}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReenviarOtp}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--c-green)] hover:underline cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        Reenviar código al correo
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            <p
              className="mx-auto mt-[1.4vh] max-w-[350px] text-center text-[clamp(11px,1.45vh,12.5px)] leading-[1.5]"
              style={{ color: C.muted }}
            >
              Acceso exclusivo para personal de COSSMIL.
            </p>
          </div>
        </section>

        <ModalRecuperarPassword isOpen={recuperarOpen} onClose={() => setRecuperarOpen(false)} />
      </div>
    </main>
  );
}