export type RolUsuario =
  | 'administrador'
  | 'agente_boleteria'
  | 'operador_encomiendas'
  | 'cliente'
  | 'auditor_tecnico';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  cedula: string | null;
  roles: RolUsuario[];
  metodo_auth: 'local' | 'google';
  estado: 'activo' | 'inactivo' | 'bloqueado';
  requiere_cedula?: boolean;
}

export interface AuthRespuesta {
  mensaje: string;
  token: string;
  usuario: Usuario;
  requiere_cedula?: boolean;
}
