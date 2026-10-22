import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from './core/services/theme.service';
import { SweetAlertService } from './core/services/sweet-alert.service';
import { AuthService } from './core/services/auth.service';
import { AuthModalComponent } from './features/auth/auth-modal.component';
import { BuscadorViajesComponent } from './features/viajes/buscador-viajes/buscador-viajes.component';
import { MapaAsientosComponent } from './features/viajes/mapa-asientos/mapa-asientos.component';
import { FormularioPagoComponent } from './features/viajes/formulario-pago/formulario-pago.component';
import { PanelBoleteriaComponent } from './features/boleteria/panel-boleteria/panel-boleteria.component';
import { EncomiendasPublicoComponent } from './features/encomiendas/encomiendas-publico/encomiendas-publico.component';
import { Viaje } from './core/models/viajes.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    AuthModalComponent,
    BuscadorViajesComponent,
    MapaAsientosComponent,
    FormularioPagoComponent,
    PanelBoleteriaComponent,
    EncomiendasPublicoComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public themeService = inject(ThemeService);
  public sweetAlert = inject(SweetAlertService);
  public authService = inject(AuthService);

  // Módulo activo en la aplicación ('viajes' | 'boleteria' | 'encomiendas')
  public moduloActivo = signal<'viajes' | 'boleteria' | 'encomiendas'>('viajes');

  // Control de permisos para Agente de Boletería y Administrador (CARD-19)
  public puedeAccederBoleteria = computed(() => {
    const roles = this.authService.usuarioActual()?.roles || [];
    return roles.includes('administrador') || roles.includes('agente_boleteria');
  });

  // Control de modal de autenticación (CARD-12)
  public mostrarModalAuth = signal<boolean>(false);

  // Flujo de compra, asientos y pagos (CARD-15, CARD-16 y CARD-18)
  public viajeActivo = signal<Viaje | null>(null);
  public reservaParaPago = signal<{
    viaje: Viaje;
    asientos: string[];
    total: number;
    reservas_ids: string[];
  } | null>(null);

  public alternarTema(): void {
    this.themeService.toggleTheme();
  }

  public abrirModalAuth(): void {
    this.mostrarModalAuth.set(true);
  }

  public cerrarModalAuth(): void {
    this.mostrarModalAuth.set(false);
  }

  public onLoginExitoso(): void {
    this.mostrarModalAuth.set(false);
  }

  public cerrarSesion(): void {
    this.authService.cerrarSesion();
    this.sweetAlert.toast('info', 'Has cerrado sesión exitosamente.');
  }

  public onViajeSeleccionado(viaje: Viaje): void {
    this.viajeActivo.set(viaje);
    this.reservaParaPago.set(null);
  }

  public onVolverABuscador(): void {
    this.moduloActivo.set('viajes');
    this.viajeActivo.set(null);
    this.reservaParaPago.set(null);
  }

  public irAViajes(): void {
    this.moduloActivo.set('viajes');
  }

  public irAEncomiendas(): void {
    this.moduloActivo.set('encomiendas');
  }

  public irABoleteria(): void {
    this.moduloActivo.set('boleteria');
  }

  public onReservaConfirmada(evento: {
    viaje_id: string;
    asientos: string[];
    total: number;
    reservas_ids: string[];
  }): void {
    if (this.viajeActivo()) {
      this.reservaParaPago.set({
        viaje: this.viajeActivo()!,
        asientos: evento.asientos,
        total: evento.total,
        reservas_ids: evento.reservas_ids,
      });
    }
  }

  public onVolverAlMapa(): void {
    this.reservaParaPago.set(null);
  }

  public onPagoExitoso(): void {
    this.reservaParaPago.set(null);
    this.viajeActivo.set(null);
  }
}
