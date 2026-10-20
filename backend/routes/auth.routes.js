/**
 * auth.routes.js
 * Definición de rutas del módulo de Autenticación de TransOrense.
 */

const { Router } = require("express");
const {
  register,
  login,
  googleAuth,
  completarCedula,
  obtenerPerfil,
} = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = Router();

// Rutas públicas
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);

// Rutas protegidas por sesión JWT
router.post("/completar-cedula", authMiddleware, completarCedula);
router.get("/perfil", authMiddleware, obtenerPerfil);

module.exports = router;
