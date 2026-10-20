/**
 * token.service.js
 * Servicio de emisión y verificación de Tokens JWT (JSON Web Tokens).
 * Maneja el payload RBAC con identificador UUID v7, correo y roles asignados.
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "transorense_jwt_secret_dev_2026_super_seguro";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Genera un token JWT firmado para la sesión de un usuario de TransOrense.
 * 
 * @param {Object} usuario - Documento del usuario desde MongoDB
 * @param {string} usuario._id - UUID v7 del usuario
 * @param {string} usuario.correo - Correo electrónico
 * @param {string[]} usuario.roles - Array de roles asignados (RBAC)
 * @param {string} [usuario.nombre] - Nombre completo del usuario
 * @returns {string} Token JWT firmado
 */
function generarTokenJWT(usuario) {
  if (!usuario || !usuario._id || !usuario.correo || !Array.isArray(usuario.roles)) {
    throw new Error("El usuario debe tener _id, correo y un array de roles válidos para emitir un JWT");
  }

  const payload = {
    sub: usuario._id,
    correo: usuario.correo,
    roles: usuario.roles,
    nombre: usuario.nombre || "",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

/**
 * Verifica y decodifica un token JWT.
 * 
 * @param {string} token - Token JWT recibido en los headers HTTP (Bearer token)
 * @returns {Object} Payload decodificado si es válido
 * @throws {Error} Si el token es inválido o ha expirado
 */
function verificarTokenJWT(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token no proporcionado o formato inválido");
  }

  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
  });
}

module.exports = {
  generarTokenJWT,
  verificarTokenJWT,
};
