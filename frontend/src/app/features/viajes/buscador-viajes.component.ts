import { Component, OnInit, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViajesService } from '../../core/services/viajes.service';
import { Viaje, Ruta } from '../../core/models/viajes.models';
import { SweetAlertService } from '../../core/services/sweet-alert.service';

@Component({
  selector: 'app-buscador-viajes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador-viajes.component.html',
})
export class BuscadorViajesComponent implements OnInit {
  private viajesService = inject(ViajesService);
  private sweetAlert = inject(SweetAlertService);

  public viajeSeleccionado = output<Viaje>();

  // Estados
  public origenes = signal<string[]>(['Machala', 'Guayaquil', 'Cuenca', 'Loja', 'Quito']);
  public destinos = signal<string[]>(['Guayaquil', 'Machala', 'Cuenca', 'Loja', 'Quito']);

  public origenSeleccionado: string = 'Machala';
  public destinoSeleccionado: string = 'Guayaquil';
  public fechaSeleccionada: string = new Date().toISOString().split('T')[0];

  public viajes = signal<Viaje[]>([]);
  public cargando = signal<boolean>(false);
  public busquedaRealizada = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarRutas();
    this.buscar();
  }

  public cargarRutas(): void {
    this.viajesService.obtenerRutas().subscribe({
      next: (res) => {
        if (res.rutas && res.rutas.length > 0) {
          const origenesUnicos = Array.from(new Set(res.rutas.map((r) => r.origen)));
          const destinosUnicos = Array.from(new Set(res.rutas.map((r) => r.destino)));
          this.origenes.set(origenesUnicos);
          this.destinos.set(destinosUnicos);
        }
      },
      error: () => {},
    });
  }

  public invertirCiudades(): void {
    const temp = this.origenSeleccionado;
    this.origenSeleccionado = this.destinoSeleccionado;
    this.destinoSeleccionado = temp;
    this.buscar();
  }

  public buscar(): void {
    if (this.origenSeleccionado === this.destinoSeleccionado) {
      this.sweetAlert.advertencia(
        'Ruta no válida',
        'El origen y el destino no pueden ser la misma terminal.'
      );
      return;
    }

    this.cargando.set(true);
    this.busquedaRealizada.set(true);

    this.viajesService
      .buscarViajes(this.origenSeleccionado, this.destinoSeleccionado, this.fechaSeleccionada)
      .subscribe({
        next: (res) => {
          this.cargando.set(false);
          this.viajes.set(res.viajes || []);
        },
        error: (err: any) => {
          this.cargando.set(false);
          this.sweetAlert.error('Error al buscar viajes', err.error?.mensaje || 'No se pudo conectar con el servidor.');
        },
      });
  }

  public seleccionar(viaje: Viaje): void {
    this.viajeSeleccionado.emit(viaje);
  }
}
