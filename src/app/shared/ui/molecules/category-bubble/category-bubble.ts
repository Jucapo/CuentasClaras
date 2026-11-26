import { Component, input, output } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';

/**
 * A category around the donut (spec §7): name over its badge. `view` only shows it (tapping it
 * opens the quick entry from F1d), `edit` is a button that opens the category, and `add` is the
 * dashed "+" bubble that creates one.
 */
@Component({
  selector: 'cc-category-bubble',
  imports: [IconBadge, Icon],
  templateUrl: './category-bubble.html',
  styleUrl: './category-bubble.scss',
  host: { '[class.selected]': 'selected()' },
})
export class CategoryBubble {
  readonly name = input.required<string>();
  /** Icon key; not used by the `add` bubble. */
  readonly icon = input('');
  readonly color = input<string | null>(null);
  readonly variant = input<'view' | 'edit' | 'add'>('view');
  /** Its screen is open next to the grid. */
  readonly selected = input(false);
  /** Id of the help text about moving it. */
  readonly describedBy = input<string | null>(null);
  readonly keyShortcuts = input<string | null>(null);
  readonly activate = output<void>();
}
