import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { publicSignupGuard } from './core/auth/public-signup.guard';
import {
  APP_PATHS,
  DEFAULT_HOME_PATH,
  NEW_ITEM_PATH,
  ONBOARDING_STEP_PATHS,
  SETTINGS_PATHS,
} from './core/routing/app-paths';
import { noSpaceGuard, spaceGuard } from './core/spaces/space.guard';
import { DEV_ROUTES } from './dev.routes';
import { ONBOARDING_STEP_DATA_KEY, ONBOARDING_STEPS } from './features/onboarding/onboarding-steps';

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
    canActivate: [authGuard, noSpaceGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding-frame/onboarding-frame').then(
        (m) => m.OnboardingFrame,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: ONBOARDING_STEPS[0].path },
      {
        path: ONBOARDING_STEP_PATHS.space,
        title: 'Tu espacio',
        data: { [ONBOARDING_STEP_DATA_KEY]: 'space' },
        loadComponent: () =>
          import('./features/onboarding/steps/space-step/space-step').then((m) => m.SpaceStep),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, spaceGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: APP_PATHS.accounts,
        title: 'Cuentas',
        loadComponent: () =>
          import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
      },
      {
        path: `${APP_PATHS.accounts}/${NEW_ITEM_PATH}`,
        title: 'Nueva cuenta',
        loadComponent: () =>
          import('./features/accounts/account-edit/account-edit-page').then(
            (m) => m.AccountEditPage,
          ),
      },
      {
        path: `${APP_PATHS.accounts}/:id`,
        title: 'Cuenta',
        loadComponent: () =>
          import('./features/accounts/account-edit/account-edit-page').then(
            (m) => m.AccountEditPage,
          ),
      },
      {
        path: APP_PATHS.categories,
        title: 'Categorías',
        loadComponent: () =>
          import('./features/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: APP_PATHS.transactions,
        title: 'Transacciones',
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
    ],
  },
  ...DEV_ROUTES,
  { path: '**', redirectTo: DEFAULT_HOME_PATH },
];
