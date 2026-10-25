/**
 * file-validator.js
 * Utilidad de Validación Estricta de Archivos y Blindaje LOPDP (CARD-32).
 * 
 * Valida firmas binarias ("magic numbers") reales para prevenir ataques de
 * extension spoofing, subida de scripts maliciosos (Polyglot files) y limita
 * el peso máximo a 5MB para comprobantes bancarios.
 */

const MAX_BYTES_PERMITIDOS = 5 * 1024 * 1024; // 5 MB

/**
 * Valida un buffer binario analizando tamaño y magic numbers.
 * 
 * @param {Buffer} buffer - Buffer con los bytes crudos del archivo
 * @returns {{ esValido: boolean, extension?: string, mime?: string, error?: string }}
 */
function validarArchivoComprobante(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      esValido: false,
      error: "Archivo no proporcionado o formato de buffer inválido",
    };
  }

  // 1. Validación de tamaño máximo (5MB)
  if (buffer.length > MAX_BYTES_PERMITIDOS) {
    return {
      esValido: false,
      error: `El archivo supera el tamaño máximo permitido de 5MB (Tamaño actual: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  if (buffer.length < 4) {
    return {
      esValido: false,
      error: "El archivo está dañado o vacío",
    };
  }

  // 2. Validación de Magic Numbers (firmas de cabecera binaria)
  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { esValido: true, extension: ".jpg", mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { esValido: true, extension: ".png", mime: "image/png" };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { esValido: true, extension: ".pdf", mime: "application/pdf" };
  }

  // WEBP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { esValido: true, extension: ".webp", mime: "image/webp" };
  }

  return {
    esValido: false,
    error: "Formato no autorizado. Solo se permiten imágenes reales (JPEG, PNG, WEBP) o documentos PDF",
  };
}

module.exports = {
  validarArchivoComprobante,
  MAX_BYTES_PERMITIDOS,
};
