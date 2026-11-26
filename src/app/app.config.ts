import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { AppTitleStrategy } from './core/routing/app-title-strategy';
import { ThemeService } from './core/theme/theme.service';
import { provideMoneyFormat } from './core/user-settings/money-format.provider';
import { provideUi } from './shared/ui/ui.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      // Before the first render, so a dark preference never flashes light.
      inject(ThemeService).init();
      return inject(AuthService).init();
    }),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideUi(),
    provideMoneyFormat(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
