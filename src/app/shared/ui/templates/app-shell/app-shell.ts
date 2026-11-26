import { Component, computed, inject, input } from '@angular/core';
import { NavLink } from '../../molecules/nav-item/nav-item';
import { BottomNav } from '../../organisms/bottom-nav/bottom-nav';
import { NavRail } from '../../organisms/nav-rail/nav-rail';
import { LayoutService } from '../../services/layout.service';

/**
 * Signed-in layout (spec §13.5): header (total, `[ccShellPeriod]` controls, `[ccShellActions]`),
 * content (default slot) and the main navigation: a bottom bar in the compact window class and a
 * side rail in the others.
 */
@Component({
  selector: 'cc-app-shell',
  imports: [BottomNav, NavRail],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '[class.with-rail]': '!layout.isCompact()',
    '[class.wide-content]': 'wideContent()',
  },
})
export class AppShell {
  protected readonly layout = inject(LayoutService);

  readonly navItems = input.required<readonly NavLink[]>();
  readonly navLabel = input.required<string>();
  readonly totalLabel = input.required<string>();
  /** Already formatted total of the accounts. */
  readonly total = input.required<string>();
  /** Accessible name of the period controls group. */
  readonly periodLabel = input.required<string>();
  /** A flow is open: in the compact window class it takes the whole screen. */
  readonly immersive = input(false);
  /** The page shows list and detail side by side and needs more width. */
  readonly wideContent = input(false);

  protected readonly hideChrome = computed(() => this.immersive() && this.layout.isCompact());
}
