import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '../../shared/ui/services/toast.service';
import { AuthService } from '../auth/auth.service';
import { APP_PATHS } from '../routing/app-paths';
import { SpaceService } from './space.service';

/**
 * Enters the app only with a space; without one, sends the user to the setup wizard.
 * Goes after `authGuard`: guards run in parallel, so without a session it defers to it.
 */
export const spaceGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (!auth.isAuthenticated()) {
    return true;
  }
  const result = await spaces.ensureLoaded();
  if (!result.ok) {
    // Without a connection the app still opens; the guard retries on the next navigation.
    void toast.show(result.message);
    return true;
  }
  return spaces.hasSpace() ? true : router.createUrlTree(['/', APP_PATHS.welcome]);
};

/** Keeps users who already have a space out of the setup wizard (until F1c resumes it). */
export const noSpaceGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  const result = await spaces.ensureLoaded();
  return result.ok && spaces.hasSpace() ? router.createUrlTree(['/']) : true;
};
