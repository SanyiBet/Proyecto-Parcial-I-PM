/**
 * ticket.service.ts
 * Servicio centralizado de Emisión, Criptografía QR e Impresión de Boletos y Guías (CARD-37).
 */

import { Injectable, signal } from '@angular/core';
import * as QRCode from 'qrcode';

export interface BoletoDigitalData {
  tipo: 'pasaje';
  boleto_id: string;
  codigo_seguridad: string;
  origen: string;
  destino: string;
  fecha_salida: string | Date;
  hora_salida: string;
  asiento_numero: string | number;
  tipo_asiento?: string;
  bus_unidad?: string | number;
  pasajero_nombre: string;
  pasajero_cedula: string;
  importe: number;
  metodo_pago?: string;
  referencia_pago?: string;
  qr_data_url?: string;
}

export interface GuiaDigitalData {
  tipo: 'encomienda';
  guia_id: string;
  codigo_rastreo: string;
  origen: string;
  destino: string;
  fecha_emision: string | Date;
  remitente_nombre: string;
  remitente_cedula: string;
  destinatario_nombre: string;
  destinatario_cedula: string;
  descripcion_paquete: string;
  peso_kg: number;
  peso_volumetrico?: number;
  precio_final: number;
  qr_data_url?: string;
}

export type TicketData = BoletoDigitalData | GuiaDigitalData;

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  public ticketActivo = signal<TicketData | null>(null);

  /**
   * Genera el payload criptográfico y renderiza el código QR para boletos de transporte.
   */
  public async generarQRPasaje(datos: Omit<BoletoDigitalData, 'tipo' | 'qr_data_url'>): Promise<BoletoDigitalData> {
    const payloadCripto = JSON.stringify({
      emisor: 'TRANSORENSE_EP',
      tipo: 'PA',
      boleto: datos.boleto_id,
      ruta: `${datos.origen}-${datos.destino}`,
      asiento: datos.asiento_numero,
      ci: datos.pasajero_cedula,
      sec: datos.codigo_seguridad,
    });

    const qrDataUrl = await QRCode.toDataURL(payloadCripto, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    return {
      ...datos,
      tipo: 'pasaje',
      qr_data_url: qrDataUrl,
    };
  }

  /**
   * Genera el payload criptográfico y renderiza el código QR para guías de encomienda.
   */
  public async generarQRGuia(datos: Omit<GuiaDigitalData, 'tipo' | 'qr_data_url'>): Promise<GuiaDigitalData> {
    const payloadCripto = JSON.stringify({
      emisor: 'TRANSORENSE_CARGA',
      tipo: 'EN',
      guia: datos.codigo_rastreo,
      ruta: `${datos.origen}-${datos.destino}`,
      rem: datos.remitente_cedula,
      dest: datos.destinatario_cedula,
      precio: datos.precio_final,
    });

    const qrDataUrl = await QRCode.toDataURL(payloadCripto, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    return {
      ...datos,
      tipo: 'encomienda',
      qr_data_url: qrDataUrl,
    };
  }

  public abrirModal(ticket: TicketData): void {
    this.ticketActivo.set(ticket);
  }

  public cerrarModal(): void {
    this.ticketActivo.set(null);
  }

  public imprimir(): void {
    window.print();
  }
}
