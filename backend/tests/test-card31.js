/**
 * test-card31.js
 * Pruebas unitarias para [CARD-31]:
 * - Blindaje contra inyecciones ReDoS (Regular Expression Denial of Service).
 * - Sanitización de metacaracteres reservados regex con escapeRegex().
 * - Protección contra SyntaxError por caracteres sin balancear (ej. '[' o '(').
 */

const assert = require("node:assert");
const { escapeRegex } = require("../utils/sanitizer");

async function ejecutarPruebas() {
  console.log("🧪 Iniciando pruebas para CARD-31 (Blindaje contra Inyecciones ReDoS y Sanitización Regex)...\n");

  // 1. VERIFICACIÓN DE EXPORTACIÓN
  console.log("🔹 1. Verificando función escapeRegex...");
  assert.strictEqual(typeof escapeRegex, "function", "Debe exportar escapeRegex");
  console.log("  ✅ Función escapeRegex exportada correctamente.");

  // 2. ESCAPE DE CARACTERES ESPECIALES RESERVADOS
  console.log("\n🔹 2. Probando neutralización de metacaracteres RegExp...");
  const entradaPeligrosa = ".*+?^${}()|[]\\";
  const resultado = escapeRegex(entradaPeligrosa);
  assert.strictEqual(
    resultado,
    "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    "Todos los caracteres reservados deben estar escapados con barra invertida"
  );
  console.log("  ✅ Metacaracteres neutralizados exitosamente.");

  // 3. PREVENCIÓN DE SYNTAX ERROR EN NEW REGEXP
  console.log("\n🔹 3. Probando cadenas con corchetes y paréntesis abiertos...");
  const cadenaInvalida = "Machala (Terminal [Andén 4+";
  
  // Sin escapar provocaría SyntaxError: Invalid regular expression
  assert.doesNotThrow(() => {
    const regexSegura = new RegExp(`^${escapeRegex(cadenaInvalida)}$`, "i");
    assert.strictEqual(regexSegura.test(cadenaInvalida), true);
  }, "new RegExp no debe fallar tras la sanitización con escapeRegex");
  console.log("  ✅ SyntaxError evitado con éxito al construir expresiones regulares dinámicas.");

  // 4. PREVENCIÓN DE PATRONES REDOS CATASTRÓFICOS
  console.log("\n🔹 4. Probando neutralización de payload ReDoS (Backtracking catastrófico)...");
  const payloadReDoS = "^(a+)+$";
  const regexReDoSSanitizada = new RegExp(`^${escapeRegex(payloadReDoS)}$`, "i");
  // Al estar escapada, los símbolos + y ^ son literales, impidiendo backtracking exponencial
  assert.strictEqual(regexReDoSSanitizada.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
  assert.strictEqual(regexReDoSSanitizada.test("^(a+)+$"), true);
  console.log("  ✅ Ataque ReDoS neutralizado (evaluación en O(1) tiempo lineal).");

  // 5. MANEJO DE TIPOS NO STRING
  console.log("\n🔹 5. Probando resiliencia ante tipos no string...");
  assert.strictEqual(escapeRegex(null), "");
  assert.strictEqual(escapeRegex(undefined), "");
  assert.strictEqual(escapeRegex(12345), "");
  console.log("  ✅ Entradas nulas o numéricas manejadas con resiliencia.");

  console.log("\n🎉 TODAS LAS PRUEBAS DE CARD-31 PASARON EXITOSAMENTE.");
}

ejecutarPruebas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en prueba CARD-31:", err);
    process.exit(1);
  });
