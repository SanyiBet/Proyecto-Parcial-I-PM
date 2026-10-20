/**
 * test-card08-09.js
 * Pruebas automatizadas para [CARD-08] y [CARD-09]:
 * - Middlewares de autorización y control de acceso por roles (RBAC).
 * - Bypass de seguridad para administradores.
 * - Validación de respuestas de los middlewares ante accesos no autorizados.
 */

const assert = require("node:assert");
const { authMiddleware, roleMiddleware } = require("../middleware/auth.middleware");
const { generarTokenJWT } = require("../services/token.service");

// Helper para simular objetos req, res, next de Express
function crearMockHttp({ headers = {}, usuario = null } = {}) {
  const req = { headers, usuario };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  let nextLlamado = false;
  const next = () => {
    nextLlamado = true;
  };

  return { req, res, next, getNextLlamado: () => nextLlamado };
}

async function ejecutarPruebas() {
  console.log("🧪 Iniciando pruebas para CARD-08 y CARD-09 (RBAC y Middlewares)...\n");

  // --- 1. PRUEBAS DE AUTHMIDDLEWARE ---
  console.log("🔹 1. Probando rechazo de petición sin encabezado Authorization...");
  const mockSinAuth = crearMockHttp();
  authMiddleware(mockSinAuth.req, mockSinAuth.res, mockSinAuth.next);
  assert.strictEqual(mockSinAuth.res.statusCode, 401, "Debe retornar 401 sin header");
  assert.strictEqual(mockSinAuth.getNextLlamado(), false, "No debe invocar next()");
  console.log("  ✅ authMiddleware rechaza peticiones sin token.");

  console.log("🔹 2. Probando aceptación con token JWT válido...");
  const usuarioCliente = {
    _id: "018f3a2c-7b44-7f12-9c12-3456789abcde",
    correo: "cliente@transorense.com",
    roles: ["cliente"],
    nombre: "Cliente Pasajero",
  };
  const tokenValido = generarTokenJWT(usuarioCliente);
  const mockConToken = crearMockHttp({
    headers: { authorization: `Bearer ${tokenValido}` },
  });

  authMiddleware(mockConToken.req, mockConToken.res, mockConToken.next);
  assert.strictEqual(mockConToken.getNextLlamado(), true, "Debe invocar next() con token válido");
  assert.strictEqual(mockConToken.req.usuario.sub, usuarioCliente._id, "Debe inyectar req.usuario");
  console.log("  ✅ authMiddleware valida la firma e inyecta req.usuario.");

  // --- 2. PRUEBAS DE ROLEMIDDLEWARE (RBAC) ---
  console.log("🔹 3. Probando restricción de rol (Cliente intentando acceder a Boletería)...");
  const middlewareSoloBoleteria = roleMiddleware(["agente_boleteria", "administrador"]);
  const mockClienteBloqueado = crearMockHttp({ usuario: mockConToken.req.usuario });

  middlewareSoloBoleteria(mockClienteBloqueado.req, mockClienteBloqueado.res, mockClienteBloqueado.next);
  assert.strictEqual(mockClienteBloqueado.res.statusCode, 403, "Cliente debe recibir 403 en ruta de boletería");
  assert.strictEqual(mockClienteBloqueado.getNextLlamado(), false, "No debe ejecutar next()");
  console.log("  ✅ roleMiddleware bloquea con 403 al rol 'cliente' en ruta sensible.");

  console.log("🔹 4. Probando autorización exitosa para Agente de Boletería...");
  const usuarioBoletero = {
    _id: "018f3a2c-7b44-7f12-9c12-9999999abcde",
    correo: "boletero@transorense.com",
    roles: ["agente_boleteria"],
  };
  const mockBoletero = crearMockHttp({ usuario: usuarioBoletero });
  middlewareSoloBoleteria(mockBoletero.req, mockBoletero.res, mockBoletero.next);
  assert.strictEqual(mockBoletero.getNextLlamado(), true, "Agente de boletería debe acceder exitosamente");
  console.log("  ✅ roleMiddleware autoriza al rol correspondiente.");

  console.log("🔹 5. Probando bypass de Administrador para cualquier módulo protegido...");
  const usuarioAdmin = {
    _id: "018f3a2c-7b44-7f12-9c12-0000000abcde",
    correo: "admin@transorense.com",
    roles: ["administrador"],
  };
  const middlewareAuditoria = roleMiddleware(["auditor_tecnico"]);
  const mockAdmin = crearMockHttp({ usuario: usuarioAdmin });
  middlewareAuditoria(mockAdmin.req, mockAdmin.res, mockAdmin.next);
  assert.strictEqual(mockAdmin.getNextLlamado(), true, "Administrador debe tener acceso total");
  console.log("  ✅ El rol 'administrador' posee acceso total garantizado.");

  console.log("\n🎉 [CARD-08 y CARD-09] VERIFICADAS AL 100% CON ÉXITO.");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Fallo en las pruebas de CARD-08/09:", err);
  process.exit(1);
});
