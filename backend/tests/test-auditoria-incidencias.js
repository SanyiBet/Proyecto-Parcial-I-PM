/**
 * test-auditoria-incidencias.js
 * Pruebas unitarias automatizadas para Auditoría Centralizada y Gestión de Incidencias:
 * - Exportación de controladores y servicios.
 * - Validación de títulos, descripciones y enums de severidad/estado.
 * - Control de acceso RBAC estricto para bitácoras de auditoría (solo rol 'administrador').
 */

const assert = require("node:assert");
const auditoriaController = require("../controllers/auditoria.controller");
const { roleMiddleware } = require("../middleware/auth.middleware");

function crearMockHttp({ headers = {}, usuario = null, params = {}, body = {}, query = {} } = {}) {
  const req = { headers, usuario, params, body, query };
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
  console.log("🧪 Iniciando pruebas para Auditoría e Incidencias Técnicas...\n");

  // 1. EXISTENCIA DE FUNCIONES
  console.log("🔹 1. Verificando funciones del controlador...");
  assert.strictEqual(typeof auditoriaController.listarAuditoria, "function", "Debe exportar listarAuditoria");
  assert.strictEqual(typeof auditoriaController.reportarIncidencia, "function", "Debe exportar reportarIncidencia");
  assert.strictEqual(typeof auditoriaController.listarIncidencias, "function", "Debe exportar listarIncidencias");
  assert.strictEqual(typeof auditoriaController.actualizarEstadoIncidencia, "function", "Debe exportar actualizarEstadoIncidencia");
  console.log("  ✅ Todas las funciones del controlador exportadas correctamente.");

  // 2. SEGURIDAD RBAC EN CONSULTA DE AUDITORÍA
  console.log("\n🔹 2. Probando control de acceso RBAC en bitácora de auditoría...");
  const middlewareAuditoria = roleMiddleware(["administrador"]);

  // Cliente ordinario intentando ver bitácoras
  const mockCliente = crearMockHttp({
    usuario: { sub: "usr-cliente", correo: "cliente@gmail.com", roles: ["cliente"] },
  });
  middlewareAuditoria(mockCliente.req, mockCliente.res, mockCliente.next);
  assert.strictEqual(mockCliente.res.statusCode, 403, "Cliente no debe acceder a auditoría (403)");
  assert.strictEqual(mockCliente.getNextLlamado(), false);
  console.log("  ✅ Rol 'cliente' denegado con 403 Forbidden.");

  // Agente de boletería intentando ver bitácoras
  const mockBoleteria = crearMockHttp({
    usuario: { sub: "usr-agente", correo: "agente@transorense.com", roles: ["agente_boleteria"] },
  });
  middlewareAuditoria(mockBoleteria.req, mockBoleteria.res, mockBoleteria.next);
  assert.strictEqual(mockBoleteria.res.statusCode, 403, "Agente no debe acceder a auditoría (403)");
  console.log("  ✅ Rol 'agente_boleteria' denegado con 403 Forbidden.");

  // Administrador autorizado
  const mockAdmin = crearMockHttp({
    usuario: { sub: "usr-admin", correo: "admin@transorense.com", roles: ["administrador"] },
  });
  middlewareAuditoria(mockAdmin.req, mockAdmin.res, mockAdmin.next);
  assert.strictEqual(mockAdmin.getNextLlamado(), true, "Administrador debe tener paso libre");
  console.log("  ✅ Rol 'administrador' autorizado con éxito.");

  // 3. VALIDACIÓN DE ENTRADAS EN INCIDENCIAS
  console.log("\n🔹 3. Probando validaciones en reporte de incidencias...");
  const mockInvalido = crearMockHttp({
    usuario: { sub: "usr-test", roles: ["cliente"] },
    body: { titulo: "abc", descripcion: "corta" }, // Título y descripción muy cortos
  });

  await auditoriaController.reportarIncidencia(mockInvalido.req, mockInvalido.res, mockInvalido.next);
  assert.strictEqual(mockInvalido.res.statusCode, 400, "Debe rechazar título menor a 4 caracteres");
  console.log("  ✅ Validación de título corto verificada.");

  const mockSeveridadInvalida = crearMockHttp({
    usuario: { sub: "usr-test", roles: ["cliente"] },
    body: {
      titulo: "Error en la pasarela de pago",
      descripcion: "El comprobante no carga adecuadamente",
      severidad: "super_urgente", // No permitida
    },
  });
  await auditoriaController.reportarIncidencia(mockSeveridadInvalida.req, mockSeveridadInvalida.res, mockSeveridadInvalida.next);
  assert.strictEqual(mockSeveridadInvalida.res.statusCode, 400, "Debe rechazar severidad fuera del enum");
  console.log("  ✅ Validación de severidad fuera de enum verificada.");

  console.log("\n🎉 TODAS LAS PRUEBAS DE AUDITORÍA E INCIDENCIAS PASARON CON ÉXITO (100% PASS).\n");
}

if (require.main === module) {
  ejecutarPruebas().catch((err) => {
    console.error("❌ Falló la prueba:", err);
    process.exit(1);
  });
}

module.exports = { ejecutarPruebas };
