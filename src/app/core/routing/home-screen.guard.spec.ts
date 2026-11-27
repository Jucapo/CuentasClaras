import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserSettings } from '../spaces/space.models';
import { SpaceService } from '../spaces/space.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { homeScreenGuard } from './home-screen.guard';

describe('homeScreenGuard', () => {
  const isAuthenticated = signal(true);
  const settings = signal<Partial<UserSettings> | null>(null);
  const ensureLoaded = vi.fn();

  beforeEach(() => {
    isAuthenticated.set(true);
    settings.set(null);
    ensureLoaded.mockReset().mockImplementation(async () => {
      settings.set({ home_screen: 'budget' });
      return { ok: true };
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated } },
        { provide: SpaceService, useValue: { ensureLoaded } },
        { provide: UserSettingsService, useValue: { settings } },
      ],
    });
  });

  async function run(): Promise<string> {
    const result = await TestBed.runInInjectionContext(() =>
      homeScreenGuard({} as ActivatedRouteSnapshot, { url: '/' } as RouterStateSnapshot),
    );
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  it('opens the home screen of the user once their settings load', async () => {
    expect(await run()).toBe('/presupuesto');
    expect(ensureLoaded).toHaveBeenCalled();
  });

  it('opens Categorías without a choice', async () => {
    ensureLoaded.mockResolvedValue({ ok: true });
    expect(await run()).toBe('/categorias');
  });

  it('does not load anything without a session', async () => {
    isAuthenticated.set(false);
    expect(await run()).toBe('/categorias');
    expect(ensureLoaded).not.toHaveBeenCalled();
  });
});
