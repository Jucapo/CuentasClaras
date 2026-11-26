import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, input, TemplateRef } from '@angular/core';

/** One catalog entry: renders its template twice, in a light and a dark panel. */
@Component({
  selector: 'app-catalog-entry',
  imports: [NgTemplateOutlet],
  templateUrl: './catalog-entry.html',
  styleUrl: './catalog-entry.scss',
})
export class CatalogEntry {
  /** Component selector or variant name. */
  readonly name = input.required<string>();
  readonly description = input<string>();
  /** `row` for inline pieces such as buttons; `column` stacks full-width pieces such as fields. */
  readonly layout = input<'row' | 'column'>('row');
  /** Shows full-screen templates inside a fixed-height, scrollable frame. */
  readonly framed = input(false);

  protected readonly demo = contentChild.required(TemplateRef);
  protected readonly schemes = [
    { label: 'Claro', className: 'cc-scheme-light' },
    { label: 'Oscuro', className: 'cc-scheme-dark' },
  ] as const;
}
