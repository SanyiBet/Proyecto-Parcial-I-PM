/**
 * encomiendas.routes.js
 * Rutas de Cotización y Registro de Encomiendas (CARD-20).
 */

const { Router } = require("express");
const {
  cotizarEncomienda,
  registrarEncomienda,
  listarEncomiendas,
  obtenerEncomiendaPorId,
} = require("../controllers/encomiendas.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// 1. Endpoint público: Calculadora / Cotizador de Encomiendas
router.post("/cotizar", cotizarEncomienda);

// 2. Rutas protegidas (Requieren sesión activa)
router.use(authMiddleware);

// Registro de encomienda: solo para personal autorizado
router.post(
  "/",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria"]),
  registrarEncomienda
);

// Bandeja de encomiendas
router.get(
  "/",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria"]),
  listarEncomiendas
);

// Detalle por ID interno
router.get(
  "/:id",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria", "cliente"]),
  obtenerEncomiendaPorId
);

module.exports = router;
