import { nextStepUrl, OnboardingStep, stepProgress } from './onboarding-steps';

describe('onboarding steps', () => {
  // A longer wizard, as F1c will have, built from the only step id that exists today.
  const threeSteps: readonly OnboardingStep[] = [
    { id: 'space', path: 'espacio', title: 'Tu espacio', optional: false },
    { id: 'accounts' as 'space', path: 'cuentas', title: 'Cuentas', optional: false },
    { id: 'summary' as 'space', path: 'resumen', title: 'Resumen', optional: false },
  ];

  it('enters the app after the only step of F1a', () => {
    expect(nextStepUrl('space')).toBe('/');
  });

  it('goes to the following step when there is one', () => {
    expect(nextStepUrl('space', threeSteps)).toBe('/bienvenida/cuentas');
  });

  it('hides the progress while there is a single step', () => {
    expect(stepProgress('space')).toBeUndefined();
  });

  it('shows the step number out of the total', () => {
    expect(stepProgress('space', threeSteps)).toBe('Paso 1 de 3');
    expect(stepProgress(null, threeSteps)).toBeUndefined();
  });
});
