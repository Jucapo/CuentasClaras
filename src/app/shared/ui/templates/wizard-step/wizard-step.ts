import { Component, inject, input } from '@angular/core';
import { LayoutService } from '../../services/layout.service';

/**
 * One step of the setup wizard: title, short help, body (default slot) and the step actions
 * (`[ccWizardStepActions]`), which stay at the bottom of the screen in the compact window class.
 */
@Component({
  selector: 'cc-wizard-step',
  templateUrl: './wizard-step.html',
  styleUrl: './wizard-step.scss',
  host: { '[class]': "'window-' + layout.windowClass()" },
})
export class WizardStep {
  protected readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  readonly help = input<string>();
}
