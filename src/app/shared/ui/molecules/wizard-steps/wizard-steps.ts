import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LinkCommands } from '../../atoms/button/button';
import { Icon } from '../../atoms/icon/icon';

/** How a step shows: done, the one open, one that can be opened, or one still out of reach. */
export type WizardStepState = 'done' | 'current' | 'available' | 'locked';

/** A step of the wizard as the list of steps shows it. */
export interface WizardStepItem {
  readonly id: string;
  readonly title: string;
  readonly state: WizardStepState;
  readonly link: LinkCommands;
  /** Short note under the title, e.g. "Opcional". */
  readonly note?: string;
}

/** Vertical list of the wizard steps; each step that can be opened is a link. */
@Component({
  selector: 'cc-wizard-steps',
  imports: [NgTemplateOutlet, RouterLink, Icon],
  templateUrl: './wizard-steps.html',
  styleUrl: './wizard-steps.scss',
})
export class WizardSteps {
  readonly steps = input.required<readonly WizardStepItem[]>();
  /** Accessible name of the navigation. */
  readonly label = input.required<string>();

  /** "Paso 2: Tu situación actual, hecho", since the check mark only shows it visually. */
  protected accessibleName(step: WizardStepItem): string {
    const index = this.steps().indexOf(step) + 1;
    const note = step.note ? `, ${step.note.toLowerCase()}` : '';
    const state = step.state === 'done' ? ', hecho' : '';
    return `Paso ${index}: ${step.title}${note}${state}`;
  }
}
