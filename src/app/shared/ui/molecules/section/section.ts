import { Component, input } from '@angular/core';

let nextSectionId = 0;

/** Titled block of related content, such as a group of settings. */
@Component({
  selector: 'cc-section',
  templateUrl: './section.html',
  styleUrl: './section.scss',
})
export class Section {
  readonly title = input.required<string>();
  readonly description = input<string>();

  protected readonly titleId = `cc-section-${nextSectionId++}`;
}
