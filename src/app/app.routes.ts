import { Routes } from '@angular/router';
import { guestGuard } from './core/auth/guest.guard';
import { publicSignupGuard } from './core/auth/public-signup.guard';
import { APP_PATHS } from './core/routing/app-paths';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/auth-layout/auth-layout').then((m) => m.AuthLayout),
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
  { path: '**', redirectTo: APP_PATHS.login },
];
