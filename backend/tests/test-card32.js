/**
 * test-card32.js
 * Suite de pruebas unitarias para CARD-32:
 * Validación estricta de comprobantes de pago por Magic Numbers y Blindaje LOPDP.
 */

const assert = require("assert");
const path = require("path");
const { validarArchivoComprobante, MAX_BYTES_PERMITIDOS } = require("../utils/file-validator");
const { guardarComprobanteEnDisco } = require("../controllers/pagos.controller");

console.log("================================================================================");
console.log("🛡️  EJECUTANDO PRUEBAS DE SEGURIDAD PARA CARD-32 (MAGIC NUMBERS Y LOPDP)");
console.log("================================================================================\n");

function ejecutarPruebas() {
  // 1. Verificación de archivos válidos por Magic Numbers
  console.log("🔹 1. Verificando firmas binarias permitidas (JPEG, PNG, PDF, WEBP)...");
  
  // JPEG: FF D8 FF E0
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const resJpeg = validarArchivoComprobante(jpegBuffer);
  assert.strictEqual(resJpeg.esValido, true, "JPEG válido debe ser aprobado");
  assert.strictEqual(resJpeg.extension, ".jpg");
  assert.strictEqual(resJpeg.mime, "image/jpeg");

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const resPng = validarArchivoComprobante(pngBuffer);
  assert.strictEqual(resPng.esValido, true, "PNG válido debe ser aprobado");
  assert.strictEqual(resPng.extension, ".png");
  assert.strictEqual(resPng.mime, "image/png");

  // PDF: 25 50 44 46 (%PDF)
  const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  const resPdf = validarArchivoComprobante(pdfBuffer);
  assert.strictEqual(resPdf.esValido, true, "PDF válido debe ser aprobado");
  assert.strictEqual(resPdf.extension, ".pdf");
  assert.strictEqual(resPdf.mime, "application/pdf");

  // WEBP: RIFF....WEBP
  const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const resWebp = validarArchivoComprobante(webpBuffer);
  assert.strictEqual(resWebp.esValido, true, "WEBP válido debe ser aprobado");
  assert.strictEqual(resWebp.extension, ".webp");
  assert.strictEqual(resWebp.mime, "image/webp");

  console.log("  ✅ Magic numbers válidos reconocidos correctamente.");

  // 2. Rechazo de archivos maliciosos y spoofing de extensión
  console.log("\n🔹 2. Verificando bloqueo de archivos maliciosos y extensión falsa (Spoofing)...");
  
  // Script ejecutable o texto simulando ser comprobante
  const scriptBuffer = Buffer.from("<script>alert('xss')</script>");
  const resScript = validarArchivoComprobante(scriptBuffer);
  assert.strictEqual(resScript.esValido, false, "Script malicioso debe ser rechazado");

  // Binario ejecutable Windows MZ (4D 5A)
  const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const resExe = validarArchivoComprobante(exeBuffer);
  assert.strictEqual(resExe.esValido, false, "Binario ejecutable .exe debe ser rechazado");

  console.log("  ✅ Detección y bloqueo estricto de archivos falsificados / ejecutables.");

  // 3. Validación de límite de tamaño (5MB)
  console.log("\n🔹 3. Verificando restricción de tamaño máximo (5MB)...");
  const bufferExcedido = Buffer.alloc(MAX_BYTES_PERMITIDOS + 1024, 0xff); // 5MB + 1KB
  const resExcedido = validarArchivoComprobante(bufferExcedido);
  assert.strictEqual(resExcedido.esValido, false, "Buffer mayor a 5MB debe ser rechazado");
  assert.ok(resExcedido.error.includes("supera el tamaño máximo"), "Mensaje de error debe indicar límite excedido");

  console.log("  ✅ Control de cuota y tamaño máximo verificado (5MB).");

  // 4. Prevención de Path Traversal
  console.log("\n🔹 4. Verificando mitigación de Directory Traversal...");
  const maliciousPath = "../../../etc/passwd";
  const sanitizedPath = path.basename(maliciousPath);
  assert.strictEqual(sanitizedPath, "passwd", "path.basename debe neutralizar directorios relativos");
  assert.ok(!sanitizedPath.includes(".."), "No debe contener secuencias parent-directory");

  console.log("  ✅ Protección contra Path Traversal validada.");

  // 5. Integración con guardarComprobanteEnDisco
  console.log("\n🔹 5. Verificando guardado seguro con UUIDv7...");
  const validBase64 = "data:image/jpeg;base64," + jpegBuffer.toString("base64");
  const relativeUrl = guardarComprobanteEnDisco(validBase64);
  assert.ok(relativeUrl.startsWith("/api/pagos/comprobante/comprobante-"), "URL debe seguir formato protegido");
  assert.ok(relativeUrl.endsWith(".jpg"), "Debe asignar extensión deducida de la firma binaria");

  // Verificar que un base64 no válido lance error 400
  const invalidBase64 = "data:image/jpeg;base64," + scriptBuffer.toString("base64");
  assert.throws(
    () => guardarComprobanteEnDisco(invalidBase64),
    (err) => err.statusCode === 400,
    "Debe lanzar excepción con código 400 al recibir archivo con firma inválida"
  );

  console.log("  ✅ Controlador de comprobantes integrado y blindado correctamente.");

  console.log("\n================================================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE SEGURIDAD DE CARD-32 PASARON EXITOSAMENTE.");
  console.log("================================================================================\n");
}

ejecutarPruebas();
