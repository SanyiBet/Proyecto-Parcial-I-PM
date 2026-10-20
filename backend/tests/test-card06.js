/**
 * test-card06.js
 * Pruebas unitarias automatizadas para [CARD-06]:
 * 1. Validador Módulo 10 de Cédula Ecuatoriana.
 * 2. Hashing y verificación con Argon2id.
 */

const assert = require("node:assert");
const { validarCedulaEcuatoriana } = require("../utils/validador-cedula");
const { hashearPassword, verificarPassword } = require("../services/hash.service");

async function ejecutarPruebas() {
  console.log("🧪 Iniciando pruebas para CARD-06...\n");

  // --- 1. PRUEBAS DE CÉDULA ECUATORIANA (MÓDULO 10) ---
  console.log("🔹 Probando validador algorítmico de cédula...");

  // Casos de éxito (cédulas reales matemáticamente válidas)
  // 0702148419 (Provincia 07 - El Oro, TransOrense)
  // Coeficientes: 0*2 + 7*1 + 0*2 + 2*1 + 1*2 + 4*1 + 8*2(16->7) + 4*1 + 1*2 = 0+7+0+2+2+4+7+4+2 = 28 -> 30-28 = 2... verifiquemos matemáticamente una válida:
  // 1710034065 (Pichincha) -> 1*2=2, 7*1=7, 1*2=2, 0*1=0, 0*2=0, 3*1=3, 4*2=8, 0*1=0, 6*2=12(3) -> suma=2+7+2+0+0+3+8+0+3=25 -> 30-25=5. Décimo es 5. VÁLIDA.
  const r1 = validarCedulaEcuatoriana("1710034065");
  assert.strictEqual(r1.esValida, true, "1710034065 debería ser válida");

  // 0922851213 (Guayas) -> 0*2=0, 9*1=9, 2*2=4, 2*1=2, 8*2=16(7), 5*1=5, 1*2=2, 2*1=2, 1*2=2 -> suma=0+9+4+2+7+5+2+2+2=33 -> 40-33=7. Décimo es 3? No, entonces 0922851213 no.
  // Calculemos una de El Oro (07):
  // Dígitos: 0, 7, 1, 5, 4, 3, 2, 1, 8
  // 0*2=0, 7*1=7, 1*2=2, 5*1=5, 4*2=8, 3*1=3, 2*2=4, 1*1=1, 8*2=16(7)
  // suma = 0 + 7 + 2 + 5 + 8 + 3 + 4 + 1 + 7 = 37. Residuo 7. Verificador = 10 - 7 = 3.
  // Cédula válida: "0715432183"
  const rElOro = validarCedulaEcuatoriana("0715432183");
  assert.strictEqual(rElOro.esValida, true, "0715432183 (El Oro) debería ser válida");

  // Casos de falla
  assert.strictEqual(validarCedulaEcuatoriana("").esValida, false, "Vacía debe fallar");
  assert.strictEqual(validarCedulaEcuatoriana("12345").esValida, false, "Longitud < 10 debe fallar");
  assert.strictEqual(validarCedulaEcuatoriana("171003406599").esValida, false, "Longitud > 10 debe fallar");
  assert.strictEqual(validarCedulaEcuatoriana("9910034065").esValida, false, "Provincia 99 debe fallar");
  assert.strictEqual(validarCedulaEcuatoriana("1790034065").esValida, false, "Tercer dígito >= 6 debe fallar");
  assert.strictEqual(validarCedulaEcuatoriana("1710034069").esValida, false, "Dígito verificador incorrecto debe fallar");

  console.log("  ✅ Todas las pruebas de validación de cédula pasaron correctamente.");

  // --- 2. PRUEBAS DE ARGON2ID ---
  console.log("🔹 Probando hashing y verificación con Argon2id...");
  const passwordPlano = "TransOrense#2026";
  const hashGenerado = await hashearPassword(passwordPlano);

  assert(hashGenerado.startsWith("$argon2id$"), "El hash debe tener formato $argon2id$");

  const coincideCorrecto = await verificarPassword(hashGenerado, passwordPlano);
  assert.strictEqual(coincideCorrecto, true, "La contraseña correcta debe validar en true");

  const coincideIncorrecto = await verificarPassword(hashGenerado, "ClaveErronea123");
  assert.strictEqual(coincideIncorrecto, false, "Una contraseña errónea debe validar en false");

  console.log("  ✅ Pruebas de cifrado Argon2id pasaron exitosamente.");
  console.log("\n🎉 [CARD-06] VERIFICADA AL 100% CON ÉXITO.");
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Fallo en las pruebas:", err);
  process.exit(1);
});
