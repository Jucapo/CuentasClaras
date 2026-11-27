import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActionResult } from '../../../../core/action-result';
import { TRANSACTION_LIMITS } from '../../../../core/config/transaction.constants';
import { addDays, IsoDate } from '../../../../domain/dates/local-date';
import {
  evaluateExpression,
  formatExpression,
  hasOperator,
  KeypadKey,
  pressKey,
} from '../../../../domain/money/amount-expression';
import { currencyMinorUnits } from '../../../../domain/money/currencies';
import { formatMoney } from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS } from '../../../../domain/money/number-format';
import { Button } from '../../atoms/button/button';
import { DateField } from '../../atoms/date-field/date-field';
import { DecimalField } from '../../atoms/decimal-field/decimal-field';
import { Message } from '../../atoms/message/message';
import { SegmentedControl, SegmentOption } from '../../atoms/segmented-control/segmented-control';
import { Select, SelectOption } from '../../atoms/select/select';
import { Switch } from '../../atoms/switch/switch';
import { TextField } from '../../atoms/text-field/text-field';
import { AmountDisplay } from '../../molecules/amount-display/amount-display';
import { ChipChoice } from '../../molecules/chip-choice/chip-choice';
import { ChipOption, ChipSelect } from '../../molecules/chip-select/chip-select';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { Keypad } from '../../molecules/keypad/keypad';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { MONEY_FORMAT } from '../../money/money-format';
import { UI_TEXT } from '../../ui.constants';
import {
  asksIncludeInSpace,
  asksInstallments,
  defaultTagIds,
  includeInSpaceDefault,
  needsToAmount,
  QuickEntryAccount,
  QuickEntryCategory,
  QuickEntryContext,
  quickEntrySchema,
  QuickEntryValue,
  sameQuickEntry,
} from './quick-entry.model';

/** How the quick entry ends: `saved` means it already saved; `delete` asks the page to confirm. */
export type QuickEntryResult = 'saved' | 'delete' | 'cancel';

/**
 * Where the quick entry lives: a tall `sheet` with the keypad at the bottom (compact), a two-column
 * `dialog`, or the detail `pane` of a list (expanded), whose columns stack when it is narrow and
 * where Esc closes it.
 */
export type QuickEntryLayout = 'sheet' | 'dialog' | 'pane';

/** Data of `cc-quick-entry`. */
export interface QuickEntryData {
  readonly mode: 'create' | 'edit';
  /** e.g. "Mercado", "Transferencia" or "Ajuste". */
  readonly title: string;
  /** Active accounts the user can write, in their order. */
  readonly accounts: readonly QuickEntryAccount[];
  /** The top-level category of an expense or income, offered with its subcategories. */
  readonly category: QuickEntryCategory | null;
  readonly subcategories: readonly QuickEntryCategory[];
  /** Active tags of the space. */
  readonly tags: readonly ChipOption[];
  readonly today: IsoDate;
  readonly value: QuickEntryValue;
  /** Saves the values; the sheet shows the error or closes. */
  readonly save: (value: QuickEntryValue) => Promise<ActionResult>;
}

type DateChoice = 'today' | 'yesterday' | 'other';

const QUICK_ENTRY_TEXT = {
  amount: 'Monto',
  sent: 'Sale',
  received: 'Llega',
  account: 'Cuenta',
  from: 'Desde',
  to: 'Hacia',
  subcategory: 'Subcategoría',
  date: 'Fecha',
  otherDate: 'Otra fecha',
  installments: 'Cuotas',
  monthlyRate: 'Tasa mensual',
  rateHint: '0 = sin interés',
  tags: 'Etiquetas',
  noTags: 'No hay etiquetas. Créalas en Configuración.',
  note: 'Nota',
  details: 'Etiquetas y nota',
  noteOnly: 'Nota',
  includeInSpace: 'Incluir en el espacio',
  includeHint: 'Lo verán los demás miembros y contará en el presupuesto conjunto.',
  direction: 'El ajuste',
  delete: 'Eliminar',
  thousandsHint: (decimal: string) =>
    `Los miles se ponen solos; usa «${decimal}» para los decimales.`,
} as const;

/** Elements where typed keys belong to the field instead of the amount. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.getAttribute('role') === 'combobox'
  );
}

// Validators read the accounts when they run, after the input is set.
function contextOf(data: Signal<QuickEntryData>): QuickEntryContext {
  return {
    get accounts() {
      return data().accounts;
    },
  };
}

/**
 * The quick entry (spec §7): a keypad that adds and subtracts, the account, the subcategory chips,
 * the date, tags and note, "incluir en el espacio" for private accounts and installments for credit
 * cards. One organism for expenses, incomes, transfers and adjustments, new or edited, in a sheet,
 * a dialog (`cc-quick-entry-sheet`) or the detail pane of a list. Outside the sheet the physical
 * keyboard types the amount. Deleting ends it with the intent so the page can confirm (spec §13.5).
 * The host renders one instance per movement: the values start from `data` and follow it.
 */
