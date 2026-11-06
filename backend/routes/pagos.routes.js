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
  verComprobanteProtegido,
} = require("../controllers/pagos.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Requiere sesión de usuario
router.use(authMiddleware);

// Visualización protegida bajo LOPDP de comprobante bancario (CARD-32)
router.get("/comprobante/:nombreArchivo", verComprobanteProtegido);

// Registro de pago por el cliente
router.post("/", registrarPago);
router.get("/reserva/:reserva_id", obtenerPagoPorReserva);

// Bandeja y acciones para Agente de Boletería y Administrador (CARD-19)
router.get("/pendientes", roleMiddleware(["administrador", "agente_boleteria"]), listarPagosPendientes);
router.post("/:id/aprobar", roleMiddleware(["administrador", "agente_boleteria"]), aprobarPago);
router.post("/:id/rechazar", roleMiddleware(["administrador", "agente_boleteria"]), rechazarPago);

module.exports = router;
