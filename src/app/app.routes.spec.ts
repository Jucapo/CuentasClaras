import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CategoriesService } from './core/categories/categories.service';
import { FEATURE_FLAGS } from './core/config/feature-flags';
import { SpaceSettings } from './core/spaces/space.models';
import { SpaceService } from './core/spaces/space.service';
import { spaceSettingsFixture } from './core/spaces/space.testing';
import { UserSettingsService } from './core/user-settings/user-settings.service';
import { ToastService } from './shared/ui/services/toast.service';

describe('app routes', () => {
  const isAuthenticated = signal(false);
  const settings = signal<SpaceSettings | null>(null);
  const role = signal<'owner' | 'editor'>('owner');
  /** A space whose setup wizard is complete. */
  const completed = spaceSettingsFixture({
    onboarding_step: 7,
    onboarding_completed_at: '2026-11-26T10:00:00Z',
  });

  async function navigate(
    url: string,
    { signedIn = false, space = null as SpaceSettings | null, owner = true } = {},
  ) {
    isAuthenticated.set(signedIn);
    settings.set(space);
    role.set(owner ? 'owner' : 'editor');
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
            hasSpace: computed(() => settings() !== null),
            activeSettings: settings,
            activeSpace: computed(() =>
              settings() ? { id: 'space-1', name: 'Hogar', icon: 'home', color: 'green' } : null,
            ),
            canConfigure: computed(() => role() === 'owner'),
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

  it('sends signed-out users from "/" to the login form, back to "/" after it', async () => {
    const { harness, url } = await navigate('/');

    // "/" leads to the home screen the user chose once they sign in (spec §7).
    expect(url).toBe('/iniciar-sesion?redirect=%2F');
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
    const { harness, url } = await navigate('/', { signedIn: true, space: completed });

    expect(url).toBe('/categorias');
    expect(
      harness.routeNativeElement?.querySelector('cc-app-shell app-categories-page'),
    ).not.toBeNull();
  });

  it('sends the owner back to a pending wizard that was never postponed', async () => {
    const { url } = await navigate('/', {
      signedIn: true,
      space: spaceSettingsFixture({ onboarding_step: 0 }),
    });

    expect(url).toBe('/bienvenida/espacio');
  });

  it('opens the app once the wizard was postponed', async () => {
    const { url } = await navigate('/', {
      signedIn: true,
      space: spaceSettingsFixture({ onboarding_postponed_at: '2026-11-26T10:00:00Z' }),
    });

    expect(url).toBe('/categorias');
  });

  it('keeps members who do not own the space out of the wizard', async () => {
    const { url } = await navigate('/bienvenida', {
      signedIn: true,
      space: spaceSettingsFixture(),
      owner: false,
    });

    expect(url).toBe('/categorias');
  });

  it('does not let the wizard skip ahead of the pending step', async () => {
    const { url } = await navigate('/bienvenida/presupuesto', {
      signedIn: true,
      space: spaceSettingsFixture({ onboarding_step: 0, onboarding_postponed_at: 'x' }),
    });

    expect(url).toBe('/bienvenida/espacio');
  });

  it('asks signed-out users to sign in before the wizard', async () => {
    const { url } = await navigate('/bienvenida');

    expect(url).toBe('/iniciar-sesion?redirect=%2Fbienvenida');
  });

  it('does not expose the sign-up page while public sign-up is closed', async () => {
    const { url } = await navigate('/registro');

    expect(url).toBe('/iniciar-sesion?redirect=%2F');
  });

  it('sends unknown URLs to the home page', async () => {
    const { url } = await navigate('/no-existe', { signedIn: true, space: completed });

    expect(url).toBe('/categorias');
  });
});
