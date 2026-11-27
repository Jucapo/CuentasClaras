import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CategoriesService } from '../../core/categories/categories.service';
import { CategoryKind } from '../../core/categories/category.models';
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_KIND_PARAM,
  categoryKindFromParam,
} from '../../core/config/catalog.constants';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import { pendingStepsText } from '../../core/onboarding/onboarding-texts';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { APP_PATHS, CATEGORY_PATHS, CATEGORY_QUERY_PARAMS } from '../../core/routing/app-paths';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import { SpaceService } from '../../core/spaces/space.service';
import { TotalsService } from '../../core/totals/totals.service';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../shared/ui/atoms/message/message';
import { TabOption, Tabs } from '../../shared/ui/atoms/tabs/tabs';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import {
  CategoryGrid,
  CategoryGridItem,
  CategoryGridTotal,
} from '../../shared/ui/organisms/category-grid/category-grid';
import { MissingRatesNotice } from '../../shared/ui/organisms/missing-rates-notice/missing-rates-notice';
import { useShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { QuickEntryFlow } from '../transactions/quick-entry-flow';
import { CATEGORY_GRID_LABELS, CATEGORY_KIND_TABS, EMPTY_CATEGORIES_TITLE } from './category-texts';

/**
 * Home screen (spec §7): the categories of a kind around the donut, with what was spent or received
 * in the selected period and what remains of each budget. Tapping a category opens the quick entry;
 * the pencil opens the edit mode.
 */
@Component({
  selector: 'app-categories-page',
  imports: [
    PageHeader,
    IconButton,
    Button,
    Message,
    Section,
    FormActions,
    Tabs,
    CategoryGrid,
    MissingRatesNotice,
  ],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage {
  /** Query param `clase`: which kind to show. */
  readonly clase = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly totals = inject(TotalsService);
  private readonly quickEntry = inject(QuickEntryFlow);
  private readonly rateFlow = inject(ExchangeRateFlow);
  protected readonly onboarding = inject(OnboardingService);

  /** "Completa tu configuración · Faltan N pasos · Continuar" while the wizard is pending. */
  protected readonly onboardingLink = ['/', APP_PATHS.welcome];
  protected readonly pendingText = computed(() => pendingStepsText(this.onboarding.pendingSteps()));

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.categories.loadError;
  protected readonly kindTabs: readonly TabOption<CategoryKind>[] = CATEGORY_KIND_TABS;
  protected readonly kind = computed(() => categoryKindFromParam(this.clase()));
  protected readonly kindLabel = computed(() => CATEGORY_KIND_LABELS[this.kind()]);
  protected readonly gridLabel = computed(() => CATEGORY_GRID_LABELS[this.kind()]);
  protected readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );
  private readonly budgetsEnabled = computed(
    () => this.spaces.activeSettings()?.budgets_enabled ?? true,
  );
  protected readonly items = computed<CategoryGridItem[]>(() =>
    this.categories.tree(this.kind()).map(({ category }) => {
      const total = this.totals.find(category.id);
      const amount = total?.amount ?? 0;
      // With budgets off, the bubbles show only what was spent (spec §4.7).
      const budget = this.budgetsEnabled() ? (total?.budget ?? null) : null;
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        amount,
        remaining: budget === null ? null : (total?.remaining ?? budget - amount),
        progress: budget ? amount / budget : null,
      };
    }),
  );
  /** Expenses and incomes of the period in the donut, the shown kind first (spec §7). */
  protected readonly gridTotals = computed<CategoryGridTotal[]>(() => {
    const kinds: CategoryKind[] =
      this.kind() === 'expense' ? ['expense', 'income'] : ['income', 'expense'];
    return kinds.map((kind) => ({
      label: CATEGORY_KIND_LABELS[kind],
      amount: this.totals.kindTotal(kind),
    }));
  });
  /** Currencies left out of the totals for lack of a rate (spec §4.6). */
  protected readonly missingRates = this.totals.missingRateCurrencies;
  protected readonly totalsError = this.totals.categoryTotalsError;
  protected readonly isEmpty = computed(
    () => this.categories.loaded() && this.items().length === 0,
  );
  protected readonly emptyTitle = computed(() => EMPTY_CATEGORIES_TITLE[this.kind()]);

  constructor() {
    useShortcuts({ e: () => void this.edit() });
  }

  protected changeKind(kind: CategoryKind): void {
    void this.router.navigate(['/', APP_PATHS.categories], {
      queryParams: { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[kind] },
      replaceUrl: true,
    });
  }

  protected record(categoryId: string): void {
    void this.quickEntry.forCategory(categoryId);
  }

  protected defineRate(currency: string): void {
    void this.rateFlow.open(currency);
  }

  protected async edit(): Promise<void> {
    if (!this.canEdit()) {
      return;
    }
    await this.router.navigate(['/', APP_PATHS.categories, CATEGORY_PATHS.edit], {
      queryParams: { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.kind()] },
    });
  }
}