@Component({
  selector: 'cc-quick-entry',
  imports: [
    NgTemplateOutlet,
    FormField,
    OverlayPanel,
    AmountDisplay,
    Keypad,
    ChipChoice,
    ChipSelect,
    Select,
    SegmentedControl,
    DateField,
    DecimalField,
    TextField,
    Switch,
    Disclosure,
    Button,
    Message,
  ],
  templateUrl: './quick-entry.html',
  styleUrl: './quick-entry.scss',
  host: { '(keydown)': 'onKeydown($event)', '[class]': 'layout()' },
})
export class QuickEntry {
  readonly data = input.required<QuickEntryData>();
  readonly layout = input<QuickEntryLayout>('dialog');
  readonly closed = output<QuickEntryResult>();

  private readonly format = inject(MONEY_FORMAT);

  protected readonly text = QUICK_ENTRY_TEXT;
  protected readonly ui = UI_TEXT;
  protected readonly limits = TRANSACTION_LIMITS;
  protected readonly error = signal<string | null>(null);
  protected readonly hint = signal<string | null>(null);
  /** Which amount the keypad writes: the source or, for a transfer between currencies, what arrived. */
  protected readonly target = signal<'source' | 'destination'>('source');
  protected readonly stacked = computed(() => this.layout() === 'sheet');

  private readonly context = contextOf(this.data);
  private readonly model = linkedSignal<QuickEntryValue>(() => this.data().value);
  protected readonly form = form(
    this.model,
    (path) => apply(path, quickEntrySchema(this.context)),
    {
      submission: { action: () => this.save() },
    },
  );

  private readonly accountById = computed(
    () => new Map(this.data().accounts.map((account) => [account.id, account])),
  );
  protected readonly source = computed(
    () => this.accountById().get(this.model().accountId) ?? null,
  );
  protected readonly destination = computed(
    () => this.accountById().get(this.model().toAccountId) ?? null,
  );

  protected readonly isTransfer = computed(() => this.model().type === 'transfer');
  protected readonly isAdjustment = computed(() => this.model().type === 'adjustment');
  protected readonly isCategorized = computed(() => !this.isTransfer() && !this.isAdjustment());
  protected readonly twoAmounts = computed(() => needsToAmount(this.model(), this.context));
  protected readonly showInstallments = computed(() =>
    asksInstallments(this.model(), this.context),
  );
  protected readonly showRate = computed(
    () => this.showInstallments() && this.model().installments > 1,
  );
  protected readonly showInclude = computed(() => asksIncludeInSpace(this.model(), this.context));

  protected readonly decimalSeparator = computed(
    () => NUMBER_FORMAT_SEPARATORS[this.format().numberFormat].decimal,
  );
  private readonly targetCurrency = computed(() =>
    this.target() === 'destination' && this.twoAmounts()
      ? (this.destination()?.currency ?? '')
      : (this.source()?.currency ?? ''),
  );
  protected readonly showDecimal = computed(
    () => this.format().showDecimals && currencyMinorUnits(this.targetCurrency()) > 0,
  );

  protected readonly sourceAmount = computed(() =>
    this.display(this.model().expression, this.source()),
  );
  protected readonly destinationAmount = computed(() =>
    this.display(this.model().toExpression, this.destination()),
  );
  protected readonly amountError = computed(() => this.firstError(this.form.expression()));
  protected readonly toAmountError = computed(() => this.firstError(this.form.toExpression()));
  protected readonly toAccountError = computed(() => this.firstError(this.form.toAccountId()));

