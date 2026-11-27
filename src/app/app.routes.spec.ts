import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CategoriesService } from './core/categories/categories.service';
import { FEATURE_FLAGS } from './core/config/feature-flags';
import { SpaceService } from './core/spaces/space.service';
import { UserSettingsService } from './core/user-settings/user-settings.service';
import { ToastService } from './shared/ui/services/toast.service';

describe('app routes', () => {
  const isAuthenticated = signal(false);
  const hasSpace = signal(false);

  async function navigate(url: string, { signedIn = false, withSpace = false } = {}) {
    isAuthenticated.set(signedIn);
    hasSpace.set(withSpace);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: AuthService,
          useValue: { isAuthenticated, user: signal(null), signIn: vi.fn() },
        },
        {
          provide: SpaceService,
          useValue: {
            hasSpace,
            canEdit: signal(true),
            ensureLoaded: vi.fn().mockResolvedValue({ ok: true }),
          },
        },
        {
          provide: CategoriesService,
          useValue: { tree: () => [], loaded: signal(true), loadError: signal(null) },
        },
        { provide: UserSettingsService, useValue: { settings: signal(null) } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: FEATURE_FLAGS, useValue: { publicSignup: false } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return { harness, url: TestBed.inject(Router).url };
  }

  it('sends signed-out users from "/" to the login form', async () => {
    const { harness, url } = await navigate('/');

    expect(url).toBe('/iniciar-sesion?redirect=%2Fcategorias');
    expect(harness.routeNativeElement?.querySelector('cc-auth-layout form')).not.toBeNull();
  });

  it('sends signed-in users without a space to the first wizard step', async () => {
    const { harness, url } = await navigate('/', { signedIn: true });

    expect(url).toBe('/bienvenida/espacio');
    expect(
      harness.routeNativeElement?.querySelector('cc-wizard-layout app-space-step'),
    ).not.toBeNull();
  });

  it('opens the categories page for signed-in users with a space', async () => {
    const { harness, url } = await navigate('/', { signedIn: true, withSpace: true });

    expect(url).toBe('/categorias');
    expect(
      harness.routeNativeElement?.querySelector('cc-app-shell app-categories-page'),
    ).not.toBeNull();
  });

  it('keeps users who already have a space out of the wizard', async () => {
    const { url } = await navigate('/bienvenida', { signedIn: true, withSpace: true });

    expect(url).toBe('/categorias');
  });

  it('asks signed-out users to sign in before the wizard', async () => {
    const { url } = await navigate('/bienvenida');

    expect(url).toBe('/iniciar-sesion?redirect=%2Fbienvenida%2Fespacio');
  });

  it('does not expose the sign-up page while public sign-up is closed', async () => {
    const { url } = await navigate('/registro');

    expect(url).toBe('/iniciar-sesion?redirect=%2Fcategorias');
  });

  it('sends unknown URLs to the home page', async () => {
    const { url } = await navigate('/no-existe', { signedIn: true, withSpace: true });

    expect(url).toBe('/categorias');
  });
});
