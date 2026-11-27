import { Component, computed, inject, input, output } from '@angular/core';
import { LinkCommands } from '../../atoms/button/button';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { LayoutService } from '../../services/layout.service';

/**
 * Page title with an optional subtitle, a back arrow and a slot for actions. The arrow goes to
 * `backLink`, or emits `back` with `backAction` (e.g. to return wherever the screen was opened
 * from). With an arrow, in the compact window class it is the screen's bar (spec §13.5): fixed on
 * top, edge to edge, in place of the global header.
 */
@Component({
  selector: 'cc-page-header',
  imports: [IconButton],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  host: { '[class.bar]': 'bar()' },
})
export class PageHeader {
  private readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  /** Where the back arrow goes, for screens below a list. */
  readonly backLink = input<LinkCommands>();
  /** Shows the back arrow without a link: it emits `back`. */
  readonly backAction = input(false);
  readonly backLabel = input('Volver');
  readonly back = output<void>();

  protected readonly bar = computed(
    () => (this.backLink() !== undefined || this.backAction()) && this.layout.isCompact(),
  );
}
