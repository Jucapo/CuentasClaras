import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ROUTE_DATA_KEYS } from '../routing/app-paths';
import { SpaceService } from '../spaces/space.service';
import { canOpenStep, OnboardingStepId } from './onboarding-steps';
import { OnboardingService } from './onboarding.service';

/**
 * Opens the setup wizard to whoever creates a space and to the owner of the active one, who can
 * come back to review it (spec §7). Goes after `authGuard`: without a session it defers to it.
 */
export const onboardingGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  const result = await spaces.ensureLoaded();
  if (!result.ok || !spaces.hasSpace() || spaces.canConfigure()) {
    return true;
  }
  return router.createUrlTree(['/']);
};

/** Keeps the wizard from skipping ahead: without a space only step 1, then up to the pending step. */
export const onboardingStepGuard: CanActivateChildFn = async (route) => {
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  const onboarding = inject(OnboardingService);
  const router = inject(Router);
  const step = stepOf(route);
  if (!step || !auth.isAuthenticated()) {
    return true;
  }
  await spaces.ensureLoaded();
  return canOpenStep(step, onboarding.progress()) ? true : router.parseUrl(onboarding.resumeUrl());
};

/** `/bienvenida` opens the pending step, or the summary once the wizard is complete. */
export const resumeOnboardingGuard: CanActivateFn = async () => {
  const spaces = inject(SpaceService);
  const onboarding = inject(OnboardingService);
  const router = inject(Router);
  await spaces.ensureLoaded();
  return router.parseUrl(onboarding.resumeUrl());
};

/** The wizard step a route belongs to, set in its data or in a parent's. */
function stepOf(route: ActivatedRouteSnapshot): OnboardingStepId | null {
  for (const candidate of [...route.pathFromRoot].reverse()) {
    const step = candidate.data[ROUTE_DATA_KEYS.onboardingStep] as OnboardingStepId | undefined;
    if (step) {
      return step;
    }
  }
  return null;
}
