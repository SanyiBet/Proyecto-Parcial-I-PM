import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from './core/services/theme.service';
import { SweetAlertService } from './core/services/sweet-alert.service';
import { validarCedulaEcuatorianaMatematica } from './shared/validators/cedula.validator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public themeService = inject(ThemeService);
  public sweetAlert = inject(SweetAlertService);

  // Estados interactivos para pruebas en vivo
  public cedulaPrueba: string = '';
  public resultadoCedula: { esValida: boolean; mensaje: string } | null = null;

  public alternarTema(): void {
    this.themeService.toggleTheme();
  }

  public probarValidacionCedula(): void {
    if (!this.cedulaPrueba) {
      this.resultadoCedula = null;
      return;
    }
    this.resultadoCedula = validarCedulaEcuatorianaMatematica(this.cedulaPrueba);
  }

  public probarAlertaExito(): void {
    this.sweetAlert.exito(
      'Sistema de Diseño TransOrense',
      'SweetAlert2 y el tema institucional están integrados y operativos con éxito.'
    );
  }

  public async probarConfirmacion(): Promise<void> {
    const confirmado = await this.sweetAlert.confirmar(
      '¿Desea continuar?',
      'Esta es una prueba de confirmación institucional de TransOrense.'
    );
    if (confirmado) {
      this.sweetAlert.toast('success', 'Acción confirmada con éxito');
    } else {
      this.sweetAlert.toast('info', 'Acción cancelada por el usuario');
    }
  }
}
