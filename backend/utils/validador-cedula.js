/**
 * validador-cedula.js
 * Validador algorítmico de Cédula de Identidad Ecuatoriana (Módulo 10).
 * Cumple con los lineamientos del Registro Civil del Ecuador para personas naturales.
 */

/**
 * Valida si un número de cédula ecuatoriana es matemáticamente válido.
 * 
 * Reglas de validación:
 * 1. Debe contener exactamente 10 dígitos numéricos.
 * 2. Los dos primeros dígitos corresponden a una provincia válida (01 a 24 o 30 para residentes en el exterior).
 * 3. El tercer dígito debe ser menor a 6 (personas naturales: 0, 1, 2, 3, 4, 5).
 * 4. Algoritmo Módulo 10 sobre los primeros 9 dígitos con coeficientes [2, 1, 2, 1, 2, 1, 2, 1, 2].
 *    - Cada producto mayor o igual a 10 se le resta 9.
 *    - Se suman los resultados.
 *    - Verificador = 10 - (suma % 10). Si residuo es 0, verificador es 0.
 *    - Debe coincidir con el décimo dígito.
 * 
 * @param {string|number} cedula - Número de cédula a validar
 * @returns {{ esValida: boolean, mensaje: string }}
 */
function validarCedulaEcuatoriana(cedula) {
  if (!cedula) {
    return { esValida: false, mensaje: "La cédula no puede estar vacía" };
  }

  const cedulaStr = String(cedula).trim();

  // 1. Longitud y sólo dígitos numéricos
  if (!/^\d{10}$/.test(cedulaStr)) {
    return {
      esValida: false,
      mensaje: "La cédula debe contener exactamente 10 dígitos numéricos",
    };
  }

  // 2. Validación de provincia (01 a 24 o 30)
  const provincia = parseInt(cedulaStr.substring(0, 2), 10);
  const provinciaValida = (provincia >= 1 && provincia <= 24) || provincia === 30;
  if (!provinciaValida) {
    return {
      esValida: false,
      mensaje: `Código de provincia '${provincia.toString().padStart(2, "0")}' no es válido en Ecuador`,
    };
  }

  // 3. Validación de tercer dígito para personas naturales (< 6)
  const tercerDigito = parseInt(cedulaStr[2], 10);
  if (tercerDigito >= 6) {
    return {
      esValida: false,
      mensaje: "El tercer dígito de una cédula de persona natural debe ser menor a 6",
    };
  }

  // 4. Algoritmo Módulo 10
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedulaStr[i], 10) * coeficientes[i];
    if (valor >= 10) {
      valor -= 9;
    }
    suma += valor;
  }

  const residuo = suma % 10;
  const digitoVerificadorCalculado = residuo === 0 ? 0 : 10 - residuo;
  const decimoDigito = parseInt(cedulaStr[9], 10);

  if (digitoVerificadorCalculado !== decimoDigito) {
    return {
      esValida: false,
      mensaje: `Dígito verificador inválido: calculado ${digitoVerificadorCalculado}, recibido ${decimoDigito}`,
    };
  }

  return {
    esValida: true,
    mensaje: "Cédula ecuatoriana válida",
  };
}

module.exports = {
  validarCedulaEcuatoriana,
};
