import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PagosService } from '../../../core/services/pagos.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-panel-boleteria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-boleteria.component.html',
})
export class PanelBoleteriaComponent implements OnInit {
  private pagosService = inject(PagosService);
  public authService = inject(AuthService);
  private sweetAlert = inject(SweetAlertService);

  public readonly baseUrl = environment.apiUrl.replace('/api', '');

  public pagos = signal<any[]>([]);
  public cargando = signal<boolean>(false);
  public procesandoAccion = signal<boolean>(false);
  public filtroEstado = signal<string>('todos');
  public busqueda = signal<string>('');

  // Modal para ver comprobante ampliado
  public comprobanteModal = signal<{ url: string; referencia: string; importe: number } | null>(null);

  // Lista filtrada reactiva
  public pagosFiltrados = computed(() => {
    let lista = this.pagos();
    const filtro = this.filtroEstado();
    const term = this.busqueda().trim().toLowerCase();

    if (filtro !== 'todos') {
      lista = lista.filter((p) => p.estado === filtro);
    }

    if (term) {
      lista = lista.filter((p) => {
        const ref = (p.referencia || '').toLowerCase();
        const pasajero = (p.pasajero_detalle?.nombre || '').toLowerCase();
        const cedula = (p.pasajero_detalle?.identificacion || '').toLowerCase();
        const ruta = (p.viaje_detalle ? `${p.viaje_detalle.ruta_id}` : '').toLowerCase();
        return ref.includes(term) || pasajero.includes(term) || cedula.includes(term) || ruta.includes(term);
      });
    }

    return lista;
  });

  // Estadísticas rápidas
  public totalPendientes = computed(() => this.pagos().filter((p) => p.estado === 'en_revision' || p.estado === 'pendiente').length);
  public totalAprobados = computed(() => this.pagos().filter((p) => p.estado === 'aprobado').length);
  public totalRechazados = computed(() => this.pagos().filter((p) => p.estado === 'rechazado').length);

  ngOnInit(): void {
    this.cargarPagos();
  }

  public cargarPagos(): void {
    this.cargando.set(true);
    this.pagosService.obtenerPagosPendientes().subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.pagos.set(res.pagos || []);
      },
      error: (err: any) => {
        this.cargando.set(false);
        this.sweetAlert.error(
          'Error de Conexión',
          err.error?.mensaje || 'No se pudo cargar la bandeja de pagos pendientes.'
        );
      },
    });
  }

  public abrirVisor(pago: any): void {
    if (!pago.comprobante_url) {
      this.sweetAlert.advertencia('Sin Comprobante', 'Este registro no tiene comprobante adjunto.');
      return;
    }

    const fullUrl = pago.comprobante_url.startsWith('http')
      ? pago.comprobante_url
      : `${this.baseUrl}${pago.comprobante_url}`;

    this.comprobanteModal.set({
      url: fullUrl,
      referencia: pago.referencia,
      importe: pago.importe,
    });
  }

  public cerrarVisor(): void {
    this.comprobanteModal.set(null);
  }

  public async confirmarAprobacion(pago: any): Promise<void> {
    const confirmar = await this.sweetAlert.confirmar(
      '¿Aprobar comprobante bancario?',
      `Confirmarás el pago de $${pago.importe.toFixed(2)} (Ref: #${pago.referencia}). Las reservas se emitirán definitivamente y se liberarán los boletos.`,
      'Sí, Aprobar y Emitir Boletos',
      'Cancelar'
    );

    if (!confirmar) return;

    this.procesandoAccion.set(true);
    this.pagosService.aprobarPago(pago._id).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.sweetAlert.exito(
          '¡Pago Aprobado con Éxito!',
          `El comprobante #${pago.referencia} ha sido validado. Los boletos están confirmados.`
        );
        this.cargarPagos();
      },
      error: (err: any) => {
        this.procesandoAccion.set(false);
        this.sweetAlert.error('Error al aprobar', err.error?.mensaje || 'Ocurrió un error al procesar la aprobación.');
      },
    });
  }

  public async confirmarRechazo(pago: any): Promise<void> {
    const confirmar = await this.sweetAlert.confirmar(
      '¿Rechazar comprobante?',
      `El comprobante #${pago.referencia} será rechazado, las reservas se cancelarán y los asientos volverán a estar disponibles en el sistema.`,
      'Sí, Rechazar Pago',
      'Cancelar'
    );

    if (!confirmar) return;

    const motivo = prompt('Por favor ingresa el motivo del rechazo para notificar al cliente:', 'Comprobante no coincide con el valor de la reserva o es ilegible.');
    if (motivo === null) return;

    this.procesandoAccion.set(true);
    this.pagosService.rechazarPago(pago._id, motivo).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.sweetAlert.toast('info', `Comprobante #${pago.referencia} rechazado.`);
        this.cargarPagos();
      },
      error: (err: any) => {
        this.procesandoAccion.set(false);
        this.sweetAlert.error('Error al rechazar', err.error?.mensaje || 'Ocurrió un error al procesar el rechazo.');
      },
    });
  }
}
