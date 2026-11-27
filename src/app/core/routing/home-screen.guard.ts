import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SpaceService } from '../spaces/space.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { DEFAULT_HOME_PATH, HOME_SCREEN_PATHS } from './app-paths';

/**
 * Opening the app at `/` goes to the home screen the user chose (spec §7); Categorías without one.
 * Goes after `authGuard` and `spaceGuard`, which win when they send elsewhere; it waits for the
 * same load as `spaceGuard`, which brings the user settings.
 */
export const homeScreenGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  const userSettings = inject(UserSettingsService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    await spaces.ensureLoaded();
  }
  const home = userSettings.settings()?.home_screen;
  return router.createUrlTree(['/', home ? HOME_SCREEN_PATHS[home] : DEFAULT_HOME_PATH]);
};
