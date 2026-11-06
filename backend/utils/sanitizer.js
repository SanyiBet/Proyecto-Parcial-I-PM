/**
 * sanitizer.js
 * Utilidades de Sanitización y Blindaje contra Inyecciones ReDoS (CARD-31).
 * Neutraliza metacaracteres reservados en consultas regex sobre MongoDB.
 */

/**
 * Escapa todos los metacaracteres especiales de expresiones regulares
 * evitando ataques de Denegación de Servicio por Expresiones Regulares (ReDoS)
 * y excepciones de sintaxis por caracteres no emparejados como '(' o '['.
 * 
 * @param {string} texto - Cadena sin procesar proveniente de la petición del cliente
 * @returns {string} Cadena sanitizada segura para usar en RegExp o $regex
 */
function escapeRegex(texto) {
  if (typeof texto !== "string") return "";
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  escapeRegex,
};
