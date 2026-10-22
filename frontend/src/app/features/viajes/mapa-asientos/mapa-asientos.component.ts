import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViajesService } from '../../../core/services/viajes.service';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { Viaje, Asiento, MapaAsientosRespuesta } from '../../../core/models/viajes.models';

@Component({
  selector: 'app-mapa-asientos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-asientos.component.html',
})
export class MapaAsientosComponent implements OnInit, OnDestroy {
  @Input({ required: true }) viaje!: Viaje;

  private viajesService = inject(ViajesService);
  public authService = inject(AuthService);
  private sweetAlert = inject(SweetAlertService);

  public volver = output<void>();
  public reservaConfirmada = output<{
    viaje_id: string;
    asientos: string[];
    total: number;
    reservas_ids: string[];
  }>();
  public solicitarLogin = output<void>();

  // Estados
  public asientos = signal<Asiento[]>([]);
  public asientosSeleccionados = signal<string[]>([]);
  public cargando = signal<boolean>(false);
  public reservando = signal<boolean>(false);

  // Temporizador de 10 minutos (TTL 600s)
  public segundosRestantes = signal<number>(0);
  public reservaActivaId = signal<string | null>(null);
  public reservasIds = signal<string[]>([]);
  private intervaloTimer: any = null;

  // Total calculado
  public totalPagar = computed(() => {
    return Number((this.viaje.precio * this.asientosSeleccionados().length).toFixed(2));
  });

  // Formato MM:SS
  public tiempoFormateado = computed(() => {
    const s = this.segundosRestantes();
    const minutos = Math.floor(s / 60);
    const segundos = s % 60;
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  });

  ngOnInit(): void {
    this.cargarMapaAsientos();
    this.comprobarReservaActiva();
  }

  ngOnDestroy(): void {
    this.detenerTimer();
  }

  public cargarMapaAsientos(): void {
    this.cargando.set(true);
    this.viajesService.obtenerMapaAsientos(this.viaje._id).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.asientos.set(res.asientos || []);
      },
      error: (err: any) => {
        this.cargando.set(false);
        this.sweetAlert.error('Error', err.error?.mensaje || 'No se pudo cargar la distribución del bus');
      },
    });
  }

  public comprobarReservaActiva(): void {
    if (!this.authService.estaAutenticado()) return;

    this.viajesService.obtenerReservaActiva().subscribe({
      next: (res) => {
        if (res.reserva && res.reserva.viaje_id === this.viaje._id && (res.segundos_restantes || 0) > 0) {
          this.asientosSeleccionados.set(res.reserva.asientos || []);
          this.iniciarTimer(res.segundos_restantes!);
        }
      },
      error: () => {},
    });
  }

  public alternarAsiento(asiento: Asiento): void {
    if (asiento.estado === 'ocupado' || asiento.estado === 'bloqueado_temporal') {
      return;
    }

    const seleccionados = [...this.asientosSeleccionados()];
    const index = seleccionados.indexOf(asiento.numero);

    if (index > -1) {
      seleccionados.splice(index, 1);
    } else {
      if (seleccionados.length >= 5) {
        this.sweetAlert.advertencia('Límite de selección', 'Puedes seleccionar hasta 5 asientos por compra.');
        return;
      }
      seleccionados.push(asiento.numero);
    }

    this.asientosSeleccionados.set(seleccionados);
  }

  public esSeleccionado(numero: string): boolean {
    return this.asientosSeleccionados().includes(numero);
  }

  public esAsientoSeleccionado(numero: string): boolean {
    return this.asientosSeleccionados().includes(numero);
  }

  public async confirmarReservaTemporal(): Promise<void> {
    if (!this.authService.estaAutenticado()) {
      const quiereIngresar = await this.sweetAlert.confirmar(
        'Inicio de Sesión Requerido',
        'Para bloquear y reservar tus asientos debes iniciar sesión o crear una cuenta.',
        'Iniciar Sesión',
        'Cancelar'
      );
      if (quiereIngresar) {
        this.solicitarLogin.emit();
      }
      return;
    }

    if (this.asientosSeleccionados().length === 0) {
      this.sweetAlert.advertencia('Atención', 'Selecciona al menos un asiento en el plano del bus.');
      return;
    }

    // Si ya tiene una reserva activa y el temporizador está corriendo, avanza directo al formulario
    if (this.segundosRestantes() > 0) {
      this.reservaConfirmada.emit({
        viaje_id: this.viaje._id,
        asientos: this.asientosSeleccionados(),
        total: this.totalPagar(),
        reservas_ids: this.reservasIds(),
      });
      return;
    }

    this.reservando.set(true);

    this.viajesService.crearReservaTemporal(this.viaje._id, this.asientosSeleccionados()).subscribe({
      next: (res) => {
        this.reservando.set(false);
        const ids = res.reservas_ids || [];
        this.reservasIds.set(ids);
        this.iniciarTimer(res.tiempo_limite_segundos || 600);
        this.cargarMapaAsientos();

        this.reservaConfirmada.emit({
          viaje_id: this.viaje._id,
          asientos: this.asientosSeleccionados(),
          total: res.total || this.totalPagar(),
          reservas_ids: ids,
        });
      },
      error: (err: any) => {
        this.reservando.set(false);
        this.cargarMapaAsientos();
        this.sweetAlert.error(
          'Conflicto de reserva',
          err.error?.mensaje || 'No se pudieron reservar los asientos seleccionados.'
        );
      },
    });
  }

  private iniciarTimer(segundos: number): void {
    this.detenerTimer();
    this.segundosRestantes.set(segundos);

    this.intervaloTimer = setInterval(() => {
      const actual = this.segundosRestantes();
      if (actual <= 1) {
        this.detenerTimer();
        this.segundosRestantes.set(0);
        this.asientosSeleccionados.set([]);
        this.cargarMapaAsientos();
        this.sweetAlert.advertencia(
          'Tiempo Expirado',
          'Los 10 minutos de reserva temporal concluyeron. Los asientos han sido liberados para otros usuarios.'
        );
      } else {
        this.segundosRestantes.set(actual - 1);
      }
    }, 1000);
  }

  private detenerTimer(): void {
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  public async cancelarMiReserva(): Promise<void> {
    const confirmar = await this.sweetAlert.confirmar(
      '¿Cancelar reserva temporal?',
      'Los asientos volverán a quedar disponibles inmediatamente para otros pasajeros.',
      'Sí, liberar asientos',
      'No, mantenerlos'
    );

    if (!confirmar) return;

    this.viajesService.cancelarReserva(this.viaje._id, this.asientosSeleccionados()).subscribe({
      next: () => {
        this.detenerTimer();
        this.segundosRestantes.set(0);
        this.asientosSeleccionados.set([]);
        this.cargarMapaAsientos();
        this.sweetAlert.toast('info', 'Asientos liberados exitosamente');
      },
      error: () => {},
    });
  }
}
