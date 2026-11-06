import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface LogAuditoria {
  _id: string;
  usuario_id: string;
  rol?: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  detalle?: any;
  ip_origen?: string;
  user_agent?: string;
  estado: 'registrado' | 'anomalia';
  fecha: string;
}

export interface Incidencia {
  _id: string;
  titulo: string;
  descripcion: string;
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  estado: 'abierta' | 'en_revision' | 'resuelta' | 'cerrada';
  reportado_por: string;
  responsable?: string | null;
  referencia_github?: string | null;
  creada_en: string;
}

export interface FiltrosAuditoria {
  entidad?: string;
  accion?: string;
  usuario_id?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limite?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuditoriaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  private obtenerHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token() || ''}`,
    });
  }

  public listarLogs(filtros: FiltrosAuditoria = {}): Observable<{ total: number; limite: number; auditorias: LogAuditoria[] }> {
    let params = new HttpParams();
    if (filtros.entidad) params = params.set('entidad', filtros.entidad);
    if (filtros.accion) params = params.set('accion', filtros.accion);
    if (filtros.usuario_id) params = params.set('usuario_id', filtros.usuario_id);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.fecha_desde) params = params.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) params = params.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.limite) params = params.set('limite', filtros.limite.toString());

    return this.http.get<{ total: number; limite: number; auditorias: LogAuditoria[] }>(`${this.apiUrl}/auditoria`, {
      headers: this.obtenerHeaders(),
      params,
    });
  }

  public listarIncidencias(filtros: { estado?: string; severidad?: string } = {}): Observable<{ total: number; incidencias: Incidencia[] }> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.severidad) params = params.set('severidad', filtros.severidad);

    return this.http.get<{ total: number; incidencias: Incidencia[] }>(`${this.apiUrl}/auditoria/incidencias`, {
      headers: this.obtenerHeaders(),
      params,
    });
  }

  public reportarIncidencia(datos: {
    titulo: string;
    descripcion: string;
    severidad: string;
    referencia_github?: string;
  }): Observable<{ mensaje: string; incidencia: Incidencia }> {
    return this.http.post<{ mensaje: string; incidencia: Incidencia }>(
      `${this.apiUrl}/auditoria/incidencias`,
      datos,
      { headers: this.obtenerHeaders() }
    );
  }

  public actualizarIncidencia(
    id: string,
    datos: { estado?: string; responsable?: string; referencia_github?: string }
  ): Observable<{ mensaje: string; incidencia: Incidencia }> {
    return this.http.patch<{ mensaje: string; incidencia: Incidencia }>(
      `${this.apiUrl}/auditoria/incidencias/${id}`,
      datos,
      { headers: this.obtenerHeaders() }
    );
  }
}
