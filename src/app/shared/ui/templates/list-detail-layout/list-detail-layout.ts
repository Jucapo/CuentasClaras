import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  untracked,
} from '@angular/core';
import { LayoutService } from '../../services/layout.service';

/**
 * List and detail (spec §13.5): side by side in the expanded window class, with `[ccDetailEmpty]`
 * while nothing is open; one pane at a time otherwise. Both panes stay projected (hidden, not
 * removed), so a routed detail keeps working and the list keeps its state.
 */
@Component({
  selector: 'cc-list-detail-layout',
  templateUrl: './list-detail-layout.html',
  styleUrl: './list-detail-layout.scss',
  host: { '[class.side-by-side]': 'layout.isExpanded()' },
})
export class ListDetailLayout {
  protected readonly layout = inject(LayoutService);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly injector = inject(Injector);

  /** A detail is open, e.g. a child route is active. */
  readonly detailOpen = input(false);

  protected readonly showList = computed(() => this.layout.isExpanded() || !this.detailOpen());
  protected readonly showDetail = computed(() => this.layout.isExpanded() || this.detailOpen());

  constructor() {
    // With one pane, the document scrolls: the detail starts at the top and the list comes back
    // where it was.
    let wasOpen = false;
    let listScroll = 0;
    effect(() => {
      const open = this.detailOpen();
      const sideBySide = this.layout.isExpanded();
      untracked(() => {
        const window = this.window;
        if (!window || sideBySide || open === wasOpen) {
          wasOpen = open;
          return;
        }
        wasOpen = open;
        if (open) {
          listScroll = window.scrollY;
          window.scrollTo({ top: 0 });
        } else {
          afterNextRender(() => window.scrollTo({ top: listScroll }), { injector: this.injector });
        }
      });
    });
  }
}
