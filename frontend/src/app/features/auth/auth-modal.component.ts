import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAuthService } from '../../core/services/google-auth.service';
import { SweetAlertService } from '../../core/services/sweet-alert.service';
import { cedulaEcuatorianaValidator } from '../../shared/validators/cedula.validator';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-modal.component.html',
})
export class AuthModalComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  public authService = inject(AuthService);
  private googleAuthService = inject(GoogleAuthService);
  private sweetAlert = inject(SweetAlertService);

  // Evento emitido al completar autenticación exitosamente
  public loginExitoso = output<void>();
  public cerrar = output<void>();

  // Modo: 'login' | 'register'
  public modo = signal<'login' | 'register'>('login');
  public cargando = signal<boolean>(false);
  public modalCedulaPendiente = signal<boolean>(false);

  // Formularios reactivos
  public formLogin!: FormGroup;
  public formRegister!: FormGroup;
  public formCompletarCedula!: FormGroup;

  ngOnInit(): void {
    this.iniciarFormularios();
  }

  ngAfterViewInit(): void {
    this.iniciarBotonGoogle();
  }

  private iniciarFormularios(): void {
    this.formLogin = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.formRegister = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      correo: ['', [Validators.required, Validators.email]],
      cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.formCompletarCedula = this.fb.group({
      cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
    });
  }

  public iniciarBotonGoogle(): void {
    this.googleAuthService.renderizarBotonGoogle('btn-google-container', (credential) => {
      this.procesarGoogleAuth(credential);
    });
  }

  public cambiarModo(nuevoModo: 'login' | 'register'): void {
    this.modo.set(nuevoModo);
    setTimeout(() => this.iniciarBotonGoogle(), 100);
  }

  public onSubmitLogin(): void {
    if (this.formLogin.invalid) {
      this.formLogin.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    const { correo, password } = this.formLogin.value;

    this.authService.login(correo, password).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.sweetAlert.toast('success', `¡Bienvenido, ${res.usuario.nombre}!`);
        this.loginExitoso.emit();
      },
      error: (err: any) => {
        this.cargando.set(false);
        const mensaje = err.error?.mensaje || 'Error al iniciar sesión';
        this.sweetAlert.error('Acceso denegado', mensaje);
      },
    });
  }

  public onSubmitRegister(): void {
    if (this.formRegister.invalid) {
      this.formRegister.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    const { nombre, correo, cedula, password } = this.formRegister.value;

    this.authService.register(nombre, correo, cedula, password).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.sweetAlert.exito(
          '¡Cuenta creada con éxito!',
          `Bienvenido a TransOrense, ${res.usuario.nombre}. Tu cuenta está lista para reservar pasajes.`
        );
        this.loginExitoso.emit();
      },
      error: (err: any) => {
        this.cargando.set(false);
        const mensaje = err.error?.mensaje || 'Error al registrar usuario';
        this.sweetAlert.error('No se pudo registrar', mensaje);
      },
    });
  }

  private procesarGoogleAuth(credential: string): void {
    this.cargando.set(true);
    this.authService.loginGoogle(credential).subscribe({
      next: (res) => {
        this.cargando.set(false);
        if (res.requiere_cedula) {
          // El usuario ingresó por Google pero no tiene cédula ecuatoriana vinculada
          this.modalCedulaPendiente.set(true);
        } else {
          this.sweetAlert.toast('success', `Sesión iniciada con Google: ${res.usuario.nombre}`);
          this.loginExitoso.emit();
        }
      },
      error: (err: any) => {
        this.cargando.set(false);
        const mensaje = err.error?.mensaje || 'Error al autenticar con Google';
        this.sweetAlert.error('Error Google OAuth', mensaje);
      },
    });
  }

  public onSubmitCompletarCedula(): void {
    if (this.formCompletarCedula.invalid) {
      this.formCompletarCedula.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    const { cedula } = this.formCompletarCedula.value;

    this.authService.completarCedula(cedula).subscribe({
      next: () => {
        this.cargando.set(false);
        this.modalCedulaPendiente.set(false);
        this.sweetAlert.exito(
          'Cédula Vinculada',
          'Tu número de cédula ha sido verificado con éxito en el sistema.'
        );
        this.loginExitoso.emit();
      },
      error: (err: any) => {
        this.cargando.set(false);
        const mensaje = err.error?.mensaje || 'Error al vincular cédula';
        this.sweetAlert.error('Cédula no válida', mensaje);
      },
    });
  }
}
