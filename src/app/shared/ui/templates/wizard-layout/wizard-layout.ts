import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { StepProgress, StepProgressState } from '../../atoms/step-progress/step-progress';
import { Brand } from '../../molecules/brand/brand';
import { WizardStepItem, WizardSteps } from '../../molecules/wizard-steps/wizard-steps';
import { LayoutService } from '../../services/layout.service';

/**
 * Layout of the setup wizard (spec §13.5). Compact and medium: one step per screen with the
 * progress on top (medium in a centered card). Expanded: the steps in a side column and the step
 * next to it. `[ccWizardActions]` holds the way out; with `immersive` (a flow is open) the compact
 * and medium chrome steps aside so the flow fills the screen.
 */
@Component({
  selector: 'cc-wizard-layout',
  imports: [NgTemplateOutlet, Brand, StepProgress, WizardSteps],
  templateUrl: './wizard-layout.html',
  styleUrl: './wizard-layout.scss',
  host: {
    '[class]': "'window-' + layout.windowClass()",
    '[class.immersive]': 'immersive()',
  },
})
export class WizardLayout {
  protected readonly layout = inject(LayoutService);

  readonly steps = input<readonly WizardStepItem[]>([]);
  /** Progress text such as "Paso 2 de 7"; the progress hides without it. */
  readonly progress = input<string | null>(null);
  /** A flow is open: in compact and medium it takes the whole screen. */
  readonly immersive = input(false);

  protected readonly states = computed<StepProgressState[]>(() =>
    this.steps().map((step) =>
      step.state === 'current' ? 'current' : step.state === 'done' ? 'done' : 'pending',
    ),
  );
}
