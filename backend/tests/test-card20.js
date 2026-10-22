/**
 * test-card20.js
 * Pruebas automatizadas para [CARD-20]:
 * - Algoritmo de cálculo de tarifas (peso volumétrico vs báscula).
 * - Generador criptográfico de código de rastreo único y no secuencial (formato TRO-XXXXXXXX).
 * - Validación algorítmica Módulo 10 de cédula en remitente y destinatario.
 * - Seguridad y permisos RBAC para operador de encomiendas y administrador.
 */

const assert = require("node:assert");
const {
  calcularTarifaEncomienda,
  generarCodigoRastreo,
} = require("../controllers/encomiendas.controller");
const { roleMiddleware } = require("../middleware/auth.middleware");
const { validarCedulaEcuatoriana } = require("../utils/validador-cedula");

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
  console.log("🧪 Iniciando pruebas para CARD-20 (API de Cotización y Registro de Encomiendas)...\n");

  // 1. ALGORITMO DE CÁLCULO DE TARIFAS
  console.log("🔹 1. Probando algoritmo de tarifas (peso volumétrico vs real)...");
  
  // Caso A: Paquete pequeño (tarifa base $3.50 para <= 2 kg)
  const cotizacionBase = calcularTarifaEncomienda({
    peso_kg: 1.5,
    largo_cm: 20,
    ancho_cm: 15,
    alto_cm: 10, // Volumen: 3000 cm³ / 5000 = 0.60 kg volumétrico
  });
  assert.strictEqual(cotizacionBase.peso_volumetrico_kg, 0.6);
  assert.strictEqual(cotizacionBase.peso_facturable_kg, 1.5); // Mayor es peso real (1.5 kg)
  assert.strictEqual(cotizacionBase.precio_estimado, 3.5); // Tarifa base mínima
  console.log("  ✅ Caso A (Paquete pequeño hasta 2 kg): $3.50 base verificado.");

  // Caso B: Paquete voluminoso y ligero (domina el peso volumétrico)
  // Caja de 50 x 40 x 30 cm = 60,000 cm³ / 5000 = 12 kg volumétricos vs 1 kg real
  const cotizacionVoluminosa = calcularTarifaEncomienda({
    peso_kg: 1.0,
    largo_cm: 50,
    ancho_cm: 40,
    alto_cm: 30,
  });
  assert.strictEqual(cotizacionVoluminosa.peso_volumetrico_kg, 12);
  assert.strictEqual(cotizacionVoluminosa.peso_facturable_kg, 12); // Mayor es volumétrico
  // Tarifa: 3.50 base (2kg) + (12 - 2) * 0.80 = 3.50 + 8.00 = 11.50
  assert.strictEqual(cotizacionVoluminosa.precio_estimado, 11.5);
  console.log("  ✅ Caso B (Paquete voluminoso por peso volumétrico 12 kg): $11.50 verificado.");

  // Caso C: Paquete pesado y compacto (domina el peso en báscula)
  // 10 kg en caja pequeña de 10 x 10 x 10 cm = 1000 cm³ / 5000 = 0.2 kg volumétrico
  const cotizacionPesada = calcularTarifaEncomienda({
    peso_kg: 10.0,
    largo_cm: 10,
    ancho_cm: 10,
    alto_cm: 10,
  });
  assert.strictEqual(cotizacionPesada.peso_facturable_kg, 10);
  // Tarifa: 3.50 + (10 - 2) * 0.80 = 3.50 + 6.40 = 9.90
  assert.strictEqual(cotizacionPesada.precio_estimado, 9.9);
  console.log("  ✅ Caso C (Paquete pesado por báscula 10 kg): $9.90 verificado.");

  // 2. GENERADOR DE CÓDIGO DE RASTREO ÚNICO Y SEGURO
  console.log("\n🔹 2. Probando generador de código de rastreo (TRO-XXXXXXXX)...");
  const codigo1 = generarCodigoRastreo();
  assert(codigo1.startsWith("TRO-"), "Debe iniciar con el prefijo TRO-");
  assert(codigo1.length >= 8, "Debe cumplir la restricción minLength: 8 del $jsonSchema");
  assert.strictEqual(codigo1.length, 12, "Formato TRO- (4 chars) + 8 chars alfanuméricos = 12");

  // Muestreo de unicidad y no secuencialidad (1,000 códigos generados)
  const codigosGenerados = new Set();
  for (let i = 0; i < 1000; i++) {
    const cod = generarCodigoRastreo();
    assert(!codigosGenerados.has(cod), `Colisión detectada en generación aleatoria: ${cod}`);
    codigosGenerados.add(cod);
  }
  console.log("  ✅ 1,000 códigos de rastreo generados con 100% de unicidad sin colisiones.");

  // 3. VALIDACIÓN DE CÉDULA PARA REMITENTE Y DESTINATARIO
  console.log("\n🔹 3. Probando validación Módulo 10 en remitente y destinatario...");
  const cedulaValida = "0715432183"; // El Oro (provincia 07)
  const cedulaInvalida = "0715432189"; // Dígito verificador incorrecto

  assert.strictEqual(validarCedulaEcuatoriana(cedulaValida).esValida, true);
  assert.strictEqual(validarCedulaEcuatoriana(cedulaInvalida).esValida, false);
  console.log("  ✅ Validador algorítmico Módulo 10 operativo.");

  // 4. SEGURIDAD RBAC: ROLES AUTORIZADOS PARA ENCOMIENDAS
  console.log("\n🔹 4. Verificando protección RBAC para registro de encomiendas...");
  const middlewareEncomiendas = roleMiddleware([
    "administrador",
    "operador_encomiendas",
    "agente_boleteria",
  ]);

  // Cliente intentando crear encomienda
  const mockCliente = crearMockHttp({
    usuario: { sub: "usr-1", correo: "cliente@gmail.com", roles: ["cliente"] },
  });
  middlewareEncomiendas(mockCliente.req, mockCliente.res, mockCliente.next);
  assert.strictEqual(mockCliente.res.statusCode, 403, "Cliente debe recibir 403 Forbidden");
  assert.strictEqual(mockCliente.getNextLlamado(), false);
  console.log("  ✅ Rol 'cliente' bloqueado correctamente con 403 Forbidden.");

  // Operador de encomiendas autorizado
  const mockOperador = crearMockHttp({
    usuario: { sub: "usr-2", correo: "operador@transorense.com", roles: ["operador_encomiendas"] },
  });
  middlewareEncomiendas(mockOperador.req, mockOperador.res, mockOperador.next);
  assert.strictEqual(mockOperador.getNextLlamado(), true);
  console.log("  ✅ Rol 'operador_encomiendas' autorizado exitosamente.");

  // Administrador autorizado
  const mockAdmin = crearMockHttp({
    usuario: { sub: "usr-admin", correo: "admin@transorense.com", roles: ["administrador"] },
  });
  middlewareEncomiendas(mockAdmin.req, mockAdmin.res, mockAdmin.next);
  assert.strictEqual(mockAdmin.getNextLlamado(), true);
  console.log("  ✅ Rol 'administrador' autorizado exitosamente.");

  // 5. EXPORTACIÓN DE CONTROLADORES
  console.log("\n🔹 5. Verificando funciones del controlador...");
  const encomiendasController = require("../controllers/encomiendas.controller");
  assert.strictEqual(typeof encomiendasController.cotizarEncomienda, "function");
  assert.strictEqual(typeof encomiendasController.registrarEncomienda, "function");
  assert.strictEqual(typeof encomiendasController.listarEncomiendas, "function");
  assert.strictEqual(typeof encomiendasController.obtenerEncomiendaPorId, "function");
  console.log("  ✅ Todas las funciones del controlador exportadas correctamente.");

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE CARD-20 PASARON SATISFACTORIAMENTE!");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Error en pruebas de CARD-20:", err);
  process.exit(1);
});
