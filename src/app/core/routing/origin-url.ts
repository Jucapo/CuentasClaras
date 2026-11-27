import { Router } from '@angular/router';
import { APP_PATHS } from './app-paths';

/** Top-level paths outside the signed-in shell: never a place to return to. */
const OUTSIDE_SHELL_PATHS: readonly string[] = [
  APP_PATHS.login,
  APP_PATHS.register,
  APP_PATHS.forgotPassword,
  APP_PATHS.resetPassword,
  APP_PATHS.welcome,
];

/** Whether `url` is a screen of the signed-in app, so "back" may return to it. */
export function isShellUrl(url: string): boolean {
  const [firstSegment] = url.replace(/^\//, '').split(/[/?#]/);
  return firstSegment !== '' && !OUTSIDE_SHELL_PATHS.includes(firstSegment);
}

/**
 * URL the user came from to the screen being activated, if it belongs to the signed-in app.
 * Call it while the screen's route activates (e.g. in the component constructor).
 */
export function originUrl(router: Router): string | null {
  const previous = router.currentNavigation()?.previousNavigation?.finalUrl;
  if (!previous) {
    return null;
  }
  const url = router.serializeUrl(previous);
  return isShellUrl(url) ? url : null;
}
