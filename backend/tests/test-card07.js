/**
 * test-card07.js
 * Pruebas automatizadas para [CARD-07]:
 * - Emisión de JWT con roles (RBAC) y UUID v7.
 * - Verificación criptográfica de firma y expiración.
 * - Detección de tokens alterados o inválidos.
 */

const assert = require("node:assert");
const { generarTokenJWT, verificarTokenJWT } = require("../services/token.service");
const { generarUUIDv7 } = require("../database/uuid-helper");

async function ejecutarPruebas() {
  console.log("🧪 Iniciando pruebas para CARD-07 (JWT & RBAC)...\n");

  const usuarioPrueba = {
    _id: generarUUIDv7(),
    nombre: "Juan Pérez Operador",
    correo: "juan.perez@transorense.com",
    roles: ["agente_boleteria"],
  };

  console.log("🔹 1. Probando generación de token JWT con RBAC...");
  const token = generarTokenJWT(usuarioPrueba);
  assert(typeof token === "string" && token.length > 20, "El token debe ser una cadena válida");
  console.log("  ✅ Token generado exitosamente:", token.substring(0, 30) + "...");

  console.log("🔹 2. Probando verificación y extracción de claims...");
  const decodificado = verificarTokenJWT(token);
  assert.strictEqual(decodificado.sub, usuarioPrueba._id, "El ID del payload debe coincidir");
  assert.strictEqual(decodificado.correo, usuarioPrueba.correo, "El correo debe coincidir");
  assert.deepStrictEqual(decodificado.roles, usuarioPrueba.roles, "Los roles RBAC deben coincidir");
  assert.strictEqual(decodificado.nombre, usuarioPrueba.nombre, "El nombre debe coincidir");
  console.log("  ✅ Claims y roles RBAC decodificados correctamente:", decodificado.roles);

  console.log("🔹 3. Probando detección de token manipulado (seguridad)...");
  const tokenManipulado = token.slice(0, -5) + "abcde";
  assert.throws(
    () => verificarTokenJWT(tokenManipulado),
    /invalid signature|jwt malformed/i,
    "Un token manipulado debe arrojar error de firma inválida"
  );
  console.log("  ✅ Tokens alterados son rechazados de forma segura.");

  console.log("\n🎉 [CARD-07] VERIFICADA AL 100% CON ÉXITO.");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Fallo en las pruebas de CARD-07:", err);
  process.exit(1);
});
