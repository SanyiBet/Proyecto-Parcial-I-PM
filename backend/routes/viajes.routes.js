/**
 * viajes.routes.js
 * Rutas para consulta pública de rutas, buses, viajes y mapas de asientos en tiempo real.
 */

const { Router } = require("express");
const {
  obtenerRutas,
  obtenerBuses,
  buscarViajes,
  obtenerMapaAsientos,
} = require("../controllers/viajes.controller");

const router = Router();

// Rutas públicas
router.get("/rutas", obtenerRutas);
router.get("/buses", obtenerBuses);
router.get("/buscar", buscarViajes);
router.get("/:id/asientos", obtenerMapaAsientos);

module.exports = router;
