import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { OnboardingService } from '../../../core/onboarding/onboarding.service';
import {
  ONBOARDING_STEPS,
  OnboardingStepId,
  stepProgress,
  stepState,
  stepUrl,
} from '../../../core/onboarding/onboarding-steps';
import { APP_PATHS, ROUTE_DATA_KEYS } from '../../../core/routing/app-paths';
import { activeRouteData } from '../../../core/routing/route-chain';
import { Button } from '../../../shared/ui/atoms/button/button';
import { WizardStepItem } from '../../../shared/ui/molecules/wizard-steps/wizard-steps';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { WizardLayout } from '../../../shared/ui/templates/wizard-layout/wizard-layout';

/** Way out of the wizard: there is no settings page before the space exists. */
type ExitAction = 'signOut' | 'postpone' | 'leave';

/**
 * Route host of the setup wizard: the steps and their progress, whether a flow is open, and the
 * way out ("Terminar más tarde", "Volver a la app" or, before the space exists, "Cerrar sesión").
 */
@Component({
  selector: 'app-onboarding-frame',
  imports: [RouterOutlet, WizardLayout, Button],
  templateUrl: './onboarding-frame.html',
})
export class OnboardingFrame {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly routeData = computed(() => {
    // Only a dependency: the snapshot changes on every successful navigation.
    this.router.lastSuccessfulNavigation();
    return activeRouteData(this.router);
  });
  private readonly stepId = computed(
    () => (this.routeData()[ROUTE_DATA_KEYS.onboardingStep] as OnboardingStepId | undefined) ?? null,
  );
  protected readonly immersive = computed(() => this.routeData()[ROUTE_DATA_KEYS.flow] === true);
  protected readonly progress = computed(() => stepProgress(this.stepId()));
  protected readonly steps = computed<WizardStepItem[]>(() => {
    const progress = this.onboarding.progress();
    return ONBOARDING_STEPS.map((step) => ({
      id: step.id,
      title: step.title,
      state: stepState(step.id, this.stepId(), progress),
      link: stepUrl(step.id),
      note: step.optional ? 'Opcional' : undefined,
    }));
  });

  protected readonly exit = computed<ExitAction>(() => {
    const { hasSpace, completed } = this.onboarding.progress();
    return !hasSpace ? 'signOut' : completed ? 'leave' : 'postpone';
  });
  protected readonly exitLabel = computed(
    () =>
      ({ signOut: 'Cerrar sesión', postpone: 'Terminar más tarde', leave: 'Volver a la app' })[
        this.exit()
      ],
  );
  protected readonly exitBusyLabel = computed(() =>
    this.exit() === 'signOut' ? 'Cerrando sesión' : 'Guardando',
  );
  protected readonly leaving = signal(false);

  protected async leave(): Promise<void> {
    this.leaving.set(true);
    try {
      switch (this.exit()) {
        case 'signOut':
          await this.auth.signOut();
          await this.router.navigate(['/', APP_PATHS.login]);
          return;
        case 'postpone': {
          const postponed = await this.onboarding.postpone();
          if (!postponed.ok) {
            void this.toast.show(postponed.message);
            return;
          }
          await this.router.navigateByUrl('/');
          return;
        }
        case 'leave':
          await this.router.navigateByUrl('/');
      }
    } finally {
      this.leaving.set(false);
    }
  }
}
