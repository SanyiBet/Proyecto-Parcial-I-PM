export interface Ruta {
  _id: string;
  origen: string;
  destino: string;
  duracion_minutos: number;
}

export interface Bus {
  _id: string;
  placa: string;
  descripcion: string;
  capacidad: number;
}

export interface Viaje {
  _id: string;
  salida: string;
  llegada_estimada: string;
  precio: number;
  estado: string;
  ruta: Ruta;
  bus: Bus;
  asientos_disponibles: number;
}

export interface Asiento {
  numero: string;
  fila: number;
  columna: number;
  tipo: 'ventana' | 'pasillo';
  estado: 'disponible' | 'seleccionado' | 'bloqueado_temporal' | 'ocupado';
  vence_en?: string | null;
  precio: number;
}

export interface MapaAsientosRespuesta {
  viaje_id: string;
  precio_base: number;
  salida: string;
  llegada_estimada: string;
  ruta: Ruta;
  bus: Bus;
  asientos: Asiento[];
}

export interface ReservaTemporalRespuesta {
  mensaje: string;
  viaje_id: string;
  asientos: string[];
  total: number;
  tiempo_limite_segundos: number;
  vence_en: string;
  reservas_ids?: string[];
}
