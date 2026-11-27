import { computed, inject, Injectable } from '@angular/core';
import { ACTION_OK, ActionResult } from '../action-result';
import { SpaceService } from '../spaces/space.service';
import {
  ONBOARDING_STEPS,
  OnboardingProgress,
  OnboardingStepId,
  pendingStepCount,
  resumeStep,
  stepIndex,
  stepUrl,
} from './onboarding-steps';

/**
 * Progress of the setup wizard of the active space (spec §7), kept in its settings so it follows
 * the owner to every device: steps done, finished, or postponed with "Terminar más tarde".
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly spaces = inject(SpaceService);

  private readonly settings = this.spaces.activeSettings;

  readonly progress = computed<OnboardingProgress>(() => {
    const settings = this.settings();
    return {
      hasSpace: !!settings,
      completedSteps: settings?.onboarding_step ?? 0,
      completed: !!settings?.onboarding_completed_at,
    };
  });
  readonly isComplete = computed(() => this.progress().completed);
  readonly isPostponed = computed(() => !!this.settings()?.onboarding_postponed_at);
  readonly pendingSteps = computed(() => pendingStepCount(this.progress()));
  /** Only the owner configures the space, so only the owner goes through the wizard. */
  private readonly ownsIncompleteSpace = computed(
    () => this.progress().hasSpace && this.spaces.canConfigure() && !this.isComplete(),
  );
  /** Entering the app opens the wizard: it was never postponed and is not complete. */
  readonly shouldResume = computed(() => this.ownsIncompleteSpace() && !this.isPostponed());
  /** The home screen and Configuración invite to finish it. */
  readonly showReminder = this.ownsIncompleteSpace;

  /** URL of the step to open on entering the wizard. */
  resumeUrl(): string {
    return stepUrl(resumeStep(this.progress()).id);
  }

  /** Records a step as done; revisiting an earlier step never moves the progress back. */
  async completeStep(id: OnboardingStepId): Promise<ActionResult> {
    const { hasSpace, completedSteps, completed } = this.progress();
    const done = stepIndex(id) + 1;
    if (!hasSpace || completed || completedSteps >= done) {
      return ACTION_OK;
    }
    return this.spaces.updateActiveSettings({ onboarding_step: done });
  }

  /** "Terminar más tarde": the app stops opening the wizard by itself, on every device. */
  async postpone(): Promise<ActionResult> {
    if (!this.progress().hasSpace || this.isComplete() || this.isPostponed()) {
      return ACTION_OK;
    }
    return this.spaces.updateActiveSettings({ onboarding_postponed_at: new Date().toISOString() });
  }

  /** Finishes the wizard; finishing it again after a review keeps the first date. */
  async finish(): Promise<ActionResult> {
    const settings = this.settings();
    if (!settings) {
      return ACTION_OK;
    }
    const steps = ONBOARDING_STEPS.length;
    if (settings.onboarding_completed_at && settings.onboarding_step >= steps) {
      return ACTION_OK;
    }
    return this.spaces.updateActiveSettings({
      onboarding_step: Math.max(settings.onboarding_step, steps),
      onboarding_completed_at: settings.onboarding_completed_at ?? new Date().toISOString(),
    });
  }
}
