import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import {
  ClienteService,
  ReservaCliente,
  PagoCliente,
  EncomiendaCliente,
} from '../../../core/services/cliente.service';
import { validarCedulaEcuatorianaMatematica } from '../../../shared/validators/cedula.validator';

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mi-cuenta.component.html',
})
export class MiCuentaComponent implements OnInit {
  public authService = inject(AuthService);
  private clienteService = inject(ClienteService);
  private sweetAlert = inject(SweetAlertService);

  public pestanaActiva = signal<'boletos' | 'pagos' | 'encomiendas' | 'perfil'>('boletos');
  public cargando = signal<boolean>(false);

  public reservas = signal<ReservaCliente[]>([]);
  public pagos = signal<PagoCliente[]>([]);
  public encomiendas = signal<EncomiendaCliente[]>([]);

  // Modal de Boleto Digital
  public boletoSeleccionado = signal<ReservaCliente | null>(null);
  public mostrarModalBoleto = signal<boolean>(false);

  // Vincular cédula
  public nuevaCedula = '';
  public cedulaValida = false;
  public vinculandoCedula = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarDatos();
  }

  public cambiarPestana(pestana: 'boletos' | 'pagos' | 'encomiendas' | 'perfil'): void {
    this.pestanaActiva.set(pestana);
  }

  public cargarDatos(): void {
    this.cargando.set(true);

    this.clienteService.obtenerMisReservas().subscribe({
      next: (res) => {
        this.reservas.set(res.reservas || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });

    this.clienteService.obtenerMisPagos().subscribe({
      next: (res) => {
        this.pagos.set(res.pagos || []);
      },
      error: () => {},
    });

    this.clienteService.obtenerMisEncomiendas().subscribe({
      next: (res) => {
        this.encomiendas.set(res.encomiendas || []);
      },
      error: () => {},
    });
  }

  public abrirModalBoleto(reserva: ReservaCliente): void {
    this.boletoSeleccionado.set(reserva);
    this.mostrarModalBoleto.set(true);
  }

  public cerrarModalBoleto(): void {
    this.mostrarModalBoleto.set(false);
    this.boletoSeleccionado.set(null);
  }

  public imprimirBoleto(): void {
    window.print();
  }

  public onCedulaChange(): void {
    const res = validarCedulaEcuatorianaMatematica(this.nuevaCedula);
    this.cedulaValida = res.esValida;
  }

  public vincularCedula(): void {
    if (!this.cedulaValida) {
      this.sweetAlert.toast('warning', 'Ingrese una cédula ecuatoriana válida de 10 dígitos.');
      return;
    }

    this.vinculandoCedula.set(true);
    this.authService.completarCedula(this.nuevaCedula).subscribe({
      next: () => {
        this.vinculandoCedula.set(false);
        this.sweetAlert.toast('success', '¡Cédula vinculada exitosamente a tu cuenta!');
        this.nuevaCedula = '';
        this.cargarDatos();
      },
      error: (err) => {
        this.vinculandoCedula.set(false);
        this.sweetAlert.toast('error', err.error?.mensaje || 'Error al vincular cédula.');
      },
    });
  }
}
