import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthRespuesta, Usuario } from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'transorense_token';
  private readonly USUARIO_KEY = 'transorense_usuario';

  // Signals reactivos para el estado de autenticación
  public usuarioActual = signal<Usuario | null>(null);
  public token = signal<string | null>(null);
  public estaAutenticado = computed(() => !!this.token() && !!this.usuarioActual());
  public esCliente = computed(() => this.usuarioActual()?.roles.includes('cliente') ?? false);
  public esAdmin = computed(() => this.usuarioActual()?.roles.includes('administrador') ?? false);

  constructor() {
    this.cargarSesionAlmacenada();
  }

  private cargarSesionAlmacenada(): void {
    if (typeof window === 'undefined') return;

    const tokenGuardado = localStorage.getItem(this.TOKEN_KEY);
    const usuarioGuardado = localStorage.getItem(this.USUARIO_KEY);

    if (tokenGuardado && usuarioGuardado) {
      try {
        this.token.set(tokenGuardado);
        this.usuarioActual.set(JSON.parse(usuarioGuardado));
      } catch (e) {
        this.cerrarSesion();
      }
    }
  }

  public login(correo: string, password: string): Observable<AuthRespuesta> {
    return this.http.post<AuthRespuesta>(`${this.apiUrl}/login`, { correo, password }).pipe(
      tap((res) => this.guardarSesion(res.token, res.usuario))
    );
  }

  public register(nombre: string, correo: string, cedula: string, password: string): Observable<AuthRespuesta> {
    return this.http.post<AuthRespuesta>(`${this.apiUrl}/register`, { nombre, correo, cedula, password }).pipe(
      tap((res) => this.guardarSesion(res.token, res.usuario))
    );
  }

  public loginGoogle(credential: string): Observable<AuthRespuesta> {
    return this.http.post<AuthRespuesta>(`${this.apiUrl}/google`, { credential }).pipe(
      tap((res) => this.guardarSesion(res.token, res.usuario))
    );
  }

  public completarCedula(cedula: string): Observable<{ mensaje: string; usuario: Usuario }> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.token()}`,
    });

    return this.http
      .post<{ mensaje: string; usuario: Usuario }>(`${this.apiUrl}/completar-cedula`, { cedula }, { headers })
      .pipe(
        tap((res) => {
          this.usuarioActual.set(res.usuario);
          localStorage.setItem(this.USUARIO_KEY, JSON.stringify(res.usuario));
        })
      );
  }

  private guardarSesion(token: string, usuario: Usuario): void {
    this.token.set(token);
    this.usuarioActual.set(usuario);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USUARIO_KEY, JSON.stringify(usuario));
    }
  }

  public cerrarSesion(): void {
    this.token.set(null);
    this.usuarioActual.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USUARIO_KEY);
    }
  }
}
