import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function validarCedulaEcuatorianaMatematica(cedula: string): { esValida: boolean; mensaje: string } {
  if (!cedula) {
    return { esValida: false, mensaje: 'La cédula es requerida' };
  }

  const str = String(cedula).trim();

  if (!/^\d{10}$/.test(str)) {
    return { esValida: false, mensaje: 'Debe contener exactamente 10 dígitos numéricos' };
  }

  const provincia = parseInt(str.substring(0, 2), 10);
  const provinciaValida = (provincia >= 1 && provincia <= 24) || provincia === 30;
  if (!provinciaValida) {
    return { esValida: false, mensaje: 'Código de provincia no válido' };
  }

  const tercerDigito = parseInt(str[2], 10);
  if (tercerDigito >= 6) {
    return { esValida: false, mensaje: 'El tercer dígito debe ser menor a 6' };
  }

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

export function cedulaEcuatorianaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
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
