/**
 * hash.service.js
 * Servicio de hashing criptográfico seguro utilizando Argon2id.
 * Sigue las recomendaciones de OWASP Password Storage Cheat Sheet.
 */

const argon2 = require("argon2");

/**
 * Parámetros recomendados por OWASP para Argon2id:
 * - type: argon2id (híbrido resistente a side-channel attacks y ataques GPU/ASIC)
 * - memoryCost: 65536 KiB (64 MB de memoria)
 * - timeCost: 3 iteraciones
 * - parallelism: 1 hilo
 */
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

/**
 * Genera un hash seguro Argon2id para una contraseña en texto plano.
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Hash generado con sal y metadatos integrados
 */
async function hashearPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("La contraseña a hashear debe ser una cadena no vacía");
  }
  return await argon2.hash(password, ARGON2_CONFIG);
}

/**
 * Verifica si una contraseña en texto plano coincide con su hash Argon2id.
 * Resistente a ataques de temporización (timing attacks).
 * @param {string} hash - Hash almacenado en la base de datos
 * @param {string} password - Contraseña en texto plano provista en el login
 * @returns {Promise<boolean>} True si coincide, false en caso contrario
 */
async function verificarPassword(hash, password) {
  if (!hash || !password) {
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("❌ Error en verificación Argon2id:", error.message);
    return false;
  }
}

module.exports = {
  hashearPassword,
  verificarPassword,
};
