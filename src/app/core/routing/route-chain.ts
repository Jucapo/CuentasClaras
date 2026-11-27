import { ActivatedRouteSnapshot, Data, Router } from '@angular/router';

/**
 * Route `data` of the whole active route chain, the deepest route winning. Read it inside a
 * computed that also reads `router.lastSuccessfulNavigation()`, so it follows every navigation.
 */
export function activeRouteData(router: Router): Data {
  const data: Data = {};
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  while (route) {
    Object.assign(data, route.data);
    route = route.firstChild;
  }
  return data;
}
