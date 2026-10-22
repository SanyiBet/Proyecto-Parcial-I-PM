import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CotizacionPayload {
  origen: string;
  destino: string;
  peso_kg: number;
  largo_cm: number;
  ancho_cm: number;
  alto_cm: number;
}

export interface CotizacionResponse {
  mensaje: string;
  cotizacion_id: string;
  origen: string;
  destino: string;
  desglose: {
    peso_real_kg: number;
    dimensiones: {
      largo_cm: number;
      ancho_cm: number;
      alto_cm: number;
      volumen_cm3: number;
    };
    factor_volumetrico: number;
    peso_volumetrico_kg: number;
    peso_facturable_kg: number;
    tarifa_base: number;
    kg_base_incluidos: number;
    peso_adicional_kg: number;
    costo_kg_adicional: number;
    precio_estimado: number;
  };
  precio_estimado: number;
  vence_en: string;
}

export interface PersonaContacto {
  nombre: string;
  cedula: string;
  telefono: string;
}

export interface RegistroEncomiendaPayload {
  cotizacion_id?: string;
  remitente: PersonaContacto;
  destinatario: PersonaContacto;
  origen: string;
  destino: string;
  peso_kg: number;
  dimensiones: {
    largo_cm: number;
    ancho_cm: number;
    alto_cm: number;
  };
  descripcion_paquete?: string;
  precio_final?: number;
}

export interface EncomiendaRegistroResponse {
  mensaje: string;
  encomienda: {
    id: string;
    codigo_rastreo: string;
    remitente: PersonaContacto;
    destinatario: PersonaContacto;
    origen: string;
    destino: string;
    peso_kg: number;
    precio_final: number;
    estado: string;
    creada_en: string;
  };
  primer_hito: any;
}

export interface EncomiendaItem {
  _id: string;
  codigo_rastreo: string;
  remitente: PersonaContacto;
  destinatario: PersonaContacto;
  origen: string;
  destino: string;
  peso_kg: number;
  precio_final: number;
  estado: string;
  registrada_por?: string;
  creada_en: string;
}

export interface MovimientoHito {
  _id?: string;
  encomienda_id?: string;
  estado: string;
  ubicacion: string;
  observacion: string;
  usuario_id?: string;
  fecha: string;
}

export interface DetalleEncomiendaResponse {
  encomienda: EncomiendaItem;
  historial: MovimientoHito[];
}

export interface RastreoResponse {
  rastreo: {
    codigo_rastreo: string;
    estado_actual: string;
    origen: string;
    destino: string;
    creada_en: string;
    peso_kg: number;
    remitente: string;
    destinatario: string;
    linea_de_tiempo: MovimientoHito[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class EncomiendasService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/encomiendas`;

  /**
   * Realiza la cotización instantánea de una encomienda por peso volumétrico y báscula (Público)
   */
  public cotizarEncomienda(datos: CotizacionPayload): Observable<CotizacionResponse> {
    return this.http.post<CotizacionResponse>(`${this.apiUrl}/cotizar`, datos);
  }

  /**
   * Consulta pública de seguimiento de encomienda en tiempo real (Público - LOPDP)
   */
  public rastrearEncomienda(codigo: string): Observable<RastreoResponse> {
    const cod = encodeURIComponent(String(codigo).trim().toUpperCase());
    return this.http.get<RastreoResponse>(`${this.apiUrl}/rastreo/${cod}`);
  }

  /**
   * Registro de nueva encomienda en ventanilla y emisión de guía (Operador/Admin)
   */
  public registrarEncomienda(datos: RegistroEncomiendaPayload): Observable<EncomiendaRegistroResponse> {
    return this.http.post<EncomiendaRegistroResponse>(this.apiUrl, datos);
  }

  /**
   * Obtiene la lista de encomiendas con filtros opcionales de estado y búsqueda (Operador/Admin)
   */
  public listarEncomiendas(filtros?: { estado?: string; busqueda?: string }): Observable<{ encomiendas: EncomiendaItem[] }> {
    let params = new HttpParams();
    if (filtros?.estado && filtros.estado !== 'todos') {
      params = params.set('estado', filtros.estado);
    }
    if (filtros?.busqueda && filtros.busqueda.trim()) {
      params = params.set('busqueda', filtros.busqueda.trim());
    }
    return this.http.get<{ encomiendas: EncomiendaItem[] }>(this.apiUrl, { params });
  }

  /**
   * Detalle completo de una encomienda con su historial cronológico
   */
  public obtenerEncomiendaPorId(id: string): Observable<DetalleEncomiendaResponse> {
    return this.http.get<DetalleEncomiendaResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Registra un nuevo movimiento físico de la encomienda (cambio de estado y ubicación)
   */
  public registrarMovimiento(
    id: string,
    movimiento: { estado: string; ubicacion: string; observacion?: string }
  ): Observable<{ mensaje: string; nuevo_hito: MovimientoHito; encomienda: any }> {
    return this.http.post<{ mensaje: string; nuevo_hito: MovimientoHito; encomienda: any }>(
      `${this.apiUrl}/${id}/movimientos`,
      movimiento
    );
  }
}
