import { Component, computed, inject, input, signal } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_KIND_OPTIONS,
  SELECTABLE_ACCOUNT_KINDS,
} from '../../../../core/config/catalog.constants';
import { currencyLabel, SUPPORTED_CURRENCIES } from '../../../../core/config/space.constants';
import {
  ACCOUNT_KIND_GROUP,
  AccountGroup,
  AccountKind,
} from '../../../../domain/accounts/account-kinds';
import { todayIsoDate } from '../../../../domain/dates/local-date';
import { DateField } from '../../atoms/date-field/date-field';
import { Switch } from '../../atoms/switch/switch';
import { TitleField } from '../../atoms/title-field/title-field';
import { AppearancePicker } from '../../molecules/appearance-picker/appearance-picker';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { FieldRow } from '../../molecules/field-row/field-row';
import { FlowHero } from '../../molecules/flow-hero/flow-hero';
import { MoneyRow } from '../../molecules/money-row/money-row';
import { OptionPanel, OptionPanelData } from '../../molecules/option-panel/option-panel';
import { OverlayService } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { AccountFormValue, applyKindDefaults } from './account-editor.model';

let nextEditorId = 0;

const BALANCE_TEXT: Readonly<Record<AccountGroup, { label: string; hint: string }>> = {
  accounts: { label: 'Saldo', hint: 'Lo que tenía la cuenta en la fecha del saldo.' },
  savings: { label: 'Saldo', hint: 'Lo que tenía el ahorro en la fecha del saldo.' },
  debts: { label: 'Lo que debes', hint: 'Escríbelo en positivo: la app lo cuenta como deuda.' },
  receivables: { label: 'Lo que te deben', hint: 'Lo pendiente por cobrar en la fecha del saldo.' },
  assets: { label: 'Valor', hint: 'Valor estimado en la fecha del saldo.' },
};

/**
 * An account as a short flow (spec §7, §13.5): the large name with the icon and color badge, rows
 * for kind and currency that open their lists, the balance typed in its row, switches, and "Más
 * opciones". Used by the account screen and the setup wizard; validate the tree with
 * `accountFormSchema`.
 */
@Component({
  selector: 'cc-account-editor',
  imports: [
    FormField,
    FlowHero,
    TitleField,
    AppearancePicker,
    FieldRow,
    MoneyRow,
    Switch,
    Disclosure,
    DateField,
  ],
  templateUrl: './account-editor.html',
  styleUrl: './account-editor.scss',
})
export class AccountEditor {
  readonly fields = input.required<FieldTree<AccountFormValue>>();
  /** Offers "default account"; the wizard and the account screens show it. */
  readonly showDefault = input(true);
  /** Puts the cursor in the name; only when creating (spec §13.5). */
  readonly autofocusName = input(false);

  private readonly overlay = inject(OverlayService);

  protected readonly text = UI_TEXT;
  protected readonly today = todayIsoDate();
  protected readonly moreOpen = signal(false);
  protected readonly rowsTitleId = `cc-account-editor-${nextEditorId++}`;

  private readonly value = computed(() => this.fields()().value());
  private readonly group = computed(() => ACCOUNT_KIND_GROUP[this.value().kind]);
  protected readonly balanceText = computed(() => BALANCE_TEXT[this.group()]);
  protected readonly kindLabel = computed(() => ACCOUNT_KIND_OPTIONS[this.value().kind].label);
  protected readonly currencyText = computed(() => currencyLabel(this.value().currency));
  /** Overdrafts happen in everyday accounts; debts and receivables are typed positive. */
  protected readonly allowNegativeBalance = computed(() => this.group() === 'accounts');
  protected readonly isPrivate = computed(() => this.value().isPrivate);

  protected async pickKind(): Promise<void> {
    const kind = this.fields().kind;
    const picked = await this.overlay.open<AccountKind, OptionPanelData<AccountKind>>(OptionPanel, {
      label: 'Tipo',
      data: {
        title: 'Tipo',
        mode: 'single',
        selected: kind().value(),
        options: SELECTABLE_ACCOUNT_KINDS.map((option) => ({
          value: option,
          label: ACCOUNT_KIND_OPTIONS[option].label,
          icon: ACCOUNT_KIND_OPTIONS[option].icon,
          color: ACCOUNT_KIND_OPTIONS[option].color,
          group: ACCOUNT_GROUP_LABELS[ACCOUNT_KIND_GROUP[option]],
        })),
      },
    });
    if (!picked || picked === kind().value()) {
      return;
    }
    // Icon, color and "include in total" follow the kind until the user changes them.
    const fields = this.fields();
    const next = applyKindDefaults({ ...fields().value(), kind: picked }, kind().value());
    kind().value.set(picked);
    fields.icon().value.set(next.icon);
    fields.color().value.set(next.color);
    fields.includeInTotal().value.set(next.includeInTotal);
  }

  protected async pickCurrency(): Promise<void> {
    const currency = this.fields().currency;
    const picked = await this.overlay.open<string, OptionPanelData<string>>(OptionPanel, {
      label: 'Moneda',
      data: {
        title: 'Moneda',
        mode: 'single',
        selected: currency().value(),
        options: SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: currencyLabel(code) })),
      },
    });
    if (picked) {
      currency().value.set(picked);
    }
  }
}
