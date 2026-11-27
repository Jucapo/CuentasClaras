import { Component, computed, inject } from '@angular/core';
import { BudgetsService } from '../../../../core/budgets/budgets.service';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { ONBOARDING_STEPS, stepUrl } from '../../../../core/onboarding/onboarding-steps';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import { Section } from '../../../../shared/ui/molecules/section/section';
import { BudgetList } from '../../../../shared/ui/organisms/budget-list/budget-list';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { MonthlyAmounts } from '../../../budget/monthly-amounts';
import { StepActions } from '../../step-actions/step-actions';

/**
 * Wizard step 6 (optional), the budget: a monthly amount per expense category, typed in the
 * amount sheet, with the total next to the expected income. The full budget screens are F1e.
 */
@Component({
  selector: 'app-budget-step',
  imports: [WizardStep, StepActions, BudgetList, Section, FormActions, Button, Message],
  templateUrl: './budget-step.html',
})
export class BudgetStep {
  private readonly categories = inject(CategoriesService);
  private readonly budgets = inject(BudgetsService);
  protected readonly amounts = inject(MonthlyAmounts);

  protected readonly step = ONBOARDING_STEPS[5];
  protected readonly expensesLink = stepUrl('expenses');
  protected readonly loadError = computed(
    () => this.budgets.loadError() ?? this.categories.loadError(),
  );
  protected readonly entries = computed(() => this.amounts.entries('expense'));
  protected readonly totals = computed(() => this.amounts.totals('expense'));
  protected readonly isEmpty = computed(
    () => this.categories.loaded() && this.entries().length === 0,
  );
  protected readonly totalNote = computed(() => {
    const income = this.amounts.totalsText('income');
    return income ? `Ingreso esperado: ${income}` : undefined;
  });
  protected readonly nextLabel = computed(() =>
    this.amounts.count('expense') === 0 ? 'Saltar' : 'Continuar',
  );
}
