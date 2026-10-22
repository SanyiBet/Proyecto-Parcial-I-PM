import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface PasajeroData {
  reserva_id: string;
  nombre: string;
  identificacion: string;
}

export interface RegistroPagoData {
  reserva_id?: string;
  reservas_ids?: string[];
  metodo?: string;
  referencia: string;
  comprobante_base64?: string;
  comprobante_nombre?: string;
  importe?: number;
}

@Injectable({
  providedIn: 'root',
})
export class PagosService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiPasajeros = `${environment.apiUrl}/pasajeros`;
  private readonly apiPagos = `${environment.apiUrl}/pagos`;

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token() || ''}`,
    });
  }

  public registrarPasajeros(pasajeros: PasajeroData[]): Observable<{ mensaje: string; pasajeros: any[] }> {
    return this.http.post<{ mensaje: string; pasajeros: any[] }>(
      this.apiPasajeros,
      { pasajeros },
      { headers: this.getAuthHeaders() }
    );
  }

  public registrarPago(pago: RegistroPagoData): Observable<{
    mensaje: string;
    pago: any;
    estado_reserva: string;
  }> {
    return this.http.post<{
      mensaje: string;
      pago: any;
      estado_reserva: string;
    }>(this.apiPagos, pago, { headers: this.getAuthHeaders() });
  }

  public obtenerPagoPorReserva(reservaId: string): Observable<{ pago: any }> {
    return this.http.get<{ pago: any }>(`${this.apiPagos}/reserva/${reservaId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  public obtenerPagosPendientes(): Observable<{ pagos: any[] }> {
    return this.http.get<{ pagos: any[] }>(`${this.apiPagos}/pendientes`, {
      headers: this.getAuthHeaders(),
    });
  }

  public aprobarPago(pagoId: string): Observable<{ mensaje: string; pago_id: string; estado: string }> {
    return this.http.post<{ mensaje: string; pago_id: string; estado: string }>(
      `${this.apiPagos}/${pagoId}/aprobar`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  public rechazarPago(pagoId: string, motivo: string): Observable<{ mensaje: string; pago_id: string; estado: string }> {
    return this.http.post<{ mensaje: string; pago_id: string; estado: string }>(
      `${this.apiPagos}/${pagoId}/rechazar`,
      { motivo },
      { headers: this.getAuthHeaders() }
    );
  }
}
