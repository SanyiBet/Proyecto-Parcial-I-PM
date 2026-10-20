import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

declare const google: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  private ngZone = inject(NgZone);

  /**
   * Inicializa el SDK de Google Identity Services y renderiza el botón oficial
   * @param contenedorId - ID del elemento HTML donde se renderizará el botón
   * @param onExito - Callback que recibe la credencial JWT de Google
   */
  public renderizarBotonGoogle(contenedorId: string, onExito: (credential: string) => void): void {
    if (typeof window === 'undefined') return;

    const intentarRenderizar = () => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (respuesta: { credential: string }) => {
            this.ngZone.run(() => {
              if (respuesta && respuesta.credential) {
                onExito(respuesta.credential);
              }
            });
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const elemento = document.getElementById(contenedorId);
        if (elemento) {
          elemento.innerHTML = '';
          google.accounts.id.renderButton(elemento, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 280,
          });
        }
      } else {
        setTimeout(intentarRenderizar, 200);
      }
    };

    intentarRenderizar();
  }
}
