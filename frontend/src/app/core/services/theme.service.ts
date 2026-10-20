import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'transorense_theme';

  // Signal reactivo para el estado del tema
  public isDarkMode = signal<boolean>(false);

  constructor() {
    this.inicializarTema();

    // Sincronizar cambios del signal con el DOM y localStorage
    effect(() => {
      const dark = this.isDarkMode();
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (dark) {
          root.classList.add('dark');
          root.classList.remove('light');
          localStorage.setItem(this.THEME_KEY, 'dark');
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
          localStorage.setItem(this.THEME_KEY, 'light');
        }
      }
    });
  }

  private inicializarTema(): void {
    if (typeof window === 'undefined') return;

    const temaGuardado = localStorage.getItem(this.THEME_KEY) as ThemeMode | null;

    if (temaGuardado) {
      this.isDarkMode.set(temaGuardado === 'dark');
    } else {
      // Detección automática de la preferencia del sistema operativo del usuario
      const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode.set(prefiereOscuro);
    }
  }

  public toggleTheme(): void {
    this.isDarkMode.update((actual) => !actual);
  }

  public setTema(modo: ThemeMode): void {
    this.isDarkMode.set(modo === 'dark');
  }
}
