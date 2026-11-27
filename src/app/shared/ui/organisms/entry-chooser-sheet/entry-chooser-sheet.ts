import { Component, inject } from '@angular/core';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { EntryChoice, EntryChooser, EntryChooserData } from '../entry-chooser/entry-chooser';

/**
 * `cc-entry-chooser` in an overlay: a sheet the height of its content in the compact window class
 * (spec §13.5), a dialog elsewhere. Resolves with the choice, or nothing when dismissed.
 */
@Component({
  selector: 'cc-entry-chooser-sheet',
  imports: [EntryChooser],
  templateUrl: './entry-chooser-sheet.html',
})
export class EntryChooserSheet {
  protected readonly data = inject<EntryChooserData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<EntryChoice>>(OverlayHandle);

  protected close(choice?: EntryChoice): void {
    this.handle.close(choice);
  }
}
