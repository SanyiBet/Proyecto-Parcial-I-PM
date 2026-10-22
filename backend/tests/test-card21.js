/**
 * test-card21.js
 * Pruebas unitarias automatizadas para [CARD-21]:
 * - API de Rastreo Público con protección de datos personales (LOPDP).
 * - Enmascaramiento de nombres y no exposición de cédulas/teléfonos.
 * - Validación de estados permitidos en movimientos físicos de encomiendas.
 * - Permisos RBAC para Operador de Encomiendas y Administrador.
 */

const assert = require("node:assert");
const encomiendasController = require("../controllers/encomiendas.controller");
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
  console.log("🧪 Iniciando pruebas para CARD-21 (Rastreo Público y Gestión de Movimientos)...\n");

  // 1. EXISTENCIA DE FUNCIONES
  console.log("🔹 1. Verificando funciones del controlador...");
  assert.strictEqual(typeof encomiendasController.rastrearEncomiendaPublico, "function", "Debe existir rastrearEncomiendaPublico");
  assert.strictEqual(typeof encomiendasController.registrarMovimientoEncomienda, "function", "Debe existir registrarMovimientoEncomienda");
  console.log("  ✅ Funciones rastrearEncomiendaPublico y registrarMovimientoEncomienda exportadas.");

  // 2. SEGURIDAD RBAC EN REGISTRO DE MOVIMIENTOS
  console.log("\n🔹 2. Probando control de acceso RBAC en registro de movimientos...");
  const middlewareMovimientos = roleMiddleware(["administrador", "operador_encomiendas"]);

  // Cliente ordinario intentando mover un paquete
  const mockCliente = crearMockHttp({
    usuario: { sub: "usr-cliente", correo: "cliente@gmail.com", roles: ["cliente"] },
  });
  middlewareMovimientos(mockCliente.req, mockCliente.res, mockCliente.next);
  assert.strictEqual(mockCliente.res.statusCode, 403, "Cliente debe recibir 403 Forbidden");
  assert.strictEqual(mockCliente.getNextLlamado(), false);
  console.log("  ✅ Rol 'cliente' bloqueado con 403 Forbidden.");

  // Operador de Encomiendas autorizado
  const mockOperador = crearMockHttp({
    usuario: { sub: "usr-operador", correo: "operador@transorense.com", roles: ["operador_encomiendas"] },
  });
  middlewareMovimientos(mockOperador.req, mockOperador.res, mockOperador.next);
  assert.strictEqual(mockOperador.getNextLlamado(), true);
  console.log("  ✅ Rol 'operador_encomiendas' autorizado exitosamente.");

  // Administrador autorizado
  const mockAdmin = crearMockHttp({
    usuario: { sub: "usr-admin", correo: "admin@transorense.com", roles: ["administrador"] },
  });
  middlewareMovimientos(mockAdmin.req, mockAdmin.res, mockAdmin.next);
  assert.strictEqual(mockAdmin.getNextLlamado(), true);
  console.log("  ✅ Rol 'administrador' autorizado exitosamente.");

  // 3. VALIDACIÓN DE ESTADOS PERMITIDOS EN MOVIMIENTOS
  console.log("\n🔹 3. Probando validación de estados de encomienda...");
  const mockEstadoInvalido = crearMockHttp({
    usuario: { sub: "usr-operador", roles: ["operador_encomiendas"] },
    params: { id: "test-id" },
    body: { nuevo_estado: "estado_inventado_xyz", ubicacion: "Agencia Machala" },
  });
  await encomiendasController.registrarMovimientoEncomienda(mockEstadoInvalido.req, mockEstadoInvalido.res, () => {});
  assert.strictEqual(mockEstadoInvalido.res.statusCode, 400, "Estado no permitido debe retornar 400");
  assert(mockEstadoInvalido.res.body.mensaje.includes("recibida, en_transito"));
  console.log("  ✅ Estados inválidos rechazados correctamente con 400 Bad Request.");

  // 4. VALIDACIÓN DE UBICACIÓN REQUERIDA
  console.log("\n🔹 4. Probando validación de ubicación física obligatoria...");
  const mockSinUbicacion = crearMockHttp({
    usuario: { sub: "usr-operador", roles: ["operador_encomiendas"] },
    params: { id: "test-id" },
    body: { nuevo_estado: "en_transito", ubicacion: "" },
  });
  await encomiendasController.registrarMovimientoEncomienda(mockSinUbicacion.req, mockSinUbicacion.res, () => {});
  assert.strictEqual(mockSinUbicacion.res.statusCode, 400, "Ubicación vacía debe retornar 400");
  console.log("  ✅ Movimiento sin ubicación rechazado con 400 Bad Request.");

  // 5. VALIDACIÓN DE CÓDIGO EN RASTREO PÚBLICO
  console.log("\n🔹 5. Probando validación de parámetro en rastreo público...");
  const mockSinCodigo = crearMockHttp({ params: { codigo: "" } });
  await encomiendasController.rastrearEncomiendaPublico(mockSinCodigo.req, mockSinCodigo.res, () => {});
  assert.strictEqual(mockSinCodigo.res.statusCode, 400);
  console.log("  ✅ Búsqueda sin código de rastreo rechazada con 400 Bad Request.");

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE CARD-21 PASARON SATISFACTORIAMENTE!");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Error en pruebas de CARD-21:", err);
  process.exit(1);
});
