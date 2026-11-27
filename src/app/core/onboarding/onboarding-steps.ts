import { IconName } from '../../shared/ui/icons/icon-glyphs';
import { APP_PATHS, ONBOARDING_STEP_PATHS } from '../routing/app-paths';

/** Identifier of a step of the setup wizard (spec §7). */
export type OnboardingStepId =
  | 'space'
  | 'accounts'
  | 'income'
  | 'expenses'
  | 'tags'
  | 'budget'
  | 'summary';

/** One step of the setup wizard. */
export interface OnboardingStep {
  readonly id: OnboardingStepId;
  /** Child route under /bienvenida. */
  readonly path: string;
  readonly title: string;
  /** Short help shown under the title. */
  readonly help: string;
  readonly icon: IconName;
  /** Optional steps say "Saltar" until something is set. */
  readonly optional: boolean;
}

/** Wizard steps in order (spec §7). */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'space',
    path: ONBOARDING_STEP_PATHS.space,
    title: 'Tu espacio',
    help: 'Un espacio agrupa las cuentas, categorías y presupuestos que compartes. Todo se puede cambiar después en Configuración.',
    icon: 'home',
    optional: false,
  },
  {
    id: 'accounts',
    path: ONBOARDING_STEP_PATHS.accounts,
    title: 'Tu situación actual',
    help: 'Agrega tus cuentas, ahorros, deudas y lo que te deben, con el saldo de hoy. De las deudas basta el nombre y lo que debes.',
    icon: 'account_balance_wallet',
    optional: false,
  },
  {
    id: 'income',
    path: ONBOARDING_STEP_PATHS.income,
    title: 'Ingresos',
    help: 'Tus fuentes de ingreso. Si quieres, anota cuánto esperas recibir al mes en cada una.',
    icon: 'trending_up',
    optional: false,
  },
  {
    id: 'expenses',
    path: ONBOARDING_STEP_PATHS.expenses,
    title: 'Categorías de gasto',
    help: 'Las categorías en que repartes tus gastos, con sus subcategorías. Luego puedes cambiar nombres, íconos y colores.',
    icon: 'category',
    optional: false,
  },
  {
    id: 'tags',
    path: ONBOARDING_STEP_PATHS.tags,
    title: 'Etiquetas',
    help: 'Las etiquetas agrupan movimientos de distintas categorías, como Fijos. Elige en qué categorías se pone sola cada una.',
    icon: 'label',
    optional: true,
  },
  {
    id: 'budget',
    path: ONBOARDING_STEP_PATHS.budget,
    title: 'Presupuesto',
    help: 'Cuánto quieres gastar al mes en cada categoría. Se repite cada mes hasta que lo cambies.',
    icon: 'pie_chart',
    optional: true,
  },
  {
    id: 'summary',
    path: ONBOARDING_STEP_PATHS.summary,
    title: 'Resumen',
    help: 'Revisa lo que configuraste. Puedes volver a cualquier paso.',
    icon: 'fact_check',
    optional: false,
  },
];

/** Where the user is in the wizard, from the space settings. */
export interface OnboardingProgress {
  readonly hasSpace: boolean;
  /** Steps completed in order (`space_settings.onboarding_step`). */
  readonly completedSteps: number;
  /** The last step was finished (`onboarding_completed_at`). */
  readonly completed: boolean;
}

/** How a step shows in the list of steps. */
export type OnboardingStepState = 'done' | 'current' | 'available' | 'locked';

/** Position of a step, from 0. */
export function stepIndex(
  id: OnboardingStepId,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): number {
  return steps.findIndex((step) => step.id === id);
}

/** URL of a step. */
export function stepUrl(id: OnboardingStepId, steps = ONBOARDING_STEPS): string {
  const step = steps.find((candidate) => candidate.id === id) ?? steps[0];
  return `/${APP_PATHS.welcome}/${step.path}`;
}

/** URL to go to after finishing a step: the next step, or the app after the last one. */
export function nextStepUrl(id: OnboardingStepId, steps = ONBOARDING_STEPS): string {
  const next = steps[stepIndex(id, steps) + 1];
  return next ? stepUrl(next.id, steps) : '/';
}

/** URL of the step before, or null on the first one. */
export function previousStepUrl(id: OnboardingStepId, steps = ONBOARDING_STEPS): string | null {
  const previous = steps[stepIndex(id, steps) - 1];
  return previous ? stepUrl(previous.id, steps) : null;
}

/** "Paso 2 de 7", with "· Opcional" on optional steps. */
export function stepProgress(id: OnboardingStepId | null, steps = ONBOARDING_STEPS): string | null {
  const index = id ? stepIndex(id, steps) : -1;
  if (index < 0) {
    return null;
  }
  const label = `Paso ${index + 1} de ${steps.length}`;
  return steps[index].optional ? `${label} · Opcional` : label;
}

/** The step to open on entering the wizard: the pending one, or the summary once complete. */
export function resumeStep(progress: OnboardingProgress, steps = ONBOARDING_STEPS): OnboardingStep {
  if (!progress.hasSpace) {
    return steps[0];
  }
  if (progress.completed) {
    return steps[steps.length - 1];
  }
  return steps[Math.min(Math.max(progress.completedSteps, 0), steps.length - 1)];
}

/** Whether a step can be opened: any step up to the pending one, or every step once complete. */
export function canOpenStep(
  id: OnboardingStepId,
  progress: OnboardingProgress,
  steps = ONBOARDING_STEPS,
): boolean {
  const index = stepIndex(id, steps);
  if (index < 0) {
    return false;
  }
  if (!progress.hasSpace) {
    return index === 0;
  }
  return progress.completed || index <= progress.completedSteps;
}

/** Steps still to do: "Faltan N pasos". */
export function pendingStepCount(progress: OnboardingProgress, steps = ONBOARDING_STEPS): number {
  if (progress.completed) {
    return 0;
  }
  return Math.max(steps.length - (progress.hasSpace ? progress.completedSteps : 0), 0);
}

/** How a step shows in the list of steps while `currentId` is open. */
export function stepState(
  id: OnboardingStepId,
  currentId: OnboardingStepId | null,
  progress: OnboardingProgress,
  steps = ONBOARDING_STEPS,
): OnboardingStepState {
  if (id === currentId) {
    return 'current';
  }
  if (!canOpenStep(id, progress, steps)) {
    return 'locked';
  }
  return progress.completed || stepIndex(id, steps) < progress.completedSteps
    ? 'done'
    : 'available';
}
