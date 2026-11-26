import { APP_PATHS, ONBOARDING_STEP_PATHS } from '../../core/routing/app-paths';

/** Identifier of a wizard step; F1c adds steps 2 to 7 (spec §7). */
export type OnboardingStepId = 'space';

/** One step of the setup wizard. */
export interface OnboardingStep {
  readonly id: OnboardingStepId;
  /** Child route under /bienvenida. */
  readonly path: string;
  readonly title: string;
  /** Optional steps can be skipped. */
  readonly optional: boolean;
}

/** Wizard steps in order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'space', path: ONBOARDING_STEP_PATHS.space, title: 'Tu espacio', optional: false },
];

/** Route data key that names the step a route renders. */
export const ONBOARDING_STEP_DATA_KEY = 'onboardingStep';

/** URL to go to after finishing a step: the next step, or the app after the last one. */
export function nextStepUrl(
  id: OnboardingStepId,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): string {
  const next = steps[steps.findIndex((step) => step.id === id) + 1];
  return next ? `/${APP_PATHS.welcome}/${next.path}` : '/';
}

/** "Paso 2 de 7", or nothing while the wizard has a single step. */
export function stepProgress(
  id: OnboardingStepId | null,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): string | undefined {
  const index = steps.findIndex((step) => step.id === id);
  return index < 0 || steps.length < 2 ? undefined : `Paso ${index + 1} de ${steps.length}`;
}
