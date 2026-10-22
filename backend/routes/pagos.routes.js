/**
 * pagos.routes.js
 * Rutas de comprobantes de pago y verificación (CARD-17 y CARD-19).
 */

const { Router } = require("express");
const {
  registrarPago,
  obtenerPagoPorReserva,
  listarPagosPendientes,
} = require("../controllers/pagos.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Requiere sesión de usuario
router.use(authMiddleware);

// Registro de pago por el cliente
router.post("/", registrarPago);
router.get("/reserva/:reserva_id", obtenerPagoPorReserva);

// Bandeja de verificación para Agente de Boletería y Administrador (CARD-19)
router.get("/pendientes", roleMiddleware(["administrador", "agente_boleteria"]), listarPagosPendientes);

module.exports = router;
