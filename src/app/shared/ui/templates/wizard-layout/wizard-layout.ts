import { Component, input } from '@angular/core';
import { Brand } from '../../molecules/brand/brand';

/** Centered card for the setup wizard; `[ccWizardActions]` goes next to the brand. */
@Component({
  selector: 'cc-wizard-layout',
  imports: [Brand],
  templateUrl: './wizard-layout.html',
  styleUrl: './wizard-layout.scss',
})
export class WizardLayout {
  /** Progress text such as "Paso 2 de 7"; omitted while there is a single step. */
  readonly progress = input<string>();
}
