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
import { ViajesService } from '../../core/services/viajes.service';
import { AuthService } from '../../core/services/auth.service';
import { SweetAlertService } from '../../core/services/sweet-alert.service';
import { Viaje, Asiento, MapaAsientosRespuesta } from '../../core/models/viajes.models';

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
  public reservaConfirmada = output<{ viaje_id: string; asientos: string[]; total: number }>();
  public solicitarLogin = output<void>();

  // Estados
  public asientos = signal<Asiento[]>([]);
  public asientosSeleccionados = signal<string[]>([]);
  public cargando = signal<boolean>(false);
  public reservando = signal<boolean>(false);

  // Temporizador de 10 minutos (TTL 600s)
  public segundosRestantes = signal<number>(0);
  public reservaActivaId = signal<string | null>(null);
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

  private comprobarReservaActiva(): void {
    if (!this.authService.estaAutenticado()) return;

    this.viajesService.obtenerReservaActiva().subscribe({
      next: (res) => {
        if (res.reserva && res.reserva.viaje_id === this.viaje._id) {
          this.asientosSeleccionados.set(res.reserva.asientos);
          this.iniciarTimer(res.segundos_restantes || 600);
        }
      },
      error: () => {},
    });
  }

  public alternarAsiento(asiento: Asiento): void {
    // Si el asiento no está disponible y no es de los míos, no hacer nada
    if (asiento.estado === 'ocupado' || asiento.estado === 'bloqueado_temporal') {
      return;
    }

    const seleccionados = this.asientosSeleccionados();
    const index = seleccionados.indexOf(asiento.numero);

    if (index > -1) {
      this.asientosSeleccionados.update((lista) => lista.filter((n) => n !== asiento.numero));
    } else {
      if (seleccionados.length >= 4) {
        this.sweetAlert.advertencia(
          'Límite de selección',
          'Puedes reservar un máximo de 4 asientos por transacción.'
        );
        return;
      }
      this.asientosSeleccionados.update((lista) => [...lista, asiento.numero]);
    }
  }

  public esAsientoSeleccionado(numero: string): boolean {
    return this.asientosSeleccionados().includes(numero);
  }

  public async confirmarReservaTemporal(): Promise<void> {
    if (!this.authService.estaAutenticado()) {
      const quiereIngresar = await this.sweetAlert.confirmar(
        'Iniciar Sesión Requerido',
        'Para bloquear y reservar asientos en tiempo real, debes iniciar sesión o crear tu cuenta.',
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

    this.reservando.set(true);

    this.viajesService.crearReservaTemporal(this.viaje._id, this.asientosSeleccionados()).subscribe({
      next: (res) => {
        this.reservando.set(false);
        this.sweetAlert.exito(
          '¡Asientos Bloqueados Exitosamente!',
          `Tienes 10 minutos para ingresar los datos de tus pasajeros y pagar antes de que los asientos se liberen automáticamente.`
        );
        this.iniciarTimer(res.tiempo_limite_segundos || 600);
        this.cargarMapaAsientos();
      },
      error: (err: any) => {
        this.reservando.set(false);
        this.cargarMapaAsientos(); // Refrescar para ver quién lo ocupó
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
