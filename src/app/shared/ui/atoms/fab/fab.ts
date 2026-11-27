import { Component, computed, input } from '@angular/core';
import { MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { iconGlyph, IconName } from '../../icons/icon-glyphs';
import { BUTTON_SPINNER_DIAMETER, ICON_FONT_CLASS } from '../../ui.constants';

/**
 * Round floating button for the main action of a screen or overlay, e.g. the ✓ that confirms a
 * sheet (spec §13.5). `label` is its accessible name and tooltip. Listen to (click) on the host.
 */
@Component({
  selector: 'cc-fab',
  imports: [MatFabButton, MatIcon, MatProgressSpinner, MatTooltip],
  templateUrl: './fab.html',
  styleUrl: './fab.scss',
})
export class Fab {
  /** Font of the self-hosted Material Symbols subset (src/styles/_fonts.scss). */
  protected readonly iconFont = ICON_FONT_CLASS;
  protected readonly spinnerDiameter = BUTTON_SPINNER_DIAMETER;

  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  /** Shows a spinner instead of the icon and blocks clicks; `loadingLabel` names the busy state. */
  readonly loading = input(false);
  readonly loadingLabel = input<string>();
  readonly disabled = input(false);
  /** Keyboard shortcut that triggers it, e.g. `Control+S`; announced with aria-keyshortcuts. */
  readonly shortcut = input<string>();

  protected readonly glyph = computed(() => iconGlyph(this.icon()));
}
