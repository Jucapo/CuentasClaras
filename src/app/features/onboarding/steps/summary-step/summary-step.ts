import { Component, computed, inject } from '@angular/core';
import { AccountsService } from '../../../../core/accounts/accounts.service';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { TagsService } from '../../../../core/categories/tags.service';
import {
  ONBOARDING_STEPS,
  OnboardingStepId,
  stepUrl,
} from '../../../../core/onboarding/onboarding-steps';
import { SpaceService } from '../../../../core/spaces/space.service';
import { ACCOUNT_KIND_GROUP, AccountGroup } from '../../../../domain/accounts/account-kinds';
import { IconName } from '../../../../shared/ui/icons/icon-glyphs';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { ListItem } from '../../../../shared/ui/molecules/list-item/list-item';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { MonthlyAmounts } from '../../../budget/monthly-amounts';
import { StepActions } from '../../step-actions/step-actions';

/** A configured step as the summary lists it. */
interface SummaryRow {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly icon: IconName;
  readonly text: string;
  readonly link: string;
}

/** Singular and plural of each account group, to count them. */
const GROUP_NOUNS: Readonly<Record<AccountGroup, readonly [string, string]>> = {
  accounts: ['cuenta', 'cuentas'],
  savings: ['ahorro', 'ahorros'],
  debts: ['deuda', 'deudas'],
  receivables: ['cuenta por cobrar', 'cuentas por cobrar'],
  assets: ['bien', 'bienes'],
};

function count(amount: number, [singular, plural]: readonly [string, string]): string {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

/** "a, b y c". */
function listOf(items: readonly string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * Wizard step 7: what was set up, one row per step with a link back to it, and "Terminar", which
 * records the wizard as complete (spec §7).
 */
@Component({
  selector: 'app-summary-step',
  imports: [WizardStep, StepActions, ListItem, Icon],
  templateUrl: './summary-step.html',
})
export class SummaryStep {
  private readonly spaces = inject(SpaceService);
  private readonly accounts = inject(AccountsService);
  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly amounts = inject(MonthlyAmounts);

  protected readonly step = ONBOARDING_STEPS[6];

  private readonly texts = computed<Record<Exclude<OnboardingStepId, 'summary'>, string>>(() => ({
    space: this.spaceText(),
    accounts: this.accountsText(),
    income: this.incomeText(),
    expenses: this.expensesText(),
    tags: this.tagsText(),
    budget: this.budgetText(),
  }));

  protected readonly rows = computed<SummaryRow[]>(() => {
    const texts = this.texts();
    return ONBOARDING_STEPS.filter((step) => step.id !== 'summary').map((step) => ({
      id: step.id,
      title: step.title,
      icon: step.icon,
      text: texts[step.id as keyof typeof texts],
      link: stepUrl(step.id),
    }));
  });

  private spaceText(): string {
    const space = this.spaces.activeSpace();
    const settings = this.spaces.activeSettings();
    if (!space || !settings) {
      return '';
    }
    return `${space.name} · ${settings.main_currency} · el mes empieza el día ${settings.month_start_day}`;
  }

  private accountsText(): string {
    const active = this.accounts.accounts().filter((account) => !account.archived_at);
    if (active.length === 0) {
      return 'Sin cuentas todavía';
    }
    const groups = new Map<AccountGroup, number>();
    for (const account of active) {
      const group = ACCOUNT_KIND_GROUP[account.kind];
      groups.set(group, (groups.get(group) ?? 0) + 1);
    }
    const counted = listOf([...groups].map(([group, amount]) => count(amount, GROUP_NOUNS[group])));
    const defaultId = this.spaces.defaultAccountId();
    const defaultName = active.find((account) => account.id === defaultId)?.name;
    return defaultName ? `${counted} · Predeterminada: ${defaultName}` : counted;
  }

  private incomeText(): string {
    const sources = this.categories.tree('income').length;
    if (sources === 0) {
      return 'Sin categorías de ingreso';
    }
    const expected = this.amounts.totalsText('income');
    const counted = count(sources, ['fuente', 'fuentes']);
    return expected ? `${counted} · ${expected} esperados al mes` : counted;
  }

  private expensesText(): string {
    const tree = this.categories.tree('expense');
    if (tree.length === 0) {
      return 'Sin categorías de gasto';
    }
    const children = tree.reduce((total, node) => total + node.children.length, 0);
    return `${count(tree.length, ['categoría', 'categorías'])} y ${count(children, ['subcategoría', 'subcategorías'])}`;
  }

  private tagsText(): string {
    const tags = this.tags.activeTags().length;
    if (tags === 0) {
      return 'Sin etiquetas';
    }
    const tagged = this.categories
      .categories()
      .filter((category) => !category.archived_at && category.default_tag_ids.length > 0).length;
    const counted = count(tags, ['etiqueta', 'etiquetas']);
    return tagged > 0
      ? `${counted}, por defecto en ${count(tagged, ['categoría', 'categorías'])}`
      : counted;
  }

  private budgetText(): string {
    const total = this.amounts.totalsText('expense');
    if (!total) {
      return 'Sin presupuesto';
    }
    return `${total} al mes en ${count(this.amounts.count('expense'), ['categoría', 'categorías'])}`;
  }
}
