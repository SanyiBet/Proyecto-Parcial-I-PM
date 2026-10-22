import { Component, Input, OnInit, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Viaje } from '../../../core/models/viajes.models';
import { AuthService } from '../../../core/services/auth.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { PagosService, PasajeroData } from '../../../core/services/pagos.service';
import { validarCedulaEcuatorianaMatematica } from '../../../shared/validators/cedula.validator';

export interface FormPasajeroItem {
  asiento: string;
  reserva_id: string;
  nombre: string;
  identificacion: string;
  errorCedula?: string;
}

@Component({
  selector: 'app-formulario-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-pago.component.html',
})
export class FormularioPagoComponent implements OnInit {
  @Input({ required: true }) viaje!: Viaje;
  @Input({ required: true }) asientos: string[] = [];
  @Input({ required: true }) total: number = 0;
  @Input() reservasIds: string[] = [];

  public volverAlMapa = output<void>();
  public pagoExitoso = output<{ referencia: string; codigoPago: string }>();

  public authService = inject(AuthService);
  private sweetAlert = inject(SweetAlertService);
  private pagosService = inject(PagosService);

  // Lista de pasajeros por asiento
  public pasajeros = signal<FormPasajeroItem[]>([]);
  public primerPasajeroEsTitular = signal<boolean>(true);

  // Datos de pago bancario
  public metodoPago = signal<string>('transferencia');
  public referencia = signal<string>('');
  public archivoComprobante = signal<File | null>(null);
  public comprobanteBase64 = signal<string | null>(null);
  public comprobanteNombre = signal<string>('');
  public vistaPreviaUrl = signal<string | null>(null);

  // Estados de carga
  public procesando = signal<boolean>(false);

  ngOnInit(): void {
    const usuarioActual = this.authService.usuarioActual();
    const items: FormPasajeroItem[] = this.asientos.map((asiento, idx) => {
      const resId = this.reservasIds[idx] || '';
      const esPrimero = idx === 0;

      return {
        asiento,
        reserva_id: resId,
        nombre: esPrimero && usuarioActual ? usuarioActual.nombre : '',
        identificacion: esPrimero && usuarioActual?.cedula ? usuarioActual.cedula : '',
        errorCedula: '',
      };
    });

    this.pasajeros.set(items);
  }

  public toggleTitular(): void {
    const actual = !this.primerPasajeroEsTitular();
    this.primerPasajeroEsTitular.set(actual);

    const lista = [...this.pasajeros()];
    if (lista.length > 0) {
      const usuario = this.authService.usuarioActual();
      if (actual && usuario) {
        lista[0].nombre = usuario.nombre;
        lista[0].identificacion = usuario.cedula || '';
        lista[0].errorCedula = '';
      } else if (!actual) {
        lista[0].nombre = '';
        lista[0].identificacion = '';
        lista[0].errorCedula = '';
      }
      this.pasajeros.set(lista);
    }
  }

  public validarCedulaPasajero(index: number): void {
    const lista = [...this.pasajeros()];
    const item = lista[index];
    if (!item.identificacion) {
      item.errorCedula = 'La cédula es requerida';
      this.pasajeros.set(lista);
      return;
    }

    const resultado = validarCedulaEcuatorianaMatematica(item.identificacion);
    item.errorCedula = resultado.esValida ? '' : resultado.mensaje;
    this.pasajeros.set(lista);
  }

