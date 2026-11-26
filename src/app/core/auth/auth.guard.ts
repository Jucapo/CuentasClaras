import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { APP_PATHS, REDIRECT_QUERY_PARAM } from '../routing/app-paths';
import { AuthService } from './auth.service';

/** Lets signed-in users through; otherwise redirects to the login page, remembering the target URL. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/', APP_PATHS.login], {
    queryParams: { [REDIRECT_QUERY_PARAM]: state.url },
  });
};
