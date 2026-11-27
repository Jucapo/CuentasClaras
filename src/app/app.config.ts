import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { provideRecentIcons } from './core/catalogs/recent-icons.provider';
import { AppUpdateService } from './core/pwa/app-update.service';
import { InstallService } from './core/pwa/install.service';
import { AppTitleStrategy } from './core/routing/app-title-strategy';
import { onViewTransitionCreated } from './core/routing/view-transitions';
import { SystemBarsService } from './core/theme/system-bars.service';
import { ThemeService } from './core/theme/theme.service';
import { provideMoneyFormat } from './core/user-settings/money-format.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      // Before the first render, so a dark preference never flashes light.
      inject(ThemeService).init();
      // The system's bars follow the theme and the overlays (spec §13.2).
      inject(SystemBarsService).init();
      inject(AppUpdateService).init();
      // Before the browser offers its install prompt, which happens once, soon after loading.
      inject(InstallService).init();
      return inject(AuthService).init();
    }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // A back navigation cancelled by a guard (unsaved changes) keeps the history position.
      withRouterConfig({ canceledNavigationResolution: 'computed' }),
      // Screens fade between tabs and slide into deeper ones (spec §13.5).
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated }),
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideMoneyFormat(),
    provideRecentIcons(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
