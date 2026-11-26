import { Routes } from '@angular/router';
import { APP_PATHS } from './core/routing/app-paths';

/** Development-only routes: the design system catalog (spec §13.1). */
export const DEV_ROUTES: Routes = [
  {
    path: APP_PATHS.uiCatalog,
    title: 'Catálogo UI',
    loadComponent: () =>
      import('./features/ui-catalog/ui-catalog-page').then((m) => m.UiCatalogPage),
  },
];
