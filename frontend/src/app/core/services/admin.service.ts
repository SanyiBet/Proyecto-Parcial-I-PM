import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AdminKPIs {
  recaudacion_total: number;
  recaudacion_pasajes: number;
  recaudacion_encomiendas: number;
  boletos_confirmados: number;
  reservas_pendientes: number;
  viajes_activos: number;
  usuarios_registrados: number;
  buses_activos: number;
  rutas_activas: number;
  encomiendas_totales: number;
}

export interface UsuarioAdmin {
  _id: string;
  nombre: string;
  correo: string;
  cedula?: string | null;
  roles: string[];
  metodo_auth: string;
  estado: string;
  creado_en: string;
}

export interface RutaAdmin {
  _id: string;
  origen: string;
  destino: string;
  duracion_minutos: number;
  estado: 'activo' | 'inactivo';
}

export interface BusAdmin {
  _id: string;
  placa: string;
  descripcion: string;
  capacidad: number;
  estado: 'activo' | 'inactivo' | 'mantenimiento';
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  private obtenerHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token() || ''}`,
    });
  }

  public obtenerMetricas(): Observable<{ kpis: AdminKPIs; ultimos_pagos: any[] }> {
    return this.http.get<{ kpis: AdminKPIs; ultimos_pagos: any[] }>(`${this.apiUrl}/admin/metricas`, {
      headers: this.obtenerHeaders(),
    });
  }

  public listarUsuarios(busqueda: string = ''): Observable<{ usuarios: UsuarioAdmin[] }> {
    const url = busqueda
      ? `${this.apiUrl}/admin/usuarios?busqueda=${encodeURIComponent(busqueda)}`
      : `${this.apiUrl}/admin/usuarios`;
    return this.http.get<{ usuarios: UsuarioAdmin[] }>(url, {
      headers: this.obtenerHeaders(),
    });
  }

  public actualizarRol(usuarioId: string, roles: string[]): Observable<{ mensaje: string }> {
    return this.http.patch<{ mensaje: string }>(
      `${this.apiUrl}/admin/usuarios/${usuarioId}/rol`,
      { roles },
      { headers: this.obtenerHeaders() }
    );
  }

  public obtenerRutas(): Observable<{ rutas: RutaAdmin[] }> {
    return this.http.get<{ rutas: RutaAdmin[] }>(`${this.apiUrl}/viajes/rutas`);
  }

  public crearRuta(ruta: { origen: string; destino: string; duracion_minutos: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/rutas`, ruta, {
      headers: this.obtenerHeaders(),
    });
  }

  public alternarEstadoRuta(rutaId: string, estado: 'activo' | 'inactivo'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admin/rutas/${rutaId}/estado`, { estado }, {
      headers: this.obtenerHeaders(),
    });
  }

  public obtenerBuses(): Observable<{ buses: BusAdmin[] }> {
    return this.http.get<{ buses: BusAdmin[] }>(`${this.apiUrl}/viajes/buses`);
  }

  public crearBus(bus: { placa: string; descripcion: string; capacidad: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/buses`, bus, {
      headers: this.obtenerHeaders(),
    });
  }
}
