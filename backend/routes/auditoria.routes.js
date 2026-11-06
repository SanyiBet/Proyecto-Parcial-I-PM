/**
 * auditoria.routes.js
 * Rutas de Bitácora de Auditoría y Gestión de Incidencias Técnicas.
 */

const { Router } = require("express");
const {
  listarAuditoria,
  reportarIncidencia,
  listarIncidencias,
  actualizarEstadoIncidencia,
} = require("../controllers/auditoria.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Todas las rutas requieren sesión autenticada
router.use(authMiddleware);

// Auditoría: Administradores y Auditores Técnicos pueden consultar bitácoras globales
router.get("/", roleMiddleware(["administrador", "auditor_tecnico"]), listarAuditoria);

// Incidencias: Cualquier usuario autenticado puede reportar, todos pueden listar incidencias
router.post("/incidencias", reportarIncidencia);
router.get("/incidencias", listarIncidencias);
router.patch("/incidencias/:id", roleMiddleware(["administrador", "auditor_tecnico"]), actualizarEstadoIncidencia);

module.exports = router;
