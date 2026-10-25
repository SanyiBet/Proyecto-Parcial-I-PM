/**
 * admin.routes.js
 * Rutas protegidas exclusivamente para usuarios con rol 'administrador' (CARD-26).
 */

const { Router } = require("express");
const {
  obtenerMetricasDashboard,
  listarUsuarios,
  actualizarRolUsuario,
  crearRuta,
  alternarEstadoRuta,
  crearBus,
} = require("../controllers/admin.controller");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Todas las rutas requieren sesión autenticada con rol administrador
router.use(authMiddleware);
router.use(roleMiddleware(["administrador"]));

// Métricas y KPIs globales
router.get("/metricas", obtenerMetricasDashboard);

// Gestión de usuarios y roles RBAC
router.get("/usuarios", listarUsuarios);
router.patch("/usuarios/:id/rol", actualizarRolUsuario);

// Gestión de recursos: Rutas y Buses
router.post("/rutas", crearRuta);
router.patch("/rutas/:id/estado", alternarEstadoRuta);
router.post("/buses", crearBus);

module.exports = router;
