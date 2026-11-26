import { Component, input } from '@angular/core';
import { BottomNav, NavLink } from '../../organisms/bottom-nav/bottom-nav';

/**
 * Signed-in layout: header (total, `[ccShellPeriod]` controls, `[ccShellActions]`), content
 * (default slot) and the bottom navigation.
 */
@Component({
  selector: 'cc-app-shell',
  imports: [BottomNav],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly navItems = input.required<readonly NavLink[]>();
  readonly navLabel = input.required<string>();
  readonly totalLabel = input.required<string>();
  /** Already formatted total of the accounts. */
  readonly total = input.required<string>();
  /** Accessible name of the period controls group. */
  readonly periodLabel = input.required<string>();
}
