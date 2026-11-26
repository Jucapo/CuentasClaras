import { Component, computed, effect, input, untracked } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_KIND_OPTIONS,
  SELECTABLE_ACCOUNT_KINDS,
} from '../../../../core/config/catalog.constants';
import {
  ACCOUNT_KIND_GROUP,
  AccountGroup,
  AccountKind,
} from '../../../../domain/accounts/account-kinds';
import { todayIsoDate } from '../../../../domain/dates/local-date';
import { CurrencySelect } from '../../atoms/currency-select/currency-select';
import { DateField } from '../../atoms/date-field/date-field';
import { MoneyField } from '../../atoms/money-field/money-field';
import { Select, SelectOption } from '../../atoms/select/select';
import { Switch } from '../../atoms/switch/switch';
import { TextField } from '../../atoms/text-field/text-field';
import { ColorPicker } from '../../molecules/color-picker/color-picker';
import { IconPicker } from '../../molecules/icon-picker/icon-picker';
import { AccountFormValue, applyKindDefaults } from './account-form.model';

const BALANCE_TEXT: Readonly<Record<AccountGroup, { label: string; hint: string }>> = {
  accounts: { label: 'Saldo', hint: 'Lo que tenía la cuenta en la fecha del saldo.' },
  savings: { label: 'Saldo', hint: 'Lo que tenía el ahorro en la fecha del saldo.' },
  debts: { label: 'Lo que debes', hint: 'Escríbelo en positivo: la app lo cuenta como deuda.' },
  receivables: { label: 'Lo que te deben', hint: 'Lo pendiente por cobrar en la fecha del saldo.' },
  assets: { label: 'Valor', hint: 'Valor estimado en la fecha del saldo.' },
};

/**
 * Fields of an account (spec §4.1). Used by the account screens and the setup wizard; validate the
 * tree with `accountFormSchema`. Icon, color and "include in total" follow the kind until changed.
 */
@Component({
  selector: 'cc-account-form',
  imports: [
    FormField,
    TextField,
    Select,
    CurrencySelect,
    MoneyField,
    DateField,
    Switch,
    IconPicker,
    ColorPicker,
  ],
  templateUrl: './account-form.html',
  styleUrl: './account-form.scss',
})
export class AccountForm {
  readonly fields = input.required<FieldTree<AccountFormValue>>();
  /** Offers "default account"; the wizard and the account screens show it. */
  readonly showDefault = input(true);

  protected readonly today = todayIsoDate();
  protected readonly kindOptions: readonly SelectOption<AccountKind>[] =
    SELECTABLE_ACCOUNT_KINDS.map((kind) => ({
      value: kind,
      label: ACCOUNT_KIND_OPTIONS[kind].label,
      group: ACCOUNT_GROUP_LABELS[ACCOUNT_KIND_GROUP[kind]],
    }));

  private readonly group = computed(() => ACCOUNT_KIND_GROUP[this.fields().kind().value()]);
  protected readonly balanceText = computed(() => BALANCE_TEXT[this.group()]);
  /** Overdrafts happen in everyday accounts; debts and receivables are typed positive. */
  protected readonly allowNegative = computed(() => this.group() === 'accounts');
  protected readonly isPrivate = computed(() => this.fields().isPrivate().value());

  constructor() {
    let previousKind: AccountKind | null = null;
    effect(() => {
      const kind = this.fields().kind().value();
      untracked(() => {
        if (previousKind !== null && previousKind !== kind) {
          const fields = this.fields();
          const next = applyKindDefaults(fields().value(), previousKind);
          fields.icon().value.set(next.icon);
          fields.color().value.set(next.color);
          fields.includeInTotal().value.set(next.includeInTotal);
        }
        previousKind = kind;
      });
    });
  }
}
