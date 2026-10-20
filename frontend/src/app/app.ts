import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from './core/services/theme.service';
import { SweetAlertService } from './core/services/sweet-alert.service';
import { AuthService } from './core/services/auth.service';
import { AuthModalComponent } from './features/auth/auth-modal.component';
import { BuscadorViajesComponent } from './features/viajes/buscador-viajes.component';
import { MapaAsientosComponent } from './features/viajes/mapa-asientos.component';
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
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public themeService = inject(ThemeService);
  public sweetAlert = inject(SweetAlertService);
  public authService = inject(AuthService);

  // Control de modal de autenticación (CARD-12)
  public mostrarModalAuth = signal<boolean>(false);

  // Flujo de compra y selección de asientos (CARD-15 y CARD-16)
  public viajeActivo = signal<Viaje | null>(null);

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
  }

  public onVolverABuscador(): void {
    this.viajeActivo.set(null);
  }
}
