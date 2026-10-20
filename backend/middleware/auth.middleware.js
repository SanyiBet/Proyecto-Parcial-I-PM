/**
 * auth.middleware.js
 * Middlewares de seguridad y control de acceso basado en roles (RBAC) para TransOrense.
 */

const { verificarTokenJWT } = require("../services/token.service");

/**
 * Middleware para verificar la validez del token de sesión JWT.
 * Agrega el payload del usuario autenticado en `req.usuario`.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "No autorizado",
      mensaje: "Encabezado de autorización ausente o formato inválido (se requiere: Bearer <token>)",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verificarTokenJWT(token);
    req.usuario = payload; // Contiene: sub (_id), correo, roles, nombre
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token inválido o expirado",
      mensaje: error.message,
    });
  }
}

/**
 * Middleware para control de acceso basado en roles (RBAC).
 * Verifica si el usuario autenticado posee al menos uno de los roles autorizados.
 * 
 * @param {string[]} rolesPermitidos - Lista de roles con permiso (ej. ['administrador', 'agente_boleteria'])
 */
function roleMiddleware(rolesPermitidos = []) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        error: "No autenticado",
        mensaje: "Debe estar autenticado para acceder a este recurso",
      });
    }

    const rolesUsuario = req.usuario.roles || [];

    // Si el usuario es administrador, tiene acceso irrestricto
    if (rolesUsuario.includes("administrador")) {
      return next();
    }

    const tienePermiso = rolesPermitidos.some((rol) => rolesUsuario.includes(rol));

    if (!tienePermiso) {
      return res.status(403).json({
        error: "Acceso denegado",
        mensaje: `No posee los roles requeridos para realizar esta acción. Roles autorizados: [${rolesPermitidos.join(", ")}]`,
      });
    }

    next();
  };
}

module.exports = {
  authMiddleware,
  roleMiddleware,
};
