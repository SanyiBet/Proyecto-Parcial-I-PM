import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface MovimientoHito {
  estado: string;
  ubicacion: string;
  observacion: string;
  fecha: string;
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
   * Realiza la cotización instantánea de una encomienda por peso volumétrico y báscula
   */
  public cotizarEncomienda(datos: CotizacionPayload): Observable<CotizacionResponse> {
    return this.http.post<CotizacionResponse>(`${this.apiUrl}/cotizar`, datos);
  }

  /**
   * Consulta pública de seguimiento de encomienda en tiempo real
   */
  public rastrearEncomienda(codigo: string): Observable<RastreoResponse> {
    const cod = encodeURIComponent(String(codigo).trim().toUpperCase());
    return this.http.get<RastreoResponse>(`${this.apiUrl}/rastreo/${cod}`);
  }
}
