import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Params, RouterLink } from '@angular/router';
import { iconGlyph, IconName } from '../../icons/icon-glyphs';
import { BUTTON_SPINNER_DIAMETER } from '../../ui.constants';

/** Visual emphasis of a button, from highest to lowest. */
export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

/** Router link commands, as accepted by `routerLink`. */
export type LinkCommands = string | readonly unknown[];

/** Text button; renders a link when it gets `link`. Listen to (click) on the host. */
@Component({
  selector: 'cc-button',
  imports: [NgTemplateOutlet, RouterLink, MatButton, MatIcon, MatProgressSpinner],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: { '[class.full-width]': 'fullWidth()', '[class.danger]': 'danger()' },
})
export class Button {
  readonly variant = input<ButtonVariant>('filled');
  readonly type = input<'button' | 'submit'>('button');
  /** Navigates instead of acting: renders an anchor with `routerLink`. */
  readonly link = input<LinkCommands>();
  readonly queryParams = input<Params | null>(null);
  /** Leading icon. */
  readonly icon = input<IconName>();
  /** Shows a spinner and blocks clicks; `loadingLabel` names the busy state. */
  readonly loading = input(false);
  readonly loadingLabel = input<string>();
  readonly disabled = input(false);
  readonly fullWidth = input(false);
  /** Error colors, for destructive actions such as deleting. */
  readonly danger = input(false);

  protected readonly spinnerDiameter = BUTTON_SPINNER_DIAMETER;
  // A bare mat-icon (not cc-icon) keeps Material's spacing for icons inside buttons.
  protected readonly glyph = computed(() => {
    const name = this.icon();
    return name ? iconGlyph(name) : null;
  });
}
