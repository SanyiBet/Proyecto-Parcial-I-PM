import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EncomiendasService,
  CotizacionResponse,
  RastreoResponse,
} from '../../../core/services/encomiendas.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-encomiendas-publico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './encomiendas-publico.component.html',
})
export class EncomiendasPublicoComponent {
  private encomiendasService = inject(EncomiendasService);
  private sweetAlert = inject(SweetAlertService);

  // Pestaña activa ('cotizador' | 'rastreo')
  public pestanaActiva = signal<'cotizador' | 'rastreo'>('cotizador');

  // Ciudades oficiales de la cooperativa TransOrense
  public ciudades: string[] = [
    'Machala',
    'Guayaquil',
    'Cuenca',
    'Loja',
    'Quito',
    'Santa Rosa',
    'Pasaje',
    'Huaquillas',
    'Piñas',
  ];

  // --- ESTADO DEL COTIZADOR ---
  public origen = signal<string>('Machala');
  public destino = signal<string>('Guayaquil');
  public pesoKg = signal<number>(2.0);
  public largoCm = signal<number>(25);
  public anchoCm = signal<number>(20);
  public altoCm = signal<number>(15);

  public cargandoCotizacion = signal<boolean>(false);
  public resultadoCotizacion = signal<CotizacionResponse | null>(null);

  // Previsualización instantánea reactiva local
  public get pesoVolumetricoEstimado(): number {
    const l = Math.max(1, this.largoCm() || 1);
    const a = Math.max(1, this.anchoCm() || 1);
    const h = Math.max(1, this.altoCm() || 1);
    return Number(((l * a * h) / 5000).toFixed(2));
  }

  public get pesoFacturableEstimado(): number {
    return Math.max(this.pesoKg() || 0.1, this.pesoVolumetricoEstimado);
  }

  public get tarifaEstimadaRapida(): number {
    const pFacturable = this.pesoFacturableEstimado;
    let base = 3.5;
    if (pFacturable > 2) {
      base += (pFacturable - 2) * 0.8;
    }
    return Number(base.toFixed(2));
  }

  // --- ESTADO DEL RASTREADOR ---
  public codigoRastreoInput = signal<string>('');
  public cargandoRastreo = signal<boolean>(false);
  public resultadoRastreo = signal<RastreoResponse['rastreo'] | null>(null);
  public errorRastreo = signal<string | null>(null);

  public cambiarPestana(pestana: 'cotizador' | 'rastreo'): void {
    this.pestanaActiva.set(pestana);
  }

  /**
   * Ejecuta la cotización oficial en el backend y almacena la cotización por 24 horas
   */
  public calcularCotizacionOficial(): void {
    if (!this.origen() || !this.destino()) {
      this.sweetAlert.error('Datos requeridos', 'Selecciona el origen y destino para cotizar');
      return;
    }
    if (this.origen() === this.destino()) {
      this.sweetAlert.advertencia('Ruta inválida', 'El origen y el destino no pueden ser la misma ciudad');
      return;
    }
    if (this.pesoKg() <= 0 || this.largoCm() <= 0 || this.anchoCm() <= 0 || this.altoCm() <= 0) {
      this.sweetAlert.error('Dimensiones inválidas', 'El peso y las dimensiones deben ser mayores a 0');
      return;
    }

    this.cargandoCotizacion.set(true);

    this.encomiendasService
      .cotizarEncomienda({
        origen: this.origen(),
        destino: this.destino(),
        peso_kg: this.pesoKg(),
        largo_cm: this.largoCm(),
        ancho_cm: this.anchoCm(),
        alto_cm: this.altoCm(),
      })
      .subscribe({
        next: (resp) => {
          this.cargandoCotizacion.set(false);
          this.resultadoCotizacion.set(resp);
          this.sweetAlert.exito('Cotización generada', `Tarifa calculada: $${resp.precio_estimado.toFixed(2)} USD (vigencia 24h)`);
        },
        error: (err) => {
          this.cargandoCotizacion.set(false);
          this.sweetAlert.error('Error al cotizar', err.error?.mensaje || 'Error al calcular la cotización');
        },
      });
  }

  /**
   * Consulta pública de seguimiento de encomienda
   */
  public buscarEncomienda(): void {
    const cod = this.codigoRastreoInput().trim();
    if (!cod) {
      this.sweetAlert.advertencia('Código requerido', 'Ingresa el código de guía de tu encomienda (Ej: TRO-7N8K4X2P)');
      return;
    }

    this.cargandoRastreo.set(true);
    this.errorRastreo.set(null);
    this.resultadoRastreo.set(null);

    this.encomiendasService.rastrearEncomienda(cod).subscribe({
      next: (resp) => {
        this.cargandoRastreo.set(false);
        this.resultadoRastreo.set(resp.rastreo);
      },
      error: (err) => {
        this.cargandoRastreo.set(false);
        this.errorRastreo.set(err.error?.mensaje || 'No se encontró la encomienda ingresada');
      },
    });
  }

  /**
   * Helper para determinar el índice de progreso en la línea de tiempo
   */
  public obtenerPasoEstado(estado: string): number {
    const orden: Record<string, number> = {
      recibida: 1,
      en_transito: 2,
      en_destino: 3,
      en_reparto: 4,
      entregada: 5,
      incidencia: 3,
      cancelada: 0,
    };
    return orden[estado] || 1;
  }

  /**
   * Retorna clase CSS según el estado de la encomienda
   */
  public obtenerBadgeEstado(estado: string): { texto: string; clase: string } {
    switch (estado) {
      case 'recibida':
        return { texto: 'Recibida en Agencia', clase: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' };
      case 'en_transito':
        return { texto: 'En Tránsito Interprovincial', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
      case 'en_destino':
        return { texto: 'En Agencia Destino', clase: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' };
      case 'en_reparto':
        return { texto: 'En Ruta de Entrega', clase: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' };
      case 'entregada':
        return { texto: 'Entregada con Éxito', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' };
      case 'incidencia':
        return { texto: 'Novedad / Incidencia', clase: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' };
      default:
        return { texto: estado, clase: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
    }
  }
}
