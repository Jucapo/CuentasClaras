import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '../../../core/onboarding/onboarding.service';
import {
  nextStepUrl,
  OnboardingStepId,
  previousStepUrl,
} from '../../../core/onboarding/onboarding-steps';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { ToastService } from '../../../shared/ui/services/toast.service';

/** What the main button of a step does. */
export type StepAction = 'next' | 'submit' | 'finish';

/**
 * Actions of a wizard step: "Atrás" and the main button. `next` saves the step as done and opens
 * the next one; `submit` submits the form around it (the step moves on itself); `finish` ends the
 * wizard and enters the app.
 */
@Component({
  selector: 'app-step-actions',
  imports: [Button, Message],
  templateUrl: './step-actions.html',
  styleUrl: './step-actions.scss',
})
export class StepActions {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly step = input.required<OnboardingStepId>();
  readonly action = input<StepAction>('next');
  readonly label = input('Continuar');
  /** While the surrounding form submits. */
  readonly busy = input(false);
  readonly busyLabel = input('Guardando');
  readonly error = input<string | null>(null);

  private readonly moving = signal(false);
  private readonly moveError = signal<string | null>(null);
  protected readonly loading = computed(() => this.busy() || this.moving());
  protected readonly shownError = computed(() => this.error() ?? this.moveError());
  protected readonly backLink = computed(() => previousStepUrl(this.step()));
  protected readonly type = computed(() => (this.action() === 'submit' ? 'submit' : 'button'));

  protected async act(): Promise<void> {
    if (this.action() === 'submit' || this.loading()) {
      return;
    }
    this.moving.set(true);
    this.moveError.set(null);
    const finishing = this.action() === 'finish';
    const saved = finishing
      ? await this.onboarding.finish()
      : await this.onboarding.completeStep(this.step());
    this.moving.set(false);
    if (!saved.ok) {
      this.moveError.set(saved.message);
      return;
    }
    if (finishing) {
      void this.toast.show('Tu espacio está listo.');
    }
    await this.router.navigateByUrl(nextStepUrl(this.step()));
  }
}
