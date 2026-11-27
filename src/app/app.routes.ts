import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { publicSignupGuard } from './core/auth/public-signup.guard';
import { onboardingGuard, onboardingStepGuard } from './core/onboarding/onboarding.guards';
import {
  ACCOUNT_PATHS,
  APP_PATHS,
  CATEGORY_PATHS,
  DEFAULT_HOME_PATH,
  FLOW_ROUTE_DATA as FLOW,
  LIST_DETAIL_ROUTE_DATA as LIST_DETAIL,
  NEW_ITEM_PATH,
  ROUTE_DATA_KEYS,
  SETTINGS_PATHS,
} from './core/routing/app-paths';
import { unsavedChangesGuard } from './core/routing/unsaved-changes.guard';
import { spaceGuard } from './core/spaces/space.guard';
import { DEV_ROUTES } from './dev.routes';

export const routes: Routes = [
  // Must stay first: an empty-path parent with a component matches "/" even when none of its
  // children do, so without this redirect "/" would render the auth layout with an empty outlet.
  { path: '', pathMatch: 'full', redirectTo: DEFAULT_HOME_PATH },
  {
    path: '',
    loadComponent: () => import('./features/auth/auth-frame/auth-frame').then((m) => m.AuthFrame),
    children: [
      {
        path: APP_PATHS.login,
        title: 'Iniciar sesión',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login-page').then((m) => m.LoginPage),
      },
      {
        path: APP_PATHS.register,
        title: 'Crear cuenta',
        canMatch: [publicSignupGuard],
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register-page').then((m) => m.RegisterPage),
      },
      {
        path: APP_PATHS.forgotPassword,
        title: 'Recuperar contraseña',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: APP_PATHS.resetPassword,
        title: 'Nueva contraseña',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password-page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
    ],
  },
  {
    path: APP_PATHS.welcome,
    canActivate: [authGuard, onboardingGuard],
    canActivateChild: [onboardingStepGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding-frame/onboarding-frame').then(
        (m) => m.OnboardingFrame,
      ),
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard, spaceGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: APP_PATHS.accounts,
        title: 'Cuentas',
        data: LIST_DETAIL,
        loadComponent: () =>
          import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
        children: [
          {
            path: NEW_ITEM_PATH,
            title: 'Nueva cuenta',
            data: FLOW,
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./features/accounts/account-edit/account-edit-page').then(
                (m) => m.AccountEditPage,
              ),
          },
          {
            // Componentless: both children inherit :id, and the edit screen's ".." is the detail.
            path: ':id',
            children: [
              {
                path: '',
                title: 'Cuenta',
                loadComponent: () =>
                  import('./features/accounts/account-detail/account-detail-page').then(
                    (m) => m.AccountDetailPage,
                  ),
              },
              {
                path: ACCOUNT_PATHS.edit,
                title: 'Editar cuenta',
                data: { ...FLOW, [ROUTE_DATA_KEYS.afterDelete]: ['../..'] },
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () =>
                  import('./features/accounts/account-edit/account-edit-page').then(
                    (m) => m.AccountEditPage,
                  ),
              },
            ],
          },
        ],
      },
      {
        path: APP_PATHS.categories,
        title: 'Categorías',
        loadComponent: () =>
          import('./features/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: `${APP_PATHS.categories}/${CATEGORY_PATHS.edit}`,
        title: 'Editar categorías',
        data: { ...LIST_DETAIL, ...FLOW },
        loadComponent: () =>
          import('./features/categories/categories-edit/categories-edit-page').then(
            (m) => m.CategoriesEditPage,
          ),
        children: [
          {
            path: NEW_ITEM_PATH,
            title: 'Nueva categoría',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./features/categories/category/category-page').then((m) => m.CategoryPage),
          },
          {
            path: ':id',
            title: 'Categoría',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('./features/categories/category/category-page').then((m) => m.CategoryPage),
          },
        ],
      },
      {
        path: APP_PATHS.transactions,
        title: 'Transacciones',
        // In the expanded class a movement is edited beside the list (spec §7).
        data: LIST_DETAIL,
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/transactions/transactions-page').then((m) => m.TransactionsPage),
      },
      {
        path: APP_PATHS.budget,
        title: 'Presupuesto',
        loadComponent: () => import('./features/budget/budget-page').then((m) => m.BudgetPage),
      },
      {
        path: APP_PATHS.summary,
        title: 'Resumen',
        loadComponent: () => import('./features/summary/summary-page').then((m) => m.SummaryPage),
      },
      {
        path: APP_PATHS.settings,
        title: 'Configuración',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: `${APP_PATHS.settings}/${SETTINGS_PATHS.currencies}`,
        title: 'Monedas',
        loadComponent: () =>
          import('./features/settings/currencies/currencies-settings-page').then(
            (m) => m.CurrenciesSettingsPage,
          ),
      },
      {
        path: `${APP_PATHS.settings}/${SETTINGS_PATHS.tags}`,
        title: 'Etiquetas',
        loadComponent: () =>
          import('./features/settings/tags/tags-settings-page').then((m) => m.TagsSettingsPage),
      },
    ],
  },
  ...DEV_ROUTES,
  { path: '**', redirectTo: DEFAULT_HOME_PATH },
];
