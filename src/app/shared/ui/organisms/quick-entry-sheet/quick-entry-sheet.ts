import { Component, inject } from '@angular/core';
import { LayoutService } from '../../services/layout.service';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import {
  QuickEntry,
  QuickEntryData,
  QuickEntryLayout,
  QuickEntryResult,
} from '../quick-entry/quick-entry';

/** What the overlay returns; closing it without saving returns nothing. */
export type QuickEntrySheetResult = Exclude<QuickEntryResult, 'cancel'>;

/**
 * `cc-quick-entry` in an overlay (spec §7): a sheet in the compact window class and a two-column
 * dialog elsewhere. Opened with `OverlayService` and `QuickEntryData`. Its views (pickers, date,
 * questions) live inside it, and it asks before losing changes (spec §13.5).
 */
@Component({
  selector: 'cc-quick-entry-sheet',
  imports: [QuickEntry],
  templateUrl: './quick-entry-sheet.html',
})
export class QuickEntrySheet {
  protected readonly data = inject<QuickEntryData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<QuickEntrySheetResult>>(OverlayHandle);
  /** The overlay type does not change while it is open: sheet in compact, dialog elsewhere. */
  protected readonly layout: QuickEntryLayout = inject(LayoutService).isCompact()
    ? 'sheet'
    : 'dialog';

  protected close(result: QuickEntryResult): void {
    this.handle.close(result === 'cancel' ? undefined : result);
  }
}
