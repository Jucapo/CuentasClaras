import { Component, computed, input, output } from '@angular/core';
import { Fab } from '../../atoms/fab/fab';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { matchesShortcut } from '../../services/keyboard-shortcuts';
import { UI_TEXT } from '../../ui.constants';

let nextPanelId = 0;

/** Shortcut that confirms an overlay, besides Enter (spec §13.5). */
const CONFIRM_SHORTCUT = 'Mod+s';

/** Controls where Enter keeps its own meaning instead of confirming the overlay. */
const OWN_ENTER_SELECTOR = [
  'button',
  'a[href]',
  'textarea',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="combobox"]',
].join(', ');

/**
 * Layout of a dialog or bottom sheet.
 *
 * With `confirmLabel` it is an overlay with a confirmation (spec §13.5): no visible bar, the
 * content up to the top edge, a floating ✕ in the top corner and a round ✓ in the bottom one that
 * emits `confirmed`, also on Enter and Ctrl/⌘+S. `confirming` shows its progress.
 *
 * Without it (one choice, confirmations, the period): a bar with the close button and the title.
 *
 * Both take an optional toolbar (`[ccOverlayToolbar]`), a scrolling body and optional actions at
 * the end (`[ccOverlayActions]`).
 */
@Component({
  selector: 'cc-overlay-panel',
  imports: [IconButton, Fab],
  templateUrl: './overlay-panel.html',
  styleUrl: './overlay-panel.scss',
  host: {
    '[class.floating]': 'floating()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class OverlayPanel {
  /** Visible in the bar; with `confirmLabel`, only for assistive technology. */
  readonly title = input.required<string>();
  /** Hides the close button, e.g. when the actions already offer a way out. */
  readonly hideClose = input(false);
  /** Accessible name and tooltip of the floating ✓, e.g. "Listo"; turns the confirmation layout on. */
  readonly confirmLabel = input<string | null>(null);
  /** While the confirmation saves: the ✓ shows its progress and stays disabled. */
  readonly confirming = input(false);
  /** Names the busy state of the ✓, e.g. "Guardando". */
  readonly confirmingLabel = input<string>();
  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected readonly titleId = `cc-overlay-title-${nextPanelId++}`;
  protected readonly closeLabel = UI_TEXT.close;
  protected readonly floating = computed(() => this.confirmLabel() !== null);

  protected confirm(): void {
    if (!this.confirming()) {
      this.confirmed.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.floating() || event.defaultPrevented) {
      return;
    }
    if (matchesShortcut(event, CONFIRM_SHORTCUT)) {
      // Ctrl/⌘+S would otherwise open the browser's "save page".
      event.preventDefault();
      this.confirm();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing &&
      !target?.closest(OWN_ENTER_SELECTOR)
    ) {
      // Also keeps a form inside from submitting a second time.
      event.preventDefault();
      this.confirm();
    }
  }
}
