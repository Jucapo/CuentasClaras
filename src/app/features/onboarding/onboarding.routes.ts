import { Data, Route, Routes } from '@angular/router';
import { CategoryKind } from '../../core/categories/category.models';
import { resumeOnboardingGuard } from '../../core/onboarding/onboarding.guards';
import { ONBOARDING_STEPS, OnboardingStepId } from '../../core/onboarding/onboarding-steps';
import {
  FLOW_ROUTE_DATA,
  NEW_ITEM_PATH,
  ROUTE_DATA_KEYS,
  TEMPLATE_PATH,
} from '../../core/routing/app-paths';
import { pendingSavesGuard } from '../../core/routing/pending-saves.guard';
import { unsavedChangesGuard } from '../../core/routing/unsaved-changes.guard';

const accountScreen = () =>
  import('../accounts/account-edit/account-edit-page').then((m) => m.AccountEditPage);
const categoryScreen = () =>
  import('../categories/category/category-page').then((m) => m.CategoryPage);

function stepOf(id: OnboardingStepId) {
  const step = ONBOARDING_STEPS.find((candidate) => candidate.id === id);
  if (!step) {
    throw new Error(`Unknown wizard step ${id}`);
  }
  return step;
}

function stepData(id: OnboardingStepId, extra: Data = {}): Data {
  return { [ROUTE_DATA_KEYS.onboardingStep]: id, ...extra };
}

/** A create or edit screen reused inside a step: it goes back to the step when it closes. */
function flowRoute(path: string, title: string, loadComponent: Route['loadComponent']): Route {
  return {
    path,
    title,
    data: FLOW_ROUTE_DATA,
    canDeactivate: [unsavedChangesGuard],
    loadComponent,
  };
}

/** Income or expense categories: the step, the suggested template and the category screen. */
function categoryStep(id: 'income' | 'expenses', kind: CategoryKind): Route {
  const step = stepOf(id);
  return {
    path: step.path,
    data: stepData(id, { [ROUTE_DATA_KEYS.categoryKind]: kind }),
    children: [
      {
        path: '',
        title: step.title,
        // The expected incomes are typed in rows that save on their own (spec §13.5).
        canDeactivate: [pendingSavesGuard],
        loadComponent: () =>
          import('./steps/categories-step/categories-step').then((m) => m.CategoriesStep),
      },
      {
        path: TEMPLATE_PATH,
        title: 'Categorías sugeridas',
        data: FLOW_ROUTE_DATA,
        loadComponent: () =>
          import('./steps/category-template/category-template-page').then(
            (m) => m.CategoryTemplatePage,
          ),
      },
      flowRoute(NEW_ITEM_PATH, 'Nueva categoría', categoryScreen),
      flowRoute(':id', 'Categoría', categoryScreen),
    ],
  };
}

/**
 * Steps of the setup wizard under `/bienvenida` (spec §7). The account and category screens are
 * the ones of the app, nested under their step so they come back to it.
 */
export const ONBOARDING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [resumeOnboardingGuard], children: [] },
  {
    path: stepOf('space').path,
    title: stepOf('space').title,
    data: stepData('space'),
    loadComponent: () => import('./steps/space-step/space-step').then((m) => m.SpaceStep),
  },
  {
    path: stepOf('accounts').path,
    data: stepData('accounts'),
    children: [
      {
        path: '',
        title: stepOf('accounts').title,
        loadComponent: () =>
          import('./steps/accounts-step/accounts-step').then((m) => m.AccountsStep),
      },
      flowRoute(NEW_ITEM_PATH, 'Nueva cuenta', accountScreen),
      flowRoute(':id', 'Cuenta', accountScreen),
    ],
  },
  categoryStep('income', 'income'),
  categoryStep('expenses', 'expense'),
  {
    path: stepOf('tags').path,
    title: stepOf('tags').title,
    data: stepData('tags'),
    loadComponent: () => import('./steps/tags-step/tags-step').then((m) => m.TagsStep),
  },
  {
    path: stepOf('budget').path,
    title: stepOf('budget').title,
    data: stepData('budget'),
    canDeactivate: [pendingSavesGuard],
    loadComponent: () => import('./steps/budget-step/budget-step').then((m) => m.BudgetStep),
  },
  {
    path: stepOf('summary').path,
    title: stepOf('summary').title,
    data: stepData('summary'),
    loadComponent: () => import('./steps/summary-step/summary-step').then((m) => m.SummaryStep),
  },
];
