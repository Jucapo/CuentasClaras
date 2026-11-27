import { Component, input } from '@angular/core';

let nextSectionId = 0;

/** `highlight` stands out, e.g. the home card that invites to finish the setup. */
export type SectionVariant = 'plain' | 'highlight';

/**
 * Titled block of related content, such as a group of settings. With `hideTitle` the title only
 * names the region for assistive technology, when the screen already says it (spec §13.5).
 */
@Component({
  selector: 'cc-section',
  templateUrl: './section.html',
  styleUrl: './section.scss',
  host: { '[class.highlight]': "variant() === 'highlight'" },
})
export class Section {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly variant = input<SectionVariant>('plain');
  readonly hideTitle = input(false);

  protected readonly titleId = `cc-section-${nextSectionId++}`;
}
