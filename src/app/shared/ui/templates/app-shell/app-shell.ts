import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Avatar } from '../../atoms/avatar/avatar';
import { Skeleton } from '../../atoms/skeleton/skeleton';
import { NavLink } from '../../molecules/nav-item/nav-item';
import { BottomNav } from '../../organisms/bottom-nav/bottom-nav';
import { NavRail } from '../../organisms/nav-rail/nav-rail';
import { LayoutService } from '../../services/layout.service';
import { ScreenChrome } from '../../services/screen-chrome';
import { ScrollContainer } from '../../services/scroll-container';

/**
 * Signed-in layout (spec §7, §13.5), fixed like an app: the header, the content (default slot),
 * which is the only part that scrolls, and the main navigation, a bottom bar in the compact window
 * class and a side rail in the others.
 *
 * In the compact class the header has two rows: the avatar (opens the menu), the total and the
 * screen's action; then the period (`[ccShellPeriod]`), or the screen's own row. Elsewhere it is one
 * row and the avatar sits on top of the rail. Screens put their action, row and floating button
 * through `ScreenChrome`. Flows and subscreens take the whole screen in the compact class.
 */
@Component({
  selector: 'cc-app-shell',
  imports: [NgTemplateOutlet, CdkScrollable, BottomNav, NavRail, Avatar, Skeleton],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '[class.with-rail]': '!layout.isCompact()',
    '[class.compact]': 'layout.isCompact()',
    '[class.wide-content]': 'wideContent()',
    '[class.primary]': 'primary()',
  },
})
export class AppShell {
  protected readonly layout = inject(LayoutService);
  protected readonly chrome = inject(ScreenChrome);
  private readonly scrollContainer = inject(ScrollContainer);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  readonly navItems = input.required<readonly NavLink[]>();
  readonly navLabel = input.required<string>();
  readonly totalLabel = input.required<string>();
  /** Already formatted total of the accounts; null while it loads. */
  readonly total = input.required<string | null>();
  /** Announced while the total loads. */
  readonly loadingLabel = input('Cargando');
  /** Accessible name of the period controls group. */
  readonly periodLabel = input.required<string>();
  /** Accessible name of the avatar button, e.g. "Abrir el menú". */
  readonly menuLabel = input.required<string>();
  /** The user's display name, for the avatar. */
  readonly userName = input('');
  /** A flow is open: in the compact window class it takes the whole screen. */
  readonly immersive = input(false);
  /** A screen below a destination (an account, Configuración): in compact, only its own bar. */
  readonly subscreen = input(false);
  /** The page shows list and detail side by side and needs more width. */
  readonly wideContent = input(false);
  /** The app's own shell, not a copy in the catalog: its scroller is the app's (spec §13.5). */
  readonly primary = input(false);
  readonly menuOpened = output<void>();

  protected readonly hideChrome = computed(
    () => (this.immersive() || this.subscreen()) && this.layout.isCompact(),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (this.primary()) {
        destroyRef.onDestroy(this.scrollContainer.register(this.scroller().nativeElement));
      }
    });
  }
}
