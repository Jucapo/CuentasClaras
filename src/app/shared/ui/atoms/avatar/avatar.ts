import { Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * The user's avatar: the initials of the name in a circle, or a person while the name loads. Photos
 * come with file storage (spec §7). Decorative: whatever holds it names it.
 */
@Component({
  selector: 'cc-avatar',
  imports: [Icon],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  host: { '[class]': "'size-' + size()", 'aria-hidden': 'true' },
})
export class Avatar {
  /** Display name, e.g. "Juan Camilo"; empty while it loads. */
  readonly name = input('');
  readonly size = input<'md' | 'lg'>('md');

  /** Up to two initials, from the first two words: "Juan Camilo" → "JC". */
  protected readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .slice(0, 2)
      .map((word) => word[0].toLocaleUpperCase('es'))
      .join(''),
  );
}
