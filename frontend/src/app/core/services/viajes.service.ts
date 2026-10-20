import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Ruta,
  Viaje,
  MapaAsientosRespuesta,
  ReservaTemporalRespuesta,
} from '../models/viajes.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ViajesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiViajes = `${environment.apiUrl}/viajes`;
  private readonly apiReservas = `${environment.apiUrl}/reservas`;

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token() || ''}`,
    });
  }

  public obtenerRutas(): Observable<{ rutas: Ruta[] }> {
    return this.http.get<{ rutas: Ruta[] }>(`${this.apiViajes}/rutas`);
  }

  public buscarViajes(origen: string, destino: string, fecha?: string): Observable<{ viajes: Viaje[] }> {
    let url = `${this.apiViajes}/buscar?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`;
    if (fecha) {
      url += `&fecha=${fecha}`;
    }
    return this.http.get<{ viajes: Viaje[] }>(url);
  }

  public obtenerMapaAsientos(viajeId: string): Observable<MapaAsientosRespuesta> {
    return this.http.get<MapaAsientosRespuesta>(`${this.apiViajes}/${viajeId}/asientos`);
  }

  public crearReservaTemporal(viajeId: string, asientos: string[]): Observable<ReservaTemporalRespuesta> {
    return this.http.post<ReservaTemporalRespuesta>(
      this.apiReservas,
      { viaje_id: viajeId, asientos },
      { headers: this.getAuthHeaders() }
    );
  }

  public obtenerReservaActiva(): Observable<{
    reserva: { viaje_id: string; asientos: string[]; total: number; vence_en: string } | null;
    segundos_restantes?: number;
  }> {
    return this.http.get<any>(`${this.apiReservas}/activa`, {
      headers: this.getAuthHeaders(),
    });
  }

  public cancelarReserva(viajeId: string, asientos: string[]): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.apiReservas}/cancelar`,
      { viaje_id: viajeId, asientos },
      { headers: this.getAuthHeaders() }
    );
  }
}
