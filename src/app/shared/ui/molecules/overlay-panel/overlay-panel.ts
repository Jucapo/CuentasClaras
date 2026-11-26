import { Component, input, output } from '@angular/core';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { UI_TEXT } from '../../ui.constants';

let nextPanelId = 0;

/**
 * Layout of a dialog or bottom sheet: title with a close button, an optional toolbar
 * (`[ccOverlayToolbar]`), a scrolling body and optional actions (`[ccOverlayActions]`).
 */
@Component({
  selector: 'cc-overlay-panel',
  imports: [IconButton],
  templateUrl: './overlay-panel.html',
  styleUrl: './overlay-panel.scss',
})
export class OverlayPanel {
  readonly title = input.required<string>();
  /** Hides the close button, e.g. when the actions already offer a way out. */
  readonly hideClose = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `cc-overlay-title-${nextPanelId++}`;
  protected readonly closeLabel = UI_TEXT.close;
}
