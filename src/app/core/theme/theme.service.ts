import { computed, DOCUMENT, effect, inject, Injectable, Injector, signal } from '@angular/core';
import { ActionResult } from '../action-result';
import { THEME_STORAGE_KEY } from '../config/app.constants';
import { ThemePreference } from '../spaces/space.models';
import { UserSettingsService } from '../user-settings/user-settings.service';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** The scheme on screen once "Según el sistema" is resolved. */
export type ColorScheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Applies the user's light/dark preference (spec §13.2) through `html[data-theme]`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly userSettings = inject(UserSettingsService);
  private readonly current = signal<ThemePreference>('system');
  private readonly systemDark = signal(false);

  /** The preference applied: the user's, or the cached one while it loads. */
  readonly preference = this.current.asReadonly();
  /** The scheme on screen, also when it follows the system (spec §13.2, theme-color). */
  readonly scheme = computed<ColorScheme>(() => {
    const preference = this.current();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemDark() ? 'dark' : 'light';
  });

  /** Applies the cached preference right away, then follows the user's settings. */
  init(): void {
    const query = this.document.defaultView?.matchMedia?.(DARK_QUERY);
    this.systemDark.set(query?.matches ?? false);
    query?.addEventListener('change', (event) => this.systemDark.set(event.matches));

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

  /**
   * Changes the theme right away and saves it (spec §7, the menu). If saving fails, the theme goes
   * back to the saved one and the result says why.
   */
  async set(theme: ThemePreference): Promise<ActionResult> {
    const previous = this.current();
    this.apply(theme);
    this.cache(theme);
    const result = await this.userSettings.update({ theme });
    if (!result.ok) {
      this.apply(previous);
      this.cache(previous);
    }
    return result;
  }

  private apply(theme: ThemePreference): void {
    const root = this.document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    this.current.set(theme);
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
