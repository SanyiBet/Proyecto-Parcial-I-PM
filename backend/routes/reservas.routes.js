/**
 * reservas.routes.js
 * Rutas protegidas para reservas de asientos con control de concurrencia y temporizador de 10 minutos.
 */

const { Router } = require("express");
const {
  crearReservaTemporal,
  obtenerReservaActiva,
  cancelarReserva,
} = require("../controllers/reservas.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Todas las operaciones de reserva requieren sesión activa
router.use(authMiddleware);

router.post("/", crearReservaTemporal);
router.get("/activa", obtenerReservaActiva);
router.post("/:id/cancelar", cancelarReserva);

module.exports = router;
