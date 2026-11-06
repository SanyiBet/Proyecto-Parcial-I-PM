/**
 * rate-limit.middleware.js
 * Limitadores de tasa (Rate Limiting) para TransOrense (CARD-33).
 * Protege endpoints críticos contra fuerza bruta y acaparamiento de recursos.
 */

const { rateLimit } = require("express-rate-limit");

/**
 * Limitador estricto para endpoints de autenticación (/api/auth/login, /api/auth/register).
 * Restringe a un máximo de 10 peticiones por minuto por dirección IP.
 */
const limiterAuth = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 10, // Máximo 10 solicitudes por ventana
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: "Demasiados intentos de autenticación",
    mensaje: "Ha superado el límite permitido de 10 solicitudes por minuto. Por favor intente más tarde.",
    statusCode: 429,
  },
  skip: (req) => req.method === "OPTIONS" || (process.env.NODE_ENV === "test" && req.headers["x-bypass-ratelimit"] === "true"),
});

/**
 * Limitador para operaciones de reserva de asientos (/api/reservas).
 * Restringe a un máximo de 20 peticiones por minuto por IP para prevenir acaparamiento masivo.
 */
const limiterReservas = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 20, // Máximo 20 solicitudes por ventana
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: "Límite de solicitudes de reserva excedido",
    mensaje: "Ha superado la tasa máxima permitida de reservas (20 por minuto). Por favor espere un momento.",
    statusCode: 429,
  },
  skip: (req) => req.method === "OPTIONS" || (process.env.NODE_ENV === "test" && req.headers["x-bypass-ratelimit"] === "true"),
});

/**
 * Limitador general preventivo para toda la API de TransOrense.
 * Restringe a un máximo de 100 peticiones por minuto por IP.
 */
const limiterGeneral = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 100, // Máximo 100 solicitudes por ventana
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: "Demasiadas solicitudes",
    mensaje: "Ha excedido la tasa general de consultas permitidas. Por favor disminuya la frecuencia.",
    statusCode: 429,
  },
  skip: (req) => req.method === "OPTIONS" || (process.env.NODE_ENV === "test" && req.headers["x-bypass-ratelimit"] === "true"),
});

module.exports = {
  limiterAuth,
  limiterReservas,
  limiterGeneral,
};
