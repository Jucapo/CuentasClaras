import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, computed, inject, input } from '@angular/core';
import { LayoutService } from '../../services/layout.service';

/**
 * List and detail (spec §13.5): side by side in the expanded window class, with `[ccDetailEmpty]`
 * while nothing is open; one pane at a time otherwise. Both panes stay projected (hidden, not
 * removed), so a routed detail keeps working and the list keeps its state. With one pane the app's
 * scroller keeps each screen's scroll (ScrollMemory); side by side each pane scrolls on its own.
 */
@Component({
  selector: 'cc-list-detail-layout',
  imports: [CdkScrollable],
  templateUrl: './list-detail-layout.html',
  styleUrl: './list-detail-layout.scss',
  host: { '[class.side-by-side]': 'layout.isExpanded()' },
})
export class ListDetailLayout {
  protected readonly layout = inject(LayoutService);

  /** A detail is open, e.g. a child route is active. */
  readonly detailOpen = input(false);

  protected readonly showList = computed(() => this.layout.isExpanded() || !this.detailOpen());
  protected readonly showDetail = computed(() => this.layout.isExpanded() || this.detailOpen());
}
