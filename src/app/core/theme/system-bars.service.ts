import {
  afterNextRender,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  blendColors,
  parseCssColor,
  resolveLightDark,
  RgbColor,
  stackedOpacity,
  toHexColor,
} from '../../domain/color/css-color';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ThemeService } from './theme.service';

const BAR_SURFACE_TOKEN = '--cc-bar-surface';
const SCRIM_TOKEN = '--mat-sys-scrim';
const SCRIM_OPACITY_TOKEN = '--cc-scrim-opacity';

/**
 * Paints the system's bars like the app (spec §13.2): `theme-color`, which Android uses for its
 * status and navigation bars, takes the surface of the app bars in the scheme on screen (the user's
 * choice, not only the system's). While overlays are open it takes that surface under their scrim,
 * as 1Money does. Each frame may set its own `--cc-bar-surface` (the wizard's top is the page's):
 * the color is read where the top of the screen is.
 */
@Injectable({ providedIn: 'root' })
export class SystemBarsService {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  private readonly overlay = inject(OverlayService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly navigated = signal(0);
  /** The element on top of the screen the last time no overlay covered it. */
  private frame: Element | null = null;

  init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.navigated.update((count) => count + 1));
    effect(
      () => {
        const dark = this.theme.scheme() === 'dark';
        const open = this.overlay.openOverlays();
        this.navigated();
        // Read once the new screen or scheme is on screen.
        afterNextRender({ read: () => this.paint(dark, open) }, { injector: this.injector });
      },
      { injector: this.injector },
    );
  }

  private paint(dark: boolean, open: number): void {
    const surface = this.barSurface(dark, open);
    if (!surface) {
      return;
    }
    const scrim = open > 0 ? this.scrim(dark) : null;
    const color = scrim
      ? blendColors(surface, scrim.color, stackedOpacity(scrim.opacity, open))
      : toHexColor(surface);
    // Both metas keep their media queries and take the same color: whichever applies, it is right.
    for (const meta of this.document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = color;
    }
  }

  private barSurface(dark: boolean, open: number): RgbColor | null {
    const view = this.document.defaultView;
    if (!view) {
      return null;
    }
    // With an overlay open the top of the screen is its backdrop: keep the frame under it.
    if (open === 0 || !this.frame?.isConnected) {
      this.frame =
        this.document.elementFromPoint(view.innerWidth / 2, 0) ?? this.document.documentElement;
    }
    const value = view.getComputedStyle(this.frame).getPropertyValue(BAR_SURFACE_TOKEN);
    return parseCssColor(resolveLightDark(value, dark));
  }

  private scrim(dark: boolean): { color: RgbColor; opacity: number } | null {
    const style = this.document.defaultView?.getComputedStyle(this.document.documentElement);
    const color = style
      ? parseCssColor(resolveLightDark(style.getPropertyValue(SCRIM_TOKEN), dark))
      : null;
    const opacity = Number.parseFloat(style?.getPropertyValue(SCRIM_OPACITY_TOKEN) ?? '');
    return color && Number.isFinite(opacity) ? { color, opacity } : null;
  }
}
