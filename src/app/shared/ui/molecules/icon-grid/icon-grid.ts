import { Component, computed, ElementRef, input, model, signal, viewChildren } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { TextField } from '../../atoms/text-field/text-field';
import { searchIcons } from '../../icons/icon-search';
import { UI_TEXT } from '../../ui.constants';

/** The icon catalog (spec §13.3): search, shortcuts to each group and a grid to pick from. */
@Component({
  selector: 'cc-icon-grid',
  imports: [TextField, IconBadge],
  templateUrl: './icon-grid.html',
  styleUrl: './icon-grid.scss',
})
export class IconGrid {
  /** Selected icon key. */
  readonly value = model.required<string>();
  /** Palette key used to preview the icons. */
  readonly color = input<string | null>(null);

  private readonly sections = viewChildren<ElementRef<HTMLElement>>('section');

  protected readonly text = UI_TEXT;
  protected readonly query = signal('');
  protected readonly groups = computed(() => searchIcons(this.query()));

  protected jumpTo(groupId: string): void {
    this.sections()
      .find((section) => section.nativeElement.dataset['group'] === groupId)
      ?.nativeElement.scrollIntoView({ block: 'start' });
  }
}
