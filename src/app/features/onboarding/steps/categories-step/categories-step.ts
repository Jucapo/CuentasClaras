import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { CategoryKind } from '../../../../core/categories/category.models';
import { CATEGORY_KIND_LABELS, CATEGORY_KIND_PARAM } from '../../../../core/config/catalog.constants';
import { CATEGORY_TEMPLATE } from '../../../../core/config/category-template';
import { ONBOARDING_STEPS, stepUrl } from '../../../../core/onboarding/onboarding-steps';
import {
  CATEGORY_QUERY_PARAMS,
  NEW_ITEM_PATH,
  TEMPLATE_PATH,
} from '../../../../core/routing/app-paths';
import { SpaceService } from '../../../../core/spaces/space.service';
import { IconBadge } from '../../../../shared/ui/atoms/icon-badge/icon-badge';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { ListItem } from '../../../../shared/ui/molecules/list-item/list-item';
import { Section } from '../../../../shared/ui/molecules/section/section';
import { BudgetList } from '../../../../shared/ui/organisms/budget-list/budget-list';
import {
  CategoryGrid,
  CategoryGridItem,
} from '../../../../shared/ui/organisms/category-grid/category-grid';
import { useShortcuts } from '../../../../shared/ui/services/keyboard-shortcuts';
import { ToastService } from '../../../../shared/ui/services/toast.service';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { UI_TEXT } from '../../../../shared/ui/ui.constants';
import { MonthlyAmounts } from '../../../budget/monthly-amounts';
import { CATEGORY_GRID_LABELS } from '../../../categories/category-texts';
import { StepActions } from '../../step-actions/step-actions';

/** How the suggested template is offered for each kind (spec Anexo A). */
const TEMPLATE_CHOICE: Readonly<Record<CategoryKind, { title: string; subtitle: string }>> = {
  income: {
    title: 'Usar las sugeridas',
    subtitle: CATEGORY_TEMPLATE.income.map((category) => category.name).join(', '),
  },
  expense: {
    title: 'Partir de la plantilla sugerida',
    subtitle: `${CATEGORY_TEMPLATE.expense.length} categorías con subcategorías, como Hogar, Mercado y Transporte`,
  },
};

/**
 * Wizard steps 3 and 4, income and expense categories: start from scratch or from the suggested
 * template, then the grid in edit mode with the category screens of the app. Income categories
 * also take an optional expected monthly amount.
 */
@Component({
  selector: 'app-categories-step',
  imports: [
    WizardStep,
    StepActions,
    CategoryGrid,
    BudgetList,
    Section,
    ListItem,
    IconBadge,
    Message,
  ],
  templateUrl: './categories-step.html',
  styleUrl: './categories-step.scss',
})
export class CategoriesStep {
  /** Route data: which kind of categories the step sets up. */
  readonly categoryKind = input.required<CategoryKind>();

  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly amounts = inject(MonthlyAmounts);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.categories.loadError;
  protected readonly help = UI_TEXT.gridEditHelp;

  protected readonly step = computed(
    () => ONBOARDING_STEPS.find((step) => step.id === this.stepId()) ?? ONBOARDING_STEPS[2],
  );
  private readonly stepId = computed(() =>
    this.categoryKind() === 'income' ? 'income' : 'expenses',
  );
  private readonly stepLink = computed(() => stepUrl(this.stepId()));
  protected readonly isIncome = computed(() => this.categoryKind() === 'income');
  protected readonly kindLabel = computed(() => CATEGORY_KIND_LABELS[this.categoryKind()]);
  protected readonly gridLabel = computed(() => CATEGORY_GRID_LABELS[this.categoryKind()]);
  protected readonly templateChoice = computed(() => TEMPLATE_CHOICE[this.categoryKind()]);
  protected readonly templateLink = computed(() => [this.stepLink(), TEMPLATE_PATH]);
  protected readonly newLink = computed(() => [this.stepLink(), NEW_ITEM_PATH]);
  protected readonly kindParams = computed(() => ({
    [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.categoryKind()],
  }));

  protected readonly items = computed<CategoryGridItem[]>(() =>
    this.categories.tree(this.categoryKind()).map(({ category }) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    })),
  );
  protected readonly isEmpty = computed(
    () => this.categories.loaded() && this.items().length === 0,
  );
  protected readonly amountEntries = computed(() => this.amounts.entries(this.categoryKind()));
  protected readonly amountTotals = computed(() => this.amounts.totals(this.categoryKind()));

  constructor() {
    useShortcuts({ n: () => void this.create() });
  }

  protected open(id: string): void {
    void this.router.navigate([this.stepLink(), id], { queryParams: this.kindParams() });
  }

  protected async create(): Promise<void> {
    if (this.canEdit()) {
      await this.router.navigate(this.newLink(), { queryParams: this.kindParams() });
    }
  }

  protected async reorder(ids: readonly string[]): Promise<void> {
    const saved = await this.categories.reorder(ids);
    if (!saved.ok) {
      void this.toast.show(saved.message);
    }
  }
}
