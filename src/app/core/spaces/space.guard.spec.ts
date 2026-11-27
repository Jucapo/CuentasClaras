import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { ToastService } from '../../shared/ui/services/toast.service';
import { ActionResult } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { SpaceSettings } from './space.models';
import { spaceGuard } from './space.guard';
import { SpaceService } from './space.service';
import { spaceSettingsFixture } from './space.testing';

describe('spaceGuard', () => {
  const isAuthenticated = signal(true);
  const settings = signal<SpaceSettings | null>(null);
  const role = signal<'owner' | 'editor'>('owner');
  const ensureLoaded = vi.fn<() => Promise<ActionResult>>();
  const show = vi.fn();

  beforeEach(() => {
    isAuthenticated.set(true);
    settings.set(null);
    role.set('owner');
    ensureLoaded.mockReset().mockResolvedValue({ ok: true });
    show.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated } },
        {
          provide: SpaceService,
          useValue: {
            hasSpace: computed(() => settings() !== null),
            activeSettings: settings,
            canConfigure: computed(() => role() === 'owner'),
            ensureLoaded,
          },
        },
        { provide: ToastService, useValue: { show } },
      ],
    });
  });

  async function run(): Promise<string | boolean> {
    const result = await TestBed.runInInjectionContext(() =>
      spaceGuard({} as ActivatedRouteSnapshot, { url: '/categorias' } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  it('lets authGuard handle signed-out users', async () => {
    isAuthenticated.set(false);
    expect(await run()).toBe(true);
    expect(ensureLoaded).not.toHaveBeenCalled();
  });

  it('sends users without a space to the setup wizard', async () => {
    expect(await run()).toBe('/bienvenida');
  });

  it('resumes a pending wizard that was never postponed', async () => {
    settings.set(spaceSettingsFixture({ onboarding_step: 3 }));
    expect(await run()).toBe('/bienvenida');
  });

  it('opens the app once the wizard was postponed', async () => {
    settings.set(
      spaceSettingsFixture({ onboarding_step: 3, onboarding_postponed_at: '2026-11-26T10:00:00Z' }),
    );
    expect(await run()).toBe(true);
  });

  it('opens the app once the wizard is complete', async () => {
    settings.set(
      spaceSettingsFixture({ onboarding_step: 7, onboarding_completed_at: '2026-11-26T10:00:00Z' }),
    );
    expect(await run()).toBe(true);
  });

  it('opens the app to members who do not own the space', async () => {
    role.set('editor');
    settings.set(spaceSettingsFixture({ onboarding_step: 1 }));
    expect(await run()).toBe(true);
  });

  it('opens the app with a notice when the spaces cannot be loaded', async () => {
    ensureLoaded.mockResolvedValue({ ok: false, message: 'Sin conexión' });
    expect(await run()).toBe(true);
    expect(show).toHaveBeenCalledWith('Sin conexión');
  });
});
