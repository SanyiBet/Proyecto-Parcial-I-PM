/**
 * pagos.routes.js
 * Rutas de comprobantes de pago y verificación (CARD-17 y CARD-19).
 */

const { Router } = require("express");
const {
  registrarPago,
  obtenerPagoPorReserva,
  listarPagosPendientes,
  aprobarPago,
  rechazarPago,
  obtenerMisPagos,
} = require("../controllers/pagos.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Requiere sesión de usuario
router.use(authMiddleware);

// Registro de pago y consulta propia del cliente
router.post("/", registrarPago);
router.get("/mis-pagos", obtenerMisPagos);
router.get("/reserva/:reserva_id", obtenerPagoPorReserva);

// Bandeja y acciones para Agente de Boletería y Administrador (CARD-19)
router.get("/pendientes", roleMiddleware(["administrador", "agente_boleteria"]), listarPagosPendientes);
router.post("/:id/aprobar", roleMiddleware(["administrador", "agente_boleteria"]), aprobarPago);
router.post("/:id/rechazar", roleMiddleware(["administrador", "agente_boleteria"]), rechazarPago);

module.exports = router;
