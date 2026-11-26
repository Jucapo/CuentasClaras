import { DOCUMENT, effect, inject, Injectable, Injector } from '@angular/core';
import { THEME_STORAGE_KEY } from '../config/app.constants';
import { ThemePreference } from '../spaces/space.models';
import { UserSettingsService } from '../user-settings/user-settings.service';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Applies the user's light/dark preference (spec §13.2) through `html[data-theme]`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly userSettings = inject(UserSettingsService);

  /** Applies the cached preference right away, then follows the user's settings. */
  init(): void {
    this.apply(this.cached() ?? 'system');
    effect(
      () => {
        const theme = this.userSettings.settings()?.theme;
        if (theme) {
          this.apply(theme);
          this.cache(theme);
        }
      },
      { injector: this.injector },
    );
  }

  private apply(theme: ThemePreference): void {
    const root = this.document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  // Storage can be unavailable (private mode, blocked site data): the theme then follows the system.
  private cached(): ThemePreference | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return THEMES.find((theme) => theme === value) ?? null;
    } catch {
      return null;
    }
  }

  private cache(theme: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Nothing to do: the preference still applies for this visit.
    }
  }
}
