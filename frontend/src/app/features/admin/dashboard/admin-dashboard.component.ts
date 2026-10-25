import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminKPIs,
  UsuarioAdmin,
  RutaAdmin,
  BusAdmin,
} from '../../../core/services/admin.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private sweetAlert = inject(SweetAlertService);

  public pestanaActiva = signal<'kpis' | 'rutas' | 'buses' | 'usuarios'>('kpis');
  public cargando = signal<boolean>(false);

  // Datos
  public kpis = signal<AdminKPIs | null>(null);
  public ultimosPagos = signal<any[]>([]);
  public rutas = signal<RutaAdmin[]>([]);
  public buses = signal<BusAdmin[]>([]);
  public usuarios = signal<UsuarioAdmin[]>([]);
  public busquedaUsuario = '';

  // Modelo de nueva ruta
  public nuevaRuta = {
    origen: '',
    destino: '',
    duracion_minutos: 180,
  };
  public guardandoRuta = signal<boolean>(false);

  // Modelo de nuevo bus
  public nuevoBus = {
    placa: '',
    descripcion: '',
    capacidad: 40,
  };
  public guardandoBus = signal<boolean>(false);

  // Lista de ciudades oficiales
  public ciudades = [
    'Machala',
    'Santa Rosa',
    'Pasaje',
    'Huaquillas',
    'Guayaquil',
    'Cuenca',
    'Loja',
    'Quito',
    'Naranjal',
  ];

  // Roles permitidos en el sistema (RBAC)
  public rolesDisponibles = [
    { id: 'cliente', label: 'Cliente Ordinario' },
    { id: 'agente_boleteria', label: 'Agente de Boletería' },
    { id: 'operador_encomiendas', label: 'Operador de Carga' },
    { id: 'auditor_tecnico', label: 'Auditor Técnico' },
    { id: 'administrador', label: 'Administrador' },
  ];

  ngOnInit(): void {
    this.cargarDatos();
  }

  public cambiarPestana(pestana: 'kpis' | 'rutas' | 'buses' | 'usuarios'): void {
    this.pestanaActiva.set(pestana);
  }

  public cargarDatos(): void {
    this.cargando.set(true);

    // Cargar métricas
    this.adminService.obtenerMetricas().subscribe({
      next: (res) => {
        this.kpis.set(res.kpis);
        this.ultimosPagos.set(res.ultimos_pagos || []);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    // Cargar rutas
    this.adminService.obtenerRutas().subscribe({
      next: (res) => this.rutas.set(res.rutas || []),
    });

    // Cargar buses
    this.adminService.obtenerBuses().subscribe({
      next: (res) => this.buses.set(res.buses || []),
    });

    // Cargar usuarios
    this.buscarUsuarios();
  }

  public buscarUsuarios(): void {
    this.adminService.listarUsuarios(this.busquedaUsuario).subscribe({
      next: (res) => this.usuarios.set(res.usuarios || []),
    });
  }

  public onCambioRol(usuario: UsuarioAdmin, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const nuevoRol = target.value;
    if (!nuevoRol) return;

    this.adminService.actualizarRol(usuario._id, [nuevoRol]).subscribe({
      next: () => {
        this.sweetAlert.toast('success', `Rol de ${usuario.nombre} actualizado a: ${nuevoRol}`);
        usuario.roles = [nuevoRol];
      },
      error: (err) => {
        this.sweetAlert.toast('error', err.error?.mensaje || 'Error al actualizar rol');
      },
    });
  }

  public crearNuevaRuta(): void {
    if (!this.nuevaRuta.origen || !this.nuevaRuta.destino) {
      this.sweetAlert.toast('warning', 'Debe seleccionar origen y destino');
      return;
    }
    if (this.nuevaRuta.origen === this.nuevaRuta.destino) {
      this.sweetAlert.toast('warning', 'Origen y destino no pueden ser la misma ciudad');
      return;
    }

    this.guardandoRuta.set(true);
    this.adminService.crearRuta(this.nuevaRuta).subscribe({
      next: (res) => {
        this.guardandoRuta.set(false);
        this.sweetAlert.toast('success', 'Nueva ruta interprovincial creada con éxito');
        this.rutas.update((prev) => [res.ruta, ...prev]);
        this.nuevaRuta = { origen: '', destino: '', duracion_minutos: 180 };
      },
      error: (err) => {
        this.guardandoRuta.set(false);
        this.sweetAlert.toast('error', err.error?.mensaje || 'Error al crear ruta');
      },
    });
  }

  public alternarRuta(ruta: RutaAdmin): void {
    const nuevoEstado = ruta.estado === 'activo' ? 'inactivo' : 'activo';
    this.adminService.alternarEstadoRuta(ruta._id, nuevoEstado).subscribe({
      next: () => {
        ruta.estado = nuevoEstado;
        this.sweetAlert.toast('info', `Ruta ${ruta.origen} - ${ruta.destino} marcada como ${nuevoEstado}`);
      },
    });
  }

  public crearNuevoBus(): void {
    const placaRegex = /^[A-Z]{3}-[0-9]{3,4}$/;
    if (!this.nuevoBus.placa || !placaRegex.test(this.nuevoBus.placa.toUpperCase().trim())) {
      this.sweetAlert.toast('warning', 'Ingrese una placa válida con formato ABC-1234');
      return;
    }

    this.guardandoBus.set(true);
    this.adminService
      .crearBus({
        ...this.nuevoBus,
        placa: this.nuevoBus.placa.toUpperCase().trim(),
      })
      .subscribe({
        next: (res) => {
          this.guardandoBus.set(false);
          this.sweetAlert.toast('success', 'Unidad de transporte registrada con 40 asientos');
          this.buses.update((prev) => [res.bus, ...prev]);
          this.nuevoBus = { placa: '', descripcion: '', capacidad: 40 };
        },
        error: (err) => {
          this.guardandoBus.set(false);
          this.sweetAlert.toast('error', err.error?.mensaje || 'Error al registrar bus');
        },
      });
  }
}
