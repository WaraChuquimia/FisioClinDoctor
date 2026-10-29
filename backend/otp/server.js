import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Orígenes permitidos a llamar este servidor (coma-separados en .env).
// Sin esto, cualquier página en cualquier dominio podía pedirle a este
// servidor que mande correos desde la cuenta de Gmail institucional.
const ORIGENES_PERMITIDOS = (process.env.OTP_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Permite llamadas sin header Origin (curl, health checks locales)
      if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return callback(null, true);
      callback(new Error('Origen no permitido'));
    },
  })
);
app.use(express.json());

// Clave compartida con el frontend (VITE_OTP_SHARED_SECRET). No es un
// secreto perfecto porque viaja en el bundle del navegador, pero bloquea
// el abuso casual/automatizado del endpoint por quien no conoce el proyecto.
const SECRETO_COMPARTIDO = process.env.OTP_SHARED_SECRET;

function verificarSecreto(req, res, next) {
  if (!SECRETO_COMPARTIDO) {
    console.error('[OTP] OTP_SHARED_SECRET no está configurado en backend/otp/.env');
    return res.status(500).json({ error: 'Servidor de OTP mal configurado.' });
  }
  if (req.header('X-Otp-Secret') !== SECRETO_COMPARTIDO) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

// Límite simple por IP en memoria: evita que el endpoint se use para
// mandar correos masivos (spam/phishing) usando la cuenta institucional.
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos
const MAX_POR_VENTANA = 8;
const intentosPorIp = new Map();

function limitarPorIp(req, res, next) {
  const ip = req.ip;
  const ahora = Date.now();
  const historial = (intentosPorIp.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);

  if (historial.length >= MAX_POR_VENTANA) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });
  }

  historial.push(ahora);
  intentosPorIp.set(ip, historial);
  next();
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para puerto 465 con SSL
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CODIGO = /^\d{6}$/;

// Endpoint para enviar el código OTP
app.post('/api/enviar-otp', limitarPorIp, verificarSecreto, async (req, res) => {
  const { email, codigo, nombre } = req.body;

  if (!email || !codigo || !REGEX_EMAIL.test(email) || !REGEX_CODIGO.test(String(codigo))) {
    return res.status(400).json({ error: 'Parámetros inválidos (email, código de 6 dígitos).' });
  }

  console.log(`[OTP] Enviando código a ${email} (${nombre || 'Usuario'})...`);

  try {
    await transporter.sendMail({
      from: `"COSSMIL Fisioterapia" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Código de verificación: ${codigo}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0E8154; margin: 0; font-size: 22px;">COSSMIL</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Medicina Física y Rehabilitación</p>
          </div>

          <p style="color: #1e293b; font-size: 14px;">Hola <b>${nombre || 'Estimado(a)'}</b>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Has solicitado acceder al sistema. Tu código de verificación de 6 dígitos es:</p>

          <div style="text-align: center; margin: 28px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #123C68; background-color: #f1f5f9; padding: 12px 24px; border-radius: 12px; display: inline-block; border: 1px dashed #cbd5e1;">
              ${codigo}
            </span>
          </div>

          <p style="color: #64748b; font-size: 12px; text-align: center;">
            Este código vence en <b>5 minutos</b>. Si tú no solicitaste este acceso, puedes ignorar este correo.
          </p>
        </div>
      `,
    });

    console.log(`[OTP] Correo despachado con éxito a ${email}`);
    res.json({ ok: true, mensaje: 'Correo enviado con éxito.' });
  } catch (error) {
    console.error('[ERROR] Error al enviar el correo:', error);
    res.status(500).json({ error: 'No se pudo enviar el correo', detalle: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor OTP corriendo en http://localhost:${PORT}`);
});
