import { Component, input, model } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

let nextDisclosureId = 0;

/** Collapsible section with a toggle button, e.g. "Más opciones" or "Archivadas (2)". */
@Component({
  selector: 'cc-disclosure',
  imports: [Icon],
  templateUrl: './disclosure.html',
  styleUrl: './disclosure.scss',
})
export class Disclosure {
  readonly label = input.required<string>();
  readonly open = model(false);

  protected readonly contentId = `cc-disclosure-${nextDisclosureId++}`;
}
