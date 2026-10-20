import { Injectable } from '@angular/core';

// Declaración global de SweetAlert2 inyectado vía CDN en index.html
declare const Swal: any;

@Injectable({
  providedIn: 'root',
})
export class SweetAlertService {
  private readonly COLOR_VERDE = '#00875A';
  private readonly COLOR_AMARILLO = '#FFCC00';
  private readonly COLOR_AZUL = '#003399';
  private readonly COLOR_ROJO = '#DC2626';

  /**
   * Muestra un modal de éxito institucional
   */
  public async exito(titulo: string, mensaje: string = ''): Promise<void> {
    if (typeof Swal === 'undefined') {
      alert(`✅ ${titulo}\n${mensaje}`);
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: titulo,
      text: mensaje,
      confirmButtonColor: this.COLOR_VERDE,
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'font-poppins rounded-xl shadow-xl',
        title: 'font-montserrat text-slate-800 dark:text-slate-100',
      },
    });
  }

  /**
   * Muestra un modal de error institucional
   */
  public async error(titulo: string, mensaje: string = ''): Promise<void> {
    if (typeof Swal === 'undefined') {
      alert(`❌ ${titulo}\n${mensaje}`);
      return;
    }

    await Swal.fire({
      icon: 'error',
      title: titulo,
      text: mensaje,
      confirmButtonColor: this.COLOR_ROJO,
      confirmButtonText: 'Cerrar',
      customClass: {
        popup: 'font-poppins rounded-xl shadow-xl',
        title: 'font-montserrat text-slate-800 dark:text-slate-100',
      },
    });
  }

  /**
   * Muestra un modal de advertencia institucional
   */
  public async advertencia(titulo: string, mensaje: string = ''): Promise<void> {
    if (typeof Swal === 'undefined') {
      alert(`⚠️ ${titulo}\n${mensaje}`);
      return;
    }

    await Swal.fire({
      icon: 'warning',
      title: titulo,
      text: mensaje,
      confirmButtonColor: this.COLOR_AMARILLO,
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'font-poppins rounded-xl shadow-xl',
        title: 'font-montserrat text-slate-800 dark:text-slate-100',
      },
    });
  }

  /**
   * Modal interactivo de confirmación con retorno booleano
   */
  public async confirmar(
    titulo: string,
    mensaje: string,
    textoConfirmar: string = 'Sí, continuar',
    textoCancelar: string = 'Cancelar'
  ): Promise<boolean> {
    if (typeof Swal === 'undefined') {
      return confirm(`${titulo}\n${mensaje}`);
    }

    const resultado = await Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: this.COLOR_VERDE,
      cancelButtonColor: '#64748B',
      confirmButtonText: textoConfirmar,
      cancelButtonText: textoCancelar,
      reverseButtons: true,
      customClass: {
        popup: 'font-poppins rounded-xl shadow-xl',
        title: 'font-montserrat text-slate-800 dark:text-slate-100',
      },
    });

    return resultado.isConfirmed;
  }

  /**
   * Notificación Toast flotante no intrusiva con auto-cierre
   */
  public toast(
    tipo: 'success' | 'error' | 'warning' | 'info',
    mensaje: string,
    duracionMs: number = 3000
  ): void {
    if (typeof Swal === 'undefined') {
      console.log(`[Toast ${tipo}]: ${mensaje}`);
      return;
    }

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: duracionMs,
      timerProgressBar: true,
      didOpen: (toastEl: HTMLElement) => {
        toastEl.addEventListener('mouseenter', Swal.stopTimer);
        toastEl.addEventListener('mouseleave', Swal.resumeTimer);
      },
    });

    Toast.fire({
      icon: tipo,
      title: mensaje,
    });
  }
}
