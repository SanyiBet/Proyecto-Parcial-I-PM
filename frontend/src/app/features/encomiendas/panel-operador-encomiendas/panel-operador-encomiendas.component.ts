import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EncomiendasService,
  EncomiendaItem,
  RegistroEncomiendaPayload,
  MovimientoHito,
} from '../../../core/services/encomiendas.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { validarCedulaEcuatorianaMatematica } from '../../../shared/validators/cedula.validator';

@Component({
  selector: 'app-panel-operador-encomiendas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-operador-encomiendas.component.html',
})
export class PanelOperadorEncomiendasComponent implements OnInit {
  private encomiendasService = inject(EncomiendasService);
  private sweetAlert = inject(SweetAlertService);

  // Pestaña activa ('registro' | 'bandeja')
  public pestanaActiva = signal<'registro' | 'bandeja'>('registro');

  // Listado y filtros de bandeja
  public encomiendas = signal<EncomiendaItem[]>([]);
  public cargando = signal<boolean>(false);
  public filtroEstado = signal<string>('todos');
  public busquedaTexto = signal<string>('');

  // Ciudades oficiales de la red TransOrense
  public ciudades: string[] = [
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

  // Modelo de nueva encomienda
  public nuevoRegistro = {
    remitente: {
      nombre: '',
      cedula: '',
      telefono: '',
    },
    destinatario: {
      nombre: '',
      cedula: '',
      telefono: '',
    },
    origen: 'Machala',
    destino: 'Guayaquil',
    peso_kg: 2,
    dimensiones: {
      largo_cm: 20,
      ancho_cm: 15,
      alto_cm: 10,
    },
    descripcion_paquete: '',
  };

  // Validación de cédulas reactivas en formulario
  public cedulaRemitenteValida = signal<boolean>(false);
  public cedulaRemitenteTocada = signal<boolean>(false);
  public cedulaDestinatarioValida = signal<boolean>(false);
  public cedulaDestinatarioTocada = signal<boolean>(false);

  // Estimación tarifaria en vivo
  public calculoTarifa = signal<{
    pesoVolumetrico: number;
    pesoFacturable: number;
    precioFinal: number;
  }>({
    pesoVolumetrico: 0.6,
    pesoFacturable: 2.0,
    precioFinal: 3.5,
  });

  // Modal de Etiqueta / Guía emitida
  public encomiendaEmitida = signal<any | null>(null);
  public mostrarModalGuia = signal<boolean>(false);

  // Modal de Actualización de Movimiento
  public encomiendaSeleccionada = signal<EncomiendaItem | null>(null);
  public mostrarModalMovimiento = signal<boolean>(false);
  public nuevoMovimiento = {
    estado: 'en_transito',
    ubicacion: '',
    observacion: '',
  };

  // Modal de Historial / Detalle
  public historialModal = signal<MovimientoHito[]>([]);
  public mostrarModalHistorial = signal<boolean>(false);

  public ngOnInit(): void {
    this.recalcularTarifaEnVivo();
    this.cargarEncomiendas();
  }

  // ==========================================
  // CÁLCULO TARIFARIO EN VIVO
  // ==========================================
  public recalcularTarifaEnVivo(): void {
    const pesoReal = Math.max(0.1, Number(this.nuevoRegistro.peso_kg) || 0);
    const largo = Math.max(1, Number(this.nuevoRegistro.dimensiones.largo_cm) || 1);
    const ancho = Math.max(1, Number(this.nuevoRegistro.dimensiones.ancho_cm) || 1);
    const alto = Math.max(1, Number(this.nuevoRegistro.dimensiones.alto_cm) || 1);

    // Factor 5000 IATA / Terrestre
    const volumen = largo * ancho * alto;
    const pesoVol = Number((volumen / 5000).toFixed(2));
    const pesoFact = Number(Math.max(pesoReal, pesoVol).toFixed(2));

    // Base $3.50 (hasta 2 kg) + $0.80/kg adicional
    let total = 3.5;
    if (pesoFact > 2.0) {
      total += (pesoFact - 2.0) * 0.8;
    }

    this.calculoTarifa.set({
      pesoVolumetrico: pesoVol,
      pesoFacturable: pesoFact,
      precioFinal: Number(total.toFixed(2)),
    });
  }

  public validarCedulaRem(): void {
    this.cedulaRemitenteTocada.set(true);
    const res = validarCedulaEcuatorianaMatematica(this.nuevoRegistro.remitente.cedula);
    this.cedulaRemitenteValida.set(res.esValida);
  }

  public validarCedulaDest(): void {
    this.cedulaDestinatarioTocada.set(true);
    const res = validarCedulaEcuatorianaMatematica(this.nuevoRegistro.destinatario.cedula);
    this.cedulaDestinatarioValida.set(res.esValida);
  }

  // ==========================================
  // REGISTRO DE ENCOMIENDA
  // ==========================================
  public registrarEncomienda(): void {
    // Validar cédulas
    this.validarCedulaRem();
    this.validarCedulaDest();

    if (!this.cedulaRemitenteValida()) {
      this.sweetAlert.error('Cédula del Remitente inválida', 'Debe ingresar una cédula ecuatoriana válida (Módulo 10).');
      return;
    }

    if (!this.cedulaDestinatarioValida()) {
      this.sweetAlert.error('Cédula del Destinatario inválida', 'Debe ingresar una cédula ecuatoriana válida (Módulo 10).');
      return;
    }

    if (!this.nuevoRegistro.remitente.nombre.trim() || !this.nuevoRegistro.remitente.telefono.trim()) {
      this.sweetAlert.advertencia('Datos incompletos', 'Complete los datos obligatorios del remitente.');
      return;
    }

    if (!this.nuevoRegistro.destinatario.nombre.trim() || !this.nuevoRegistro.destinatario.telefono.trim()) {
      this.sweetAlert.advertencia('Datos incompletos', 'Complete los datos obligatorios del destinatario.');
      return;
    }

    if (this.nuevoRegistro.origen === this.nuevoRegistro.destino) {
      this.sweetAlert.advertencia('Ruta inválida', 'El origen y el destino no pueden ser la misma ciudad.');
      return;
    }

    const payload: RegistroEncomiendaPayload = {
      remitente: {
        nombre: this.nuevoRegistro.remitente.nombre.trim(),
        cedula: this.nuevoRegistro.remitente.cedula.trim(),
        telefono: this.nuevoRegistro.remitente.telefono.trim(),
      },
      destinatario: {
        nombre: this.nuevoRegistro.destinatario.nombre.trim(),
        cedula: this.nuevoRegistro.destinatario.cedula.trim(),
        telefono: this.nuevoRegistro.destinatario.telefono.trim(),
      },
      origen: this.nuevoRegistro.origen,
      destino: this.nuevoRegistro.destino,
      peso_kg: Number(this.nuevoRegistro.peso_kg),
      dimensiones: {
        largo_cm: Number(this.nuevoRegistro.dimensiones.largo_cm),
        ancho_cm: Number(this.nuevoRegistro.dimensiones.ancho_cm),
        alto_cm: Number(this.nuevoRegistro.dimensiones.alto_cm),
      },
      descripcion_paquete: this.nuevoRegistro.descripcion_paquete.trim(),
      precio_final: this.calculoTarifa().precioFinal,
    };

    this.cargando.set(true);
    this.encomiendasService.registrarEncomienda(payload).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.encomiendaEmitida.set(res.encomienda);
        this.mostrarModalGuia.set(true);
        this.sweetAlert.toast('success', `Guía ${res.encomienda.codigo_rastreo} generada con éxito.`);

        // Limpiar formulario
        this.limpiarFormulario();
        // Recargar lista si cambia de pestaña
        this.cargarEncomiendas();
      },
      error: (err) => {
        this.cargando.set(false);
        const mensaje = err?.error?.mensaje || 'No se pudo registrar la encomienda.';
        this.sweetAlert.error('Error al registrar', mensaje);
      },
    });
  }

  private limpiarFormulario(): void {
    this.nuevoRegistro = {
      remitente: { nombre: '', cedula: '', telefono: '' },
      destinatario: { nombre: '', cedula: '', telefono: '' },
      origen: 'Machala',
      destino: 'Guayaquil',
      peso_kg: 2,
      dimensiones: { largo_cm: 20, ancho_cm: 15, alto_cm: 10 },
      descripcion_paquete: '',
    };
    this.cedulaRemitenteValida.set(false);
    this.cedulaRemitenteTocada.set(false);
    this.cedulaDestinatarioValida.set(false);
    this.cedulaDestinatarioTocada.set(false);
    this.recalcularTarifaEnVivo();
  }

  // ==========================================
  // BANDEJA Y GESTIÓN DE ESTADOS
  // ==========================================
  public cargarEncomiendas(): void {
    this.cargando.set(true);
    this.encomiendasService
      .listarEncomiendas({
        estado: this.filtroEstado(),
        busqueda: this.busquedaTexto(),
      })
      .subscribe({
        next: (res) => {
          this.cargando.set(false);
          this.encomiendas.set(res.encomiendas || []);
        },
        error: () => {
          this.cargando.set(false);
          this.sweetAlert.toast('error', 'Error al obtener encomiendas.');
        },
      });
  }

  public aplicarFiltros(): void {
    this.cargarEncomiendas();
  }

  public abrirModalMovimiento(item: EncomiendaItem): void {
    this.encomiendaSeleccionada.set(item);
    this.nuevoMovimiento = {
      estado: item.estado === 'recibida' ? 'en_transito' : item.estado === 'en_transito' ? 'en_destino' : 'entregada',
      ubicacion: `Terminal ${item.destino}`,
      observacion: '',
    };
    this.mostrarModalMovimiento.set(true);
  }

  public cerrarModalMovimiento(): void {
    this.mostrarModalMovimiento.set(false);
    this.encomiendaSeleccionada.set(null);
  }

  public guardarMovimiento(): void {
    const enc = this.encomiendaSeleccionada();
    if (!enc) return;

    if (!this.nuevoMovimiento.ubicacion.trim()) {
      this.sweetAlert.advertencia('Ubicación requerida', 'Ingrese la ubicación física donde se registra el cambio.');
      return;
    }

    this.cargando.set(true);
    this.encomiendasService
      .registrarMovimiento(enc._id, {
        estado: this.nuevoMovimiento.estado,
        ubicacion: this.nuevoMovimiento.ubicacion.trim(),
        observacion: this.nuevoMovimiento.observacion.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.cerrarModalMovimiento();
          this.sweetAlert.toast('success', `Movimiento registrado para ${enc.codigo_rastreo}.`);
          this.cargarEncomiendas();
        },
        error: (err) => {
          this.cargando.set(false);
          const msg = err?.error?.mensaje || 'Error al actualizar estado.';
          this.sweetAlert.error('Error', msg);
        },
      });
  }

  public verHistorial(item: EncomiendaItem): void {
    this.cargando.set(true);
    this.encomiendaSeleccionada.set(item);
    this.encomiendasService.obtenerEncomiendaPorId(item._id).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.historialModal.set(res.historial || []);
        this.mostrarModalHistorial.set(true);
      },
      error: () => {
        this.cargando.set(false);
        this.sweetAlert.error('Error', 'No se pudo cargar el historial.');
      },
    });
  }

  public cerrarModalHistorial(): void {
    this.mostrarModalHistorial.set(false);
    this.encomiendaSeleccionada.set(null);
  }

  public verGuia(item: EncomiendaItem): void {
    this.encomiendaEmitida.set(item);
    this.mostrarModalGuia.set(true);
  }

  public cerrarModalGuia(): void {
    this.mostrarModalGuia.set(false);
    this.encomiendaEmitida.set(null);
  }

  public imprimirGuia(): void {
    window.print();
  }

  public getBadgeClase(estado: string): string {
    switch (estado) {
      case 'recibida':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300';
      case 'en_transito':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300';
      case 'en_destino':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300';
      case 'entregada':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300';
      case 'devuelta':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    }
  }

  public getBadgeLabel(estado: string): string {
    switch (estado) {
      case 'recibida':
        return 'Recibida en Agencia';
      case 'en_transito':
        return 'En Tránsito';
      case 'en_destino':
        return 'En Agencia Destino';
      case 'entregada':
        return 'Entregada a Destinatario';
      case 'devuelta':
        return 'Devuelta';
      default:
        return estado;
    }
  }
}
