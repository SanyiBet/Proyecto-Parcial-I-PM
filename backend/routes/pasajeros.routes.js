/**
 * pasajeros.routes.js
 * Rutas para asignación de pasajeros finales a reservas (CARD-17).
 */

const { Router } = require("express");
const {
  registrarPasajeros,
  obtenerPasajeroPorReserva,
} = require("../controllers/pasajeros.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Requiere sesión de usuario autenticado
router.use(authMiddleware);

router.post("/", registrarPasajeros);
router.get("/reserva/:reserva_id", obtenerPasajeroPorReserva);

module.exports = router;
