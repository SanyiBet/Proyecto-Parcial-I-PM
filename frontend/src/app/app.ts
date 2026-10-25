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
import { PanelOperadorEncomiendasComponent } from './features/encomiendas/panel-operador-encomiendas/panel-operador-encomiendas.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { PanelAuditoriaComponent } from './features/auditoria/panel-auditoria/panel-auditoria.component';
import { TicketDigitalComponent } from './shared/components/ticket-digital/ticket-digital.component';
import { TicketService } from './core/services/ticket.service';
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
    PanelOperadorEncomiendasComponent,
    AdminDashboardComponent,
    PanelAuditoriaComponent,
    TicketDigitalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public themeService = inject(ThemeService);
  public sweetAlert = inject(SweetAlertService);
  public authService = inject(AuthService);
  public ticketService = inject(TicketService);

  // Módulo activo en la aplicación ('viajes' | 'boleteria' | 'encomiendas' | 'operador_encomiendas' | 'admin' | 'auditoria')
  public moduloActivo = signal<'viajes' | 'boleteria' | 'encomiendas' | 'operador_encomiendas' | 'admin' | 'auditoria'>('viajes');

  // Control de permisos para Agente de Boletería y Administrador (CARD-19)
  public puedeAccederBoleteria = computed(() => {
    const roles = this.authService.usuarioActual()?.roles || [];
    return roles.includes('administrador') || roles.includes('agente_boleteria');
  });

  // Control de permisos para Operador de Encomiendas y Administrador (CARD-23)
  public puedeAccederOperadorEncomiendas = computed(() => {
    const roles = this.authService.usuarioActual()?.roles || [];
    return roles.includes('administrador') || roles.includes('operador_encomiendas');
  });

  // Control de permisos para Administrador Directivo (CARD-26)
  public puedeAccederAdmin = computed(() => {
    const roles = this.authService.usuarioActual()?.roles || [];
    return roles.includes('administrador');
  });

  // Control de permisos para Auditor Técnico y Administrador (CARD-27)
  public puedeAccederAuditoria = computed(() => {
    const roles = this.authService.usuarioActual()?.roles || [];
    return roles.includes('administrador') || roles.includes('auditor_tecnico');
  });

  // Control de modal de autenticación (CARD-12)
  public mostrarModalAuth = signal<boolean>(false);

  // Control de Menú Móvil Táctil Desplegable (CARD-34)
  public menuMovilAbierto = signal<boolean>(false);

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

  public alternarMenuMovil(): void {
    this.menuMovilAbierto.update((v) => !v);
  }

  public cerrarMenuMovil(): void {
    this.menuMovilAbierto.set(false);
  }

  public abrirModalAuth(): void {
    this.cerrarMenuMovil();
    this.mostrarModalAuth.set(true);
  }

  public cerrarModalAuth(): void {
    this.mostrarModalAuth.set(false);
  }

  public onLoginExitoso(): void {
    this.mostrarModalAuth.set(false);
  }

  public cerrarSesion(): void {
    this.cerrarMenuMovil();
    this.authService.cerrarSesion();
    this.sweetAlert.toast('info', 'Has cerrado sesión exitosamente.');
  }

  public onViajeSeleccionado(viaje: Viaje): void {
    this.viajeActivo.set(viaje);
    this.reservaParaPago.set(null);
  }

  public onVolverABuscador(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('viajes');
    this.viajeActivo.set(null);
    this.reservaParaPago.set(null);
  }

  public irAViajes(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('viajes');
  }

  public irAEncomiendas(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('encomiendas');
  }

  public irABoleteria(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('boleteria');
  }

  public irAOperadorEncomiendas(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('operador_encomiendas');
  }

  public irAAdmin(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('admin');
  }

  public irAAuditoria(): void {
    this.cerrarMenuMovil();
    this.moduloActivo.set('auditoria');
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
