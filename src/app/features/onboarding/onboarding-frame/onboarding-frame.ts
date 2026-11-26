import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { Button } from '../../../shared/ui/atoms/button/button';
import { WizardLayout } from '../../../shared/ui/templates/wizard-layout/wizard-layout';
import { ONBOARDING_STEP_DATA_KEY, OnboardingStepId, stepProgress } from '../onboarding-steps';

/** Route host of the setup wizard: the wizard layout, the step progress and a way out. */
@Component({
  selector: 'app-onboarding-frame',
  imports: [RouterOutlet, WizardLayout, Button],
  templateUrl: './onboarding-frame.html',
})
export class OnboardingFrame {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly outlet = viewChild.required(RouterOutlet);
  private readonly stepId = signal<OnboardingStepId | null>(null);

  protected readonly progress = computed(() => stepProgress(this.stepId()));
  protected readonly signingOut = signal(false);

  protected onStepActivated(): void {
    this.stepId.set(this.outlet().activatedRouteData[ONBOARDING_STEP_DATA_KEY] ?? null);
  }

  // Without a space there is no settings page, so the wizard offers the way out itself.
  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigate(['/', APP_PATHS.login]);
    } finally {
      this.signingOut.set(false);
    }
  }
}
