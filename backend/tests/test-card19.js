/**
 * test-card19.js
 * Pruebas automatizadas para [CARD-19]:
 * - API de Verificación de Pagos para el Agente de Boletería.
 * - Validación de permisos RBAC para 'agente_boleteria' y 'administrador'.
 * - Endpoints transaccionales de aprobación y rechazo de pagos.
 */

const assert = require("node:assert");
const { roleMiddleware } = require("../middleware/auth.middleware");

function crearMockHttp({ headers = {}, usuario = null, params = {}, body = {} } = {}) {
  const req = { headers, usuario, params, body };
  const res = {
    statusCode: 200,
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
  console.log("🧪 Iniciando pruebas para CARD-19 (Panel de Operaciones: Agente de Boletería)...\n");

  const pagosController = require("../controllers/pagos.controller");

  // 1. EXISTENCIA DE ENDPOINTS
  console.log("🔹 1. Verificando funciones del controlador...");
  assert.strictEqual(typeof pagosController.aprobarPago, "function", "Debe existir aprobarPago");
  assert.strictEqual(typeof pagosController.rechazarPago, "function", "Debe existir rechazarPago");
  assert.strictEqual(typeof pagosController.listarPagosPendientes, "function", "Debe existir listarPagosPendientes");
  console.log("  ✅ Funciones de aprobación y rechazo correctamente exportadas.");

  // 2. SEGURIDAD RBAC: SOLO AGENTE DE BOLETERÍA Y ADMINISTRADOR
  console.log("🔹 2. Verificando protección RBAC para endpoints de boletería...");
  const middlewareBoleteria = roleMiddleware(["administrador", "agente_boleteria"]);

  // Cliente ordinario intentando aprobar
  const mockCliente = crearMockHttp({
    usuario: { sub: "usr-1", correo: "cliente@transorense.com", roles: ["cliente"] },
  });
  middlewareBoleteria(mockCliente.req, mockCliente.res, mockCliente.next);
  assert.strictEqual(mockCliente.res.statusCode, 403, "Cliente debe ser bloqueado con 403");
  assert.strictEqual(mockCliente.getNextLlamado(), false, "No debe invocar next()");
  console.log("  ✅ Rol 'cliente' bloqueado con 403 Forbidden.");

  // Agente de boletería
  const mockAgente = crearMockHttp({
    usuario: { sub: "ag-1", correo: "agente@transorense.com", roles: ["agente_boleteria"] },
  });
  middlewareBoleteria(mockAgente.req, mockAgente.res, mockAgente.next);
  assert.strictEqual(mockAgente.getNextLlamado(), true, "Agente de boletería debe ser autorizado");
  console.log("  ✅ Rol 'agente_boleteria' autorizado exitosamente.");

  // Administrador
  const mockAdmin = crearMockHttp({
    usuario: { sub: "adm-1", correo: "admin@transorense.com", roles: ["administrador"] },
  });
  middlewareBoleteria(mockAdmin.req, mockAdmin.res, mockAdmin.next);
  assert.strictEqual(mockAdmin.getNextLlamado(), true, "Administrador debe tener acceso total");
  console.log("  ✅ Rol 'administrador' autorizado exitosamente.");

  // 3. VERIFICACIÓN DE CARGA DE RUTAS EN EXPRESS
  console.log("🔹 3. Verificando montaje seguro en Express...");
  const app = require("../index");
  assert.ok(app, "La aplicación Express debe cargar sin errores de sintaxis");

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE CARD-19 PASARON SATISFACTORIAMENTE!");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Fallo en las pruebas de CARD-19:", err);
  process.exit(1);
});