  public onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.cargarArchivo(file);
  }

  public onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.cargarArchivo(file);
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private cargarArchivo(file: File): void {
    // Validar tipo (imágenes o PDF)
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      this.sweetAlert.advertencia(
        'Formato no permitido',
        'Solo se permiten imágenes JPG, PNG, WEBP o documentos PDF.'
      );
      return;
    }

    // Validar tamaño máximo: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      this.sweetAlert.advertencia('Archivo muy pesado', 'El comprobante no debe superar los 5 MB.');
      return;
    }

    this.archivoComprobante.set(file);
    this.comprobanteNombre.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.comprobanteBase64.set(base64);

      if (file.type.startsWith('image/')) {
        this.vistaPreviaUrl.set(base64);
      } else {
        this.vistaPreviaUrl.set(null); // Icono PDF
      }
    };
    reader.readAsDataURL(file);
  }

  public quitarArchivo(): void {
    this.archivoComprobante.set(null);
    this.comprobanteBase64.set(null);
    this.comprobanteNombre.set('');
    this.vistaPreviaUrl.set(null);
  }

  public async enviarFormulario(): Promise<void> {
    const lista = this.pasajeros();

    // 1. Validar todos los pasajeros
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (!p.nombre || p.nombre.trim().length < 3) {
        this.sweetAlert.advertencia(
          'Nombre requerido',
          `Por favor ingresa el nombre completo del pasajero del Asiento #${p.asiento}.`
        );
        return;
      }

      const val = validarCedulaEcuatorianaMatematica(p.identificacion);
      if (!val.esValida) {
        this.sweetAlert.advertencia(
          'Cédula inválida',
          `Asiento #${p.asiento}: ${val.mensaje}`
        );
        return;
      }
    }

    // 2. Validar referencia bancaria
    if (!this.referencia() || this.referencia().trim().length < 3) {
      this.sweetAlert.advertencia(
        'Referencia requerida',
        'Ingresa el número de comprobante o referencia de tu transferencia bancaria.'
      );
      return;
    }

    // 3. Validar archivo de comprobante
    if (!this.comprobanteBase64()) {
      this.sweetAlert.advertencia(
        'Comprobante requerido',
        'Debes adjuntar la foto o captura del comprobante bancario para validar tu reserva.'
      );
      return;
    }

    const confirmar = await this.sweetAlert.confirmar(
      '¿Enviar Comprobante de Pago?',
      `Se registrarán ${lista.length} pasajero(s) por un total de $${this.total.toFixed(2)}. Tu reserva quedará en revisión por boletería.`,
      'Sí, Enviar Pago',
      'Revisar Datos'
    );

    if (!confirmar) return;

    this.procesando.set(true);

    // Paso A: Registrar Pasajeros
    const payloadPasajeros: PasajeroData[] = lista.map((p) => ({
      reserva_id: p.reserva_id,
      nombre: p.nombre.trim(),
      identificacion: p.identificacion.trim(),
    }));

    this.pagosService.registrarPasajeros(payloadPasajeros).subscribe({
      next: () => {
        // Paso B: Registrar Pago con Comprobante
        this.pagosService.registrarPago({
          reservas_ids: this.reservasIds,
          reserva_id: this.reservasIds[0],
          metodo: this.metodoPago(),
          referencia: this.referencia().trim(),
          comprobante_base64: this.comprobanteBase64()!,
          comprobante_nombre: this.comprobanteNombre(),
          importe: this.total,
        }).subscribe({
          next: (resPago) => {
            this.procesando.set(false);
            this.sweetAlert.exito(
              '¡Pago Registrado con Éxito!',
              `Referencia #${this.referencia()}. El agente de boletería verificará tu comprobante y confirmará tus pasajes en breve.`
            );
            this.pagoExitoso.emit({
              referencia: this.referencia(),
              codigoPago: resPago.pago?.id || '',
            });
          },
          error: (errPago: any) => {
            this.procesando.set(false);
            this.sweetAlert.error(
              'Error al registrar el pago',
              errPago.error?.mensaje || 'No se pudo registrar el comprobante. Por favor intenta nuevamente.'
            );
          },
        });
      },
      error: (errPas: any) => {
        this.procesando.set(false);
        this.sweetAlert.error(
          'Error al guardar pasajeros',
          errPas.error?.mensaje || 'No se pudieron registrar los datos de los pasajeros.'
        );
      },
    });
  }
}
