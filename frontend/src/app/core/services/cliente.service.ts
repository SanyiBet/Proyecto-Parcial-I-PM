import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface ReservaCliente {
  _id: string;
  asiento_numero: string;
  precio_final: number;
  estado: 'reservada' | 'pendiente_verificacion' | 'confirmada' | 'cancelada' | 'expirada';
  creada_en: string;
  vence_en: string;
  viaje: {
    _id: string;
    salida: string;
    llegada_estimada: string;
    ruta?: { origen: string; destino: string };
    bus?: { placa: string; descripcion: string };
  } | null;
  pasajero?: { nombre: string; identificacion: string } | null;
  pago?: {
    _id: string;
    estado: string;
    referencia: string;
    importe: number;
    comprobante_url: string;
    motivo_rechazo?: string | null;
  } | null;
}

export interface PagoCliente {
  _id: string;
  reserva_id: string;
  reservas_asociadas?: string[];
  metodo: string;
  referencia: string;
  comprobante_url: string;
  importe: number;
  estado: 'en_revision' | 'aprobado' | 'rechazado';
  motivo_rechazo?: string | null;
  creado_en: string;
  verificado_en?: string | null;
}

export interface EncomiendaCliente {
  _id: string;
  codigo_rastreo: string;
  origen: string;
  destino: string;
  peso_kg: number;
  precio_final: number;
  estado: string;
  remitente: { nombre: string; cedula: string; telefono: string };
  destinatario: { nombre: string; cedula: string; telefono: string };
  creada_en: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  private obtenerHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token() || ''}`,
    });
  }

  public obtenerMisReservas(): Observable<{ reservas: ReservaCliente[] }> {
    return this.http.get<{ reservas: ReservaCliente[] }>(`${this.apiUrl}/reservas/mis-reservas`, {
      headers: this.obtenerHeaders(),
    });
  }

  public obtenerMisPagos(): Observable<{ pagos: PagoCliente[] }> {
    return this.http.get<{ pagos: PagoCliente[] }>(`${this.apiUrl}/pagos/mis-pagos`, {
      headers: this.obtenerHeaders(),
    });
  }

  public obtenerMisEncomiendas(): Observable<{ encomiendas: EncomiendaCliente[] }> {
    return this.http.get<{ encomiendas: EncomiendaCliente[] }>(`${this.apiUrl}/encomiendas/mis-encomiendas`, {
      headers: this.obtenerHeaders(),
    });
  }
}
