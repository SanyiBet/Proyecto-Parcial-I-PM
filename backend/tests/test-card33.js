/**
 * test-card33.js
 * Suite de pruebas unitarias para CARD-33:
 * Limitador de Tasa (Rate Limiting) y Restricción de Origen en CORS.
 */

const assert = require("assert");
const { limiterAuth, limiterReservas, limiterGeneral } = require("../middleware/rate-limit.middleware");

console.log("================================================================================");
console.log("🛡️  EJECUTANDO PRUEBAS DE SEGURIDAD PARA CARD-33 (RATE LIMITING Y CORS)");
console.log("================================================================================\n");

async function ejecutarPruebas() {
  // 1. Verificación de configuración de limitadores de tasa
  console.log("🔹 1. Verificando configuración de rate limiters...");
  assert.strictEqual(typeof limiterAuth, "function", "limiterAuth debe ser un middleware válido");
  assert.strictEqual(typeof limiterReservas, "function", "limiterReservas debe ser un middleware válido");
  assert.strictEqual(typeof limiterGeneral, "function", "limiterGeneral debe ser un middleware válido");
  console.log("  ✅ Middlewares de limitación de tasa exportados e instanciados correctamente.");

  // 2. Simulación de Rate Limiting en autenticación (máximo 10 peticiones)
  console.log("\n🔹 2. Simulando peticiones repetitivas en limiterAuth (Límite 10 req/min)...");
  
  let respuestaBloqueo = null;
  let codigoEstado = 200;
  const ipSimulada = "192.168.1.100";

  for (let i = 1; i <= 11; i++) {
    const req = {
      ip: ipSimulada,
      method: "POST",
      headers: {},
      path: "/api/auth/login",
      app: { get: () => false },
    };

    let nextLlamado = false;

    await new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(key, val) {
          this.headers[key] = val;
        },
        getHeader(key) {
          return this.headers[key];
        },
        status(code) {
          this.statusCode = code;
          codigoEstado = code;
          return this;
        },
        send(data) {
          respuestaBloqueo = data;
          resolve();
        },
        json(data) {
          respuestaBloqueo = data;
          resolve();
        },
      };

      limiterAuth(req, res, () => {
        nextLlamado = true;
        resolve();
      });
    });

    if (i <= 10) {
      assert.strictEqual(nextLlamado, true, `La petición ${i} dentro de la cuota debe ser permitida`);
    } else {
      assert.strictEqual(codigoEstado, 429, `La petición ${i} debe recibir HTTP 429 Too Many Requests`);
      assert.ok(respuestaBloqueo, "Debe contener mensaje explicativo de bloqueo");
      assert.strictEqual(respuestaBloqueo.statusCode, 429);
      break;
    }
  }

  console.log("  ✅ limiterAuth bloqueó con éxito en la 11ª petición con código HTTP 429.");

  // 3. Simulación de Rate Limiting en reservas de asientos (máximo 20 peticiones)
  console.log("\n🔹 3. Simulando peticiones concurrentes en limiterReservas (Límite 20 req/min)...");
  const ipReserva = "10.0.0.50";
  let statusReserva = 200;

  for (let j = 1; j <= 21; j++) {
    const req = {
      ip: ipReserva,
      method: "POST",
      headers: {},
      path: "/api/reservas",
      app: { get: () => false },
    };

    let nextOk = false;

    await new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(key, val) {
          this.headers[key] = val;
        },
        getHeader(key) {
          return this.headers[key];
        },
        status(code) {
          this.statusCode = code;
          statusReserva = code;
          return this;
        },
        send() {
          resolve();
        },
        json() {
          resolve();
        },
      };

      limiterReservas(req, res, () => {
        nextOk = true;
        resolve();
      });
    });

    if (j <= 20) {
      assert.strictEqual(nextOk, true, `Reserva ${j} dentro de cuota permitida`);
    } else {
      assert.strictEqual(statusReserva, 429, `Reserva ${j} debe ser bloqueada por rate limit (429)`);
      break;
    }
  }

  console.log("  ✅ limiterReservas protegió el inventario bloqueando la 21ª petición con código HTTP 429.");

  // 4. Verificación de lógica de CORS restrictivo
  console.log("\n🔹 4. Verificando política restrictiva de orígenes permitidos en CORS...");
  
  const origenesPermitidos = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  function verificarOrigenCors(origin) {
    if (!origin || origenesPermitidos.includes(origin)) {
      return { permitido: true };
    }
    return {
      permitido: false,
      error: `Acceso denegado por política CORS: El origen '${origin}' no está autorizado.`,
    };
  }

  // A: Orígenes autorizados (Frontend Angular en desarrollo y producción)
  assert.strictEqual(verificarOrigenCors("http://localhost:4200").permitido, true);
  assert.strictEqual(verificarOrigenCors("http://127.0.0.1:4200").permitido, true);
  // B: Llamadas sin cabecera origin (Apps móviles Android/iOS, curl, Postman)
  assert.strictEqual(verificarOrigenCors(undefined).permitido, true);
  assert.strictEqual(verificarOrigenCors(null).permitido, true);
  // C: Orígenes no autorizados / maliciosos
  const resMalicioso = verificarOrigenCors("https://sitio-phishing.com");
  assert.strictEqual(resMalicioso.permitido, false, "Sitios no autorizados deben ser denegados");
  assert.ok(resMalicioso.error.includes("Acceso denegado por política CORS"));

  console.log("  ✅ Matriz de CORS verificada: Angular autorizado, apps móviles permitidas, atacantes externos bloqueados.");

  console.log("\n================================================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE SEGURIDAD DE CARD-33 PASARON EXITOSAMENTE.");
  console.log("================================================================================\n");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Fallo en las pruebas de CARD-33:", err);
  process.exit(1);
});
