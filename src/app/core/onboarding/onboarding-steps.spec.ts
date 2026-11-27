import {
  canOpenStep,
  nextStepUrl,
  ONBOARDING_STEPS,
  OnboardingProgress,
  pendingStepCount,
  previousStepUrl,
  resumeStep,
  stepProgress,
  stepState,
} from './onboarding-steps';

describe('onboarding steps', () => {
  const noSpace: OnboardingProgress = { hasSpace: false, completedSteps: 0, completed: false };
  const threeDone: OnboardingProgress = { hasSpace: true, completedSteps: 3, completed: false };
  const complete: OnboardingProgress = { hasSpace: true, completedSteps: 7, completed: true };

  it('has the seven steps of the spec in order', () => {
    expect(ONBOARDING_STEPS.map((step) => step.path)).toEqual([
      'espacio',
      'cuentas',
      'ingresos',
      'gastos',
      'etiquetas',
      'presupuesto',
      'resumen',
    ]);
    expect(ONBOARDING_STEPS.filter((step) => step.optional).map((step) => step.id)).toEqual([
      'tags',
      'budget',
    ]);
  });

  it('goes to the following step, and into the app after the last one', () => {
    expect(nextStepUrl('space')).toBe('/bienvenida/cuentas');
    expect(nextStepUrl('summary')).toBe('/');
  });

  it('goes back to the previous step, except from the first one', () => {
    expect(previousStepUrl('income')).toBe('/bienvenida/cuentas');
    expect(previousStepUrl('space')).toBeNull();
  });

  it('shows the step number out of the total, and whether it is optional', () => {
    expect(stepProgress('income')).toBe('Paso 3 de 7');
    expect(stepProgress('budget')).toBe('Paso 6 de 7 · Opcional');
    expect(stepProgress(null)).toBeNull();
  });

  describe('resuming', () => {
    it('starts with the space when there is none', () => {
      expect(resumeStep(noSpace).id).toBe('space');
    });

    it('opens the first step that is not done', () => {
      expect(resumeStep(threeDone).id).toBe('expenses');
      expect(resumeStep({ ...threeDone, completedSteps: 1 }).id).toBe('accounts');
    });

    it('opens the summary once the wizard is complete', () => {
      expect(resumeStep(complete).id).toBe('summary');
    });

    it('stays on the summary while it is the only step left', () => {
      expect(resumeStep({ ...threeDone, completedSteps: 9 }).id).toBe('summary');
    });
  });

  describe('which steps can be opened', () => {
    it('only the space step without a space', () => {
      expect(canOpenStep('space', noSpace)).toBe(true);
      expect(canOpenStep('accounts', noSpace)).toBe(false);
    });

    it('every step up to the pending one', () => {
      expect(canOpenStep('space', threeDone)).toBe(true);
      expect(canOpenStep('expenses', threeDone)).toBe(true);
      expect(canOpenStep('tags', threeDone)).toBe(false);
    });

    it('every step once complete', () => {
      expect(ONBOARDING_STEPS.every((step) => canOpenStep(step.id, complete))).toBe(true);
    });
  });

  it('counts the steps still to do', () => {
    expect(pendingStepCount(noSpace)).toBe(7);
    expect(pendingStepCount(threeDone)).toBe(4);
    expect(pendingStepCount({ ...threeDone, completedSteps: 6 })).toBe(1);
    expect(pendingStepCount(complete)).toBe(0);
  });

  it('marks each step as done, current, available or locked', () => {
    expect(stepState('space', 'accounts', threeDone)).toBe('done');
    expect(stepState('accounts', 'accounts', threeDone)).toBe('current');
    expect(stepState('expenses', 'accounts', threeDone)).toBe('available');
    expect(stepState('tags', 'accounts', threeDone)).toBe('locked');
    expect(stepState('budget', 'summary', complete)).toBe('done');
  });
});
