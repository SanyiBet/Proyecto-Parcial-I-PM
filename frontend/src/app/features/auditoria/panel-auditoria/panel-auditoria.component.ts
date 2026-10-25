import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuditoriaService,
  LogAuditoria,
  Incidencia,
  FiltrosAuditoria,
} from '../../../core/services/auditoria.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-panel-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-auditoria.component.html',
})
export class PanelAuditoriaComponent implements OnInit {
  private auditoriaService = inject(AuditoriaService);
  private sweetAlert = inject(SweetAlertService);

  public pestanaActiva = signal<'logs' | 'incidencias'>('logs');
  public cargando = signal<boolean>(false);

  // Logs de auditoría
  public logs = signal<LogAuditoria[]>([]);
  public totalLogs = signal<number>(0);
  public logSeleccionado = signal<LogAuditoria | null>(null);

  // Filtros de búsqueda
  public filtroEntidad = '';
  public filtroAccion = '';
  public filtroEstado = '';

  // Incidencias
  public incidencias = signal<Incidencia[]>([]);
  public totalIncidencias = signal<number>(0);
  public filtroEstadoIncidencia = '';
  public filtroSeveridadIncidencia = '';
  public mostrarModalIncidencia = signal<boolean>(false);

  public nuevaIncidencia = {
    titulo: '',
    descripcion: '',
    severidad: 'media',
    referencia_github: '',
  };
  public guardandoIncidencia = signal<boolean>(false);

  // URL del repositorio para enlazar issues en GitHub
  public readonly repoGithubUrl = 'https://github.com/SanyiBet/Proyecto-Parcial-I-PM/issues';

  ngOnInit(): void {
    this.cargarLogs();
    this.cargarIncidencias();
  }

  public cambiarPestana(pestana: 'logs' | 'incidencias'): void {
    this.pestanaActiva.set(pestana);
  }

  public cargarLogs(): void {
    this.cargando.set(true);
    const filtros: FiltrosAuditoria = {
      entidad: this.filtroEntidad || undefined,
      accion: this.filtroAccion || undefined,
      estado: this.filtroEstado || undefined,
      limite: 100,
    };

    this.auditoriaService.listarLogs(filtros).subscribe({
      next: (res) => {
        this.logs.set(res.auditorias || []);
        this.totalLogs.set(res.total || 0);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.sweetAlert.toast('error', err.error?.mensaje || 'Error al cargar bitácoras de auditoría');
      },
    });
  }

  public limpiarFiltros(): void {
    this.filtroEntidad = '';
    this.filtroAccion = '';
    this.filtroEstado = '';
    this.cargarLogs();
  }

  public verDetalleLog(log: LogAuditoria): void {
    this.logSeleccionado.set(log);
  }

  public cerrarDetalleLog(): void {
    this.logSeleccionado.set(null);
  }

  public cargarIncidencias(): void {
    const filtros = {
      estado: this.filtroEstadoIncidencia || undefined,
      severidad: this.filtroSeveridadIncidencia || undefined,
    };

    this.auditoriaService.listarIncidencias(filtros).subscribe({
      next: (res) => {
        this.incidencias.set(res.incidencias || []);
        this.totalIncidencias.set(res.total || 0);
      },
    });
  }

  public abrirModalIncidencia(): void {
    this.nuevaIncidencia = {
      titulo: '',
      descripcion: '',
      severidad: 'media',
      referencia_github: '',
    };
    this.mostrarModalIncidencia.set(true);
  }

  public cerrarModalIncidencia(): void {
    this.mostrarModalIncidencia.set(false);
  }

  public registrarIncidencia(): void {
    if (!this.nuevaIncidencia.titulo || this.nuevaIncidencia.titulo.trim().length < 4) {
      this.sweetAlert.toast('warning', 'El título debe tener al menos 4 caracteres');
      return;
    }
    if (!this.nuevaIncidencia.descripcion || this.nuevaIncidencia.descripcion.trim().length < 6) {
      this.sweetAlert.toast('warning', 'La descripción debe tener al menos 6 caracteres');
      return;
    }

    this.guardandoIncidencia.set(true);
    this.auditoriaService.reportarIncidencia(this.nuevaIncidencia).subscribe({
      next: (res) => {
        this.guardandoIncidencia.set(false);
        this.sweetAlert.toast('success', 'Incidencia técnica registrada correctamente');
        this.incidencias.update((prev) => [res.incidencia, ...prev]);
        this.totalIncidencias.update((t) => t + 1);
        this.cerrarModalIncidencia();
        // Recargar logs para ver la auditoría del reporte
        this.cargarLogs();
      },
      error: (err) => {
        this.guardandoIncidencia.set(false);
        this.sweetAlert.toast('error', err.error?.mensaje || 'Error al registrar incidencia');
      },
    });
  }

  public cambiarEstadoIncidencia(incidencia: Incidencia, nuevoEstado: string): void {
    this.auditoriaService
      .actualizarIncidencia(incidencia._id, { estado: nuevoEstado })
      .subscribe({
        next: () => {
          incidencia.estado = nuevoEstado as any;
          this.sweetAlert.toast('info', `Incidencia #${incidencia._id.substring(0, 8)} marcada como: ${nuevoEstado}`);
          this.cargarLogs();
        },
        error: (err) => {
          this.sweetAlert.toast('error', err.error?.mensaje || 'No fue posible actualizar la incidencia');
        },
      });
  }
}
