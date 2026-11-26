import { Component, computed, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { iconGlyph, IconName } from '../../icons/icon-glyphs';
import { LinkCommands } from '../button/button';

/** Icon-only button; `label` is its accessible name. Renders a link when it gets `link`. */
@Component({
  selector: 'cc-icon-button',
  imports: [RouterLink, RouterLinkActive, MatIconButton, MatIcon],
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.scss',
})
export class IconButton {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly link = input<LinkCommands>();
  readonly disabled = input(false);

  protected readonly glyph = computed(() => iconGlyph(this.icon()));
}
