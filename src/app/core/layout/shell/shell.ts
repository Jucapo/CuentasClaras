import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterOutlet } from '@angular/router';
import { Button } from '../../../shared/ui/atoms/button/button';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { AppShell } from '../../../shared/ui/templates/app-shell/app-shell';
import { AuthService } from '../../auth/auth.service';
import { APP_PATHS, ROUTE_DATA_KEYS } from '../../routing/app-paths';
import { NAV_ITEMS } from '../nav-items';

/** Signed-in area: fills the app shell template and leaves it when the session ends. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, AppShell, Button, IconButton],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = NAV_ITEMS;
  protected readonly paths = APP_PATHS;

  /** `ROUTE_DATA_KEYS` flags set anywhere in the active route chain. */
  protected readonly routeFlags = computed(() => {
    // Only a dependency: the snapshot changes on every successful navigation.
    this.router.lastSuccessfulNavigation();
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let flow = false;
    let listDetail = false;
    while (route) {
      flow ||= route.data[ROUTE_DATA_KEYS.flow] === true;
      listDetail ||= route.data[ROUTE_DATA_KEYS.listDetail] === true;
      route = route.firstChild;
    }
    return { flow, listDetail };
  });

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        void this.router.navigate(['/', APP_PATHS.login]);
      }
    });
  }
}
