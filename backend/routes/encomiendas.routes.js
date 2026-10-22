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
  rastrearEncomiendaPublico,
  registrarMovimientoEncomienda,
} = require("../controllers/encomiendas.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// ==========================================
// 1. ENDPOINTS PÚBLICOS (Sin autenticación)
// ==========================================

// Cotizador de encomiendas
router.post("/cotizar", cotizarEncomienda);

// Rastreo público por código con protección de datos personales (CARD-21)
router.get("/rastreo/:codigo", rastrearEncomiendaPublico);

// ==========================================
// 2. RUTAS PROTEGIDAS (Requieren JWT activo)
// ==========================================
router.use(authMiddleware);

// Registro de encomienda: solo para personal autorizado
router.post(
  "/",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria"]),
  registrarEncomienda
);

// Gestión y registro de nuevo movimiento físico en la encomienda (CARD-21)
router.post(
  "/:id/movimientos",
  roleMiddleware(["administrador", "operador_encomiendas"]),
  registrarMovimientoEncomienda
);

// Bandeja de encomiendas para operadores
router.get(
  "/",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria"]),
  listarEncomiendas
);

// Detalle por ID interno con historial completo
router.get(
  "/:id",
  roleMiddleware(["administrador", "operador_encomiendas", "agente_boleteria", "cliente"]),
  obtenerEncomiendaPorId
);

module.exports = router;