  protected readonly accountOptions = computed<SelectOption<string>[]>(() =>
    this.data().accounts.map((account) => ({
      value: account.id,
      label: account.name,
      group: account.group,
    })),
  );
  protected readonly toAccountOptions = computed<SelectOption<string>[]>(() =>
    this.accountOptions().filter((option) => option.value !== this.model().accountId),
  );
  protected readonly categoryOptions = computed<readonly ChipOption[]>(() => {
    const { category, subcategories } = this.data();
    return category
      ? [category, ...subcategories].map(({ id, name }) => ({ value: id, label: name }))
      : [];
  });
  protected readonly installmentOptions: readonly SelectOption<number>[] = Array.from(
    { length: TRANSACTION_LIMITS.maxInstallments },
    (_, index) => ({ value: index + 1, label: index === 0 ? '1 cuota' : `${index + 1} cuotas` }),
  );
  protected readonly dateOptions: readonly SegmentOption<DateChoice>[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'other', label: 'Otra' },
  ];
  protected readonly directionOptions: readonly SegmentOption<'increase' | 'decrease'>[] = [
    { value: 'increase', label: 'Sube el saldo' },
    { value: 'decrease', label: 'Baja el saldo' },
  ];

  private readonly yesterday = computed(() => addDays(this.data().today, -1));
  private readonly pickingOtherDate = signal(false);
  protected readonly dateChoice = computed<DateChoice>(() => {
    const date = this.model().date;
    if (this.pickingOtherDate()) {
      return 'other';
    }
    if (date === this.data().today) {
      return 'today';
    }
    return date === this.yesterday() ? 'yesterday' : 'other';
  });

  protected readonly detailsLabel = computed(() => {
    const { tagIds, note } = this.model();
    const names = this.data()
      .tags
      .filter((tag) => tagIds.includes(tag.value))
      .map((tag) => tag.label);
    const summary = [...names, ...(note.trim() ? [note.trim()] : [])].join(' · ');
    const base = this.isCategorized() ? QUICK_ENTRY_TEXT.details : QUICK_ENTRY_TEXT.noteOnly;
    return summary ? `${base} · ${summary}` : base;
  });

  constructor() {
    // Until the user picks tags, they follow the chosen category or subcategory (spec §4.3).
    effect(() => {
      const categoryId = this.form.categoryId().value();
      const { mode, category, subcategories } = this.data();
      if (this.form.tagIds().touched() || mode === 'edit') {
        return;
      }
      untracked(() =>
        this.form.tagIds().value.set(defaultTagIds(categoryId, category, subcategories)),
      );
    });
    // A new movement takes "incluir en el espacio" from its account until the user changes it.
    effect(() => {
      const account = this.source();
      if (this.form.includeInSpace().touched() || this.data().mode === 'edit') {
        return;
      }
      untracked(() => this.form.includeInSpace().value.set(includeInSpaceDefault(account)));
    });
  }

  /** Whether the values differ from those it opened with, so leaving would lose them. */
  hasUnsavedChanges(): boolean {
    return !sameQuickEntry(this.model(), this.data().value);
  }

  protected press(key: KeypadKey): void {
    this.hint.set(null);
    const exponent = currencyMinorUnits(this.targetCurrency());
    if (this.target() === 'destination' && this.twoAmounts()) {
      this.model.update((value) => ({
        ...value,
        toExpression: pressKey(value.toExpression, key, exponent),
      }));
    } else {
      this.model.update((value) => ({
        ...value,
        expression: pressKey(value.expression, key, exponent),
      }));
    }
  }

  protected chooseDate(choice: DateChoice): void {
    this.pickingOtherDate.set(choice === 'other');
    if (choice !== 'other') {
      this.form.date().value.set(choice === 'today' ? this.data().today : this.yesterday());
    }
  }

  protected submitEntry(): void {
    void submit(this.form);
  }

  protected act(result: 'delete'): void {
    this.closed.emit(result);
  }

  protected close(): void {
    this.closed.emit('cancel');
  }

  /**
   * Physical keys type the amount anywhere but in text fields; Enter and Ctrl/⌘+S save. In a pane,
   * Esc closes it (an overlay closes on its own).
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.layout() === 'pane') {
      event.preventDefault();
      this.close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.submitEntry();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) {
      return;
    }
    const key = this.keypadKey(event);
    if (key) {
      event.preventDefault();
      this.press(key);
      return;
    }
    if (event.key === NUMBER_FORMAT_SEPARATORS[this.format().numberFormat].thousands) {
      event.preventDefault();
      this.hint.set(QUICK_ENTRY_TEXT.thousandsHint(this.decimalSeparator()));
      return;
    }
    // Enter on a button presses that button.
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.submitEntry();
    }
  }

  private keypadKey(event: KeyboardEvent): KeypadKey | null {
    if (/^\d$/.test(event.key)) {
      return event.key as KeypadKey;
    }
    if (event.key === '+') {
      return 'plus';
    }
    if (event.key === '-' || event.key === '−') {
      return 'minus';
    }
    if (event.key === 'Backspace') {
      return 'backspace';
    }
    if (event.key === this.decimalSeparator() || event.code === 'NumpadDecimal') {
      return 'decimal';
    }
    return null;
  }

  private display(expression: string, account: QuickEntryAccount | null) {
    const currency = account?.currency ?? '';
    const format = this.format();
    return {
      expression: hasOperator(expression) ? formatExpression(expression, format.numberFormat) : '',
      result: formatMoney(
        evaluateExpression(expression, currencyMinorUnits(currency)),
        currency,
        format,
      ),
    };
  }

  private firstError(field: { touched(): boolean; errors(): readonly { message?: string }[] }) {
    return field.touched() ? (field.errors()[0]?.message ?? null) : null;
  }

  private async save(): Promise<undefined> {
    this.error.set(null);
    const result = await this.data().save(this.model());
    if (!result.ok) {
      this.error.set(result.message);
      return undefined;
    }
    this.closed.emit('saved');
    return undefined;
  }
}
