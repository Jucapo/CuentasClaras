import { Component, computed, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { iconGlyph, IconName } from '../../icons/icon-glyphs';
import { ICON_FONT_CLASS } from '../../ui.constants';
import { LinkCommands } from '../button/button';

/** Icon-only button; `label` is its accessible name. Renders a link when it gets `link`. */
@Component({
  selector: 'cc-icon-button',
  imports: [RouterLink, RouterLinkActive, MatIconButton, MatIcon],
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.scss',
})
export class IconButton {
  /** Font of the self-hosted Material Symbols subset (src/styles/_fonts.scss). */
  protected readonly iconFont = ICON_FONT_CLASS;

  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly link = input<LinkCommands>();
  readonly disabled = input(false);
  /** Keyboard shortcut that triggers it, e.g. `N`; announced with aria-keyshortcuts and the title. */
  readonly shortcut = input<string>();

  protected readonly title = computed(() => {
    const shortcut = this.shortcut();
    return shortcut ? `${this.label()} (${shortcut})` : null;
  });

  protected readonly glyph = computed(() => iconGlyph(this.icon()));
}
