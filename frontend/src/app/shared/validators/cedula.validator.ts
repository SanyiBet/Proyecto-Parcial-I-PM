import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador algorítmico Módulo 10 para cédulas ecuatorianas.
 * Puede utilizarse directamente como función matemática o dentro de formularios reactivos.
 */
export function validarCedulaEcuatorianaMatematica(cedula: string): { esValida: boolean; mensaje: string } {
  if (!cedula) {
    return { esValida: false, mensaje: 'La cédula es requerida' };
  }

  const str = String(cedula).trim();

  // 1. Longitud exacta de 10 dígitos
  if (!/^\d{10}$/.test(str)) {
    return { esValida: false, mensaje: 'Debe contener exactamente 10 dígitos numéricos' };
  }

  // 2. Provincia (01-24 o 30)
  const provincia = parseInt(str.substring(0, 2), 10);
  const provinciaValida = (provincia >= 1 && provincia <= 24) || provincia === 30;
  if (!provinciaValida) {
    return { esValida: false, mensaje: 'Código de provincia no válido' };
  }

  // 3. Tercer dígito < 6 (persona natural)
  const tercerDigito = parseInt(str[2], 10);
  if (tercerDigito >= 6) {
    return { esValida: false, mensaje: 'El tercer dígito debe ser menor a 6' };
  }

  // 4. Algoritmo Módulo 10
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(str[i], 10) * coeficientes[i];
    if (valor >= 10) {
      valor -= 9;
    }
    suma += valor;
  }

  const residuo = suma % 10;
  const verificadorCalculado = residuo === 0 ? 0 : 10 - residuo;
  const decimoDigito = parseInt(str[9], 10);

  if (verificadorCalculado !== decimoDigito) {
    return { esValida: false, mensaje: 'Dígito verificador inválido' };
  }

  return { esValida: true, mensaje: 'Cédula válida' };
}

/**
 * Validador reactivo para controles de Angular Reactive Forms
 */
export function cedulaEcuatorianaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Deja la validación de campo vacío a Validators.required
    }

    const resultado = validarCedulaEcuatorianaMatematica(control.value);
    if (!resultado.esValida) {
      return {
        cedulaInvalida: true,
        mensaje: resultado.mensaje,
      };
    }

    return null;
  };
}
