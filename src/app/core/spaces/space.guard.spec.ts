import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { ToastService } from '../../shared/ui/services/toast.service';
import { ActionResult } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { noSpaceGuard, spaceGuard } from './space.guard';
import { SpaceService } from './space.service';

describe('space guards', () => {
  const isAuthenticated = signal(true);
  const hasSpace = signal(false);
  const ensureLoaded = vi.fn<() => Promise<ActionResult>>();
  const show = vi.fn();

  beforeEach(() => {
    isAuthenticated.set(true);
    hasSpace.set(false);
    ensureLoaded.mockReset().mockResolvedValue({ ok: true });
    show.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated } },
        { provide: SpaceService, useValue: { hasSpace, ensureLoaded } },
        { provide: ToastService, useValue: { show } },
      ],
    });
  });

  async function run(guard: CanActivateFn): Promise<string | boolean> {
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: '/categorias' } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  describe('spaceGuard', () => {
    it('lets authGuard handle signed-out users', async () => {
      isAuthenticated.set(false);
      expect(await run(spaceGuard)).toBe(true);
      expect(ensureLoaded).not.toHaveBeenCalled();
    });

    it('sends users without a space to the setup wizard', async () => {
      expect(await run(spaceGuard)).toBe('/bienvenida');
    });

    it('lets users with a space into the app', async () => {
      hasSpace.set(true);
      expect(await run(spaceGuard)).toBe(true);
    });

    it('opens the app with a notice when the spaces cannot be loaded', async () => {
      ensureLoaded.mockResolvedValue({ ok: false, message: 'Sin conexión' });
      expect(await run(spaceGuard)).toBe(true);
      expect(show).toHaveBeenCalledWith('Sin conexión');
    });
  });

  describe('noSpaceGuard', () => {
    it('opens the wizard for users without a space', async () => {
      expect(await run(noSpaceGuard)).toBe(true);
    });

    it('sends users who already have a space home', async () => {
      hasSpace.set(true);
      expect(await run(noSpaceGuard)).toBe('/');
    });

    it('lets authGuard handle signed-out users', async () => {
      isAuthenticated.set(false);
      expect(await run(noSpaceGuard)).toBe(true);
    });
  });
});
