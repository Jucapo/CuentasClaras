import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpaceSettings } from '../spaces/space.models';
import { SpaceService } from '../spaces/space.service';
import { spaceSettingsFixture } from '../spaces/space.testing';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const settings = signal<SpaceSettings | null>(null);
  const role = signal<'owner' | 'editor'>('owner');
  const updateActiveSettings = vi.fn().mockResolvedValue({ ok: true });

  function setup(overrides: Partial<SpaceSettings> | null = {}) {
    settings.set(overrides === null ? null : spaceSettingsFixture(overrides));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SpaceService,
          useValue: {
            activeSettings: settings,
            canConfigure: computed(() => role() === 'owner'),
            updateActiveSettings,
          },
        },
      ],
    });
    return TestBed.inject(OnboardingService);
  }

  beforeEach(() => {
    role.set('owner');
    updateActiveSettings.mockClear();
  });

  it('resumes at the pending step while it was never postponed', () => {
    const onboarding = setup({ onboarding_step: 3 });

    expect(onboarding.shouldResume()).toBe(true);
    expect(onboarding.resumeUrl()).toBe('/bienvenida/gastos');
    expect(onboarding.pendingSteps()).toBe(4);
  });

  it('stops resuming once postponed, but keeps reminding', () => {
    const onboarding = setup({ onboarding_step: 3, onboarding_postponed_at: '2026-11-26T10:00:00Z' });

    expect(onboarding.shouldResume()).toBe(false);
    expect(onboarding.showReminder()).toBe(true);
  });

  it('neither resumes nor reminds once complete', () => {
    const onboarding = setup({ onboarding_step: 7, onboarding_completed_at: '2026-11-26T10:00:00Z' });

    expect(onboarding.shouldResume()).toBe(false);
    expect(onboarding.showReminder()).toBe(false);
    expect(onboarding.resumeUrl()).toBe('/bienvenida/resumen');
  });

  it('leaves the wizard to the owner', () => {
    role.set('editor');
    const onboarding = setup({ onboarding_step: 1 });

    expect(onboarding.shouldResume()).toBe(false);
    expect(onboarding.showReminder()).toBe(false);
  });

  it('saves a step as done', async () => {
    const onboarding = setup({ onboarding_step: 1 });

    await onboarding.completeStep('accounts');

    expect(updateActiveSettings).toHaveBeenCalledWith({ onboarding_step: 2 });
  });

  it('never moves the progress back when an earlier step is reviewed', async () => {
    const onboarding = setup({ onboarding_step: 4 });

    await onboarding.completeStep('accounts');

    expect(updateActiveSettings).not.toHaveBeenCalled();
  });

  it('postpones once', async () => {
    const onboarding = setup({ onboarding_step: 2 });

    await onboarding.postpone();

    expect(updateActiveSettings).toHaveBeenCalledWith({
      onboarding_postponed_at: expect.any(String),
    });

    settings.update((value) => value && { ...value, onboarding_postponed_at: 'x' });
    updateActiveSettings.mockClear();
    await onboarding.postpone();
    expect(updateActiveSettings).not.toHaveBeenCalled();
  });

  it('finishes with every step done', async () => {
    const onboarding = setup({ onboarding_step: 6 });

    await onboarding.finish();

    expect(updateActiveSettings).toHaveBeenCalledWith({
      onboarding_step: 7,
      onboarding_completed_at: expect.any(String),
    });
  });

  it('keeps the first completion date after a review', async () => {
    const onboarding = setup({ onboarding_step: 7, onboarding_completed_at: '2026-11-01T10:00:00Z' });

    await onboarding.finish();

    expect(updateActiveSettings).not.toHaveBeenCalled();
  });

  it('does nothing before the space exists', async () => {
    const onboarding = setup(null);

    await onboarding.completeStep('space');
    await onboarding.postpone();

    expect(updateActiveSettings).not.toHaveBeenCalled();
    expect(onboarding.resumeUrl()).toBe('/bienvenida/espacio');
  });
});
