import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ROUTE_DATA_KEYS } from '../routing/app-paths';
import { SpaceSettings } from '../spaces/space.models';
import { SpaceService } from '../spaces/space.service';
import { spaceSettingsFixture } from '../spaces/space.testing';
import { onboardingGuard, onboardingStepGuard, resumeOnboardingGuard } from './onboarding.guards';
import { OnboardingStepId } from './onboarding-steps';

describe('onboarding guards', () => {
  const isAuthenticated = signal(true);
  const settings = signal<SpaceSettings | null>(null);
  const role = signal<'owner' | 'editor'>('owner');

  beforeEach(() => {
    isAuthenticated.set(true);
    settings.set(null);
    role.set('owner');
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
            ensureLoaded: vi.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    });
  });

  async function run(guard: CanActivateFn, step?: OnboardingStepId): Promise<string | boolean> {
    const route = {
      data: step ? { [ROUTE_DATA_KEYS.onboardingStep]: step } : {},
    } as unknown as ActivatedRouteSnapshot;
    Object.defineProperty(route, 'pathFromRoot', { value: [route] });
    const result = await TestBed.runInInjectionContext(() =>
      guard(route, { url: '/bienvenida' } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  describe('onboardingGuard', () => {
    it('opens the wizard to create a space', async () => {
      expect(await run(onboardingGuard)).toBe(true);
    });

    it('opens the wizard to the owner, even once complete', async () => {
      settings.set(spaceSettingsFixture({ onboarding_completed_at: '2026-11-26T10:00:00Z' }));
      expect(await run(onboardingGuard)).toBe(true);
    });

    it('keeps other members out', async () => {
      role.set('editor');
      settings.set(spaceSettingsFixture());
      expect(await run(onboardingGuard)).toBe('/');
    });

    it('lets authGuard handle signed-out users', async () => {
      isAuthenticated.set(false);
      expect(await run(onboardingGuard)).toBe(true);
    });
  });

  describe('onboardingStepGuard', () => {
    it('only opens the space step without a space', async () => {
      expect(await run(onboardingStepGuard, 'space')).toBe(true);
      expect(await run(onboardingStepGuard, 'accounts')).toBe('/bienvenida/espacio');
    });

    it('opens steps up to the pending one and sends later ones to it', async () => {
      settings.set(spaceSettingsFixture({ onboarding_step: 3 }));
      expect(await run(onboardingStepGuard, 'space')).toBe(true);
      expect(await run(onboardingStepGuard, 'expenses')).toBe(true);
      expect(await run(onboardingStepGuard, 'budget')).toBe('/bienvenida/gastos');
    });

    it('opens every step once complete', async () => {
      settings.set(
        spaceSettingsFixture({ onboarding_step: 7, onboarding_completed_at: '2026-11-26T10:00:00Z' }),
      );
      expect(await run(onboardingStepGuard, 'budget')).toBe(true);
    });

    it('lets routes outside the steps through', async () => {
      expect(await run(onboardingStepGuard)).toBe(true);
    });
  });

  describe('resumeOnboardingGuard', () => {
    it('opens the pending step', async () => {
      settings.set(spaceSettingsFixture({ onboarding_step: 2 }));
      expect(await run(resumeOnboardingGuard)).toBe('/bienvenida/ingresos');
    });

    it('opens the summary once complete', async () => {
      settings.set(
        spaceSettingsFixture({ onboarding_step: 7, onboarding_completed_at: '2026-11-26T10:00:00Z' }),
      );
      expect(await run(resumeOnboardingGuard)).toBe('/bienvenida/resumen');
    });
  });
});
