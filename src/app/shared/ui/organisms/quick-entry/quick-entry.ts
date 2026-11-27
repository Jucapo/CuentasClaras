import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActionResult } from '../../../../core/action-result';
import {
  DELETE_TRANSACTION_CONFIRM,
  TRANSACTION_LIMITS,
} from '../../../../core/config/transaction.constants';
import { UNSAVED_CHANGES_CONFIRM } from '../../../../core/routing/unsaved-changes.guard';
import { IsoDate } from '../../../../domain/dates/local-date';
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
import { entryDateText } from '../../../../domain/periods/period-labels';
import { Button } from '../../atoms/button/button';
import { DecimalField } from '../../atoms/decimal-field/decimal-field';
import { Icon } from '../../atoms/icon/icon';
import { Message } from '../../atoms/message/message';
import { SegmentedControl, SegmentOption } from '../../atoms/segmented-control/segmented-control';
import { Select, SelectOption } from '../../atoms/select/select';
import { Switch } from '../../atoms/switch/switch';
import { TextField } from '../../atoms/text-field/text-field';
import { AmountDisplay } from '../../molecules/amount-display/amount-display';
import { ChipChoice } from '../../molecules/chip-choice/chip-choice';
import { ChipOption, ChipSelect } from '../../molecules/chip-select/chip-select';
import { ConfirmOptions, ConfirmPanel } from '../../molecules/confirm-panel/confirm-panel';
import { DateChoice } from '../../molecules/date-choice/date-choice';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { EntryEndpoint, EntryEndpoints } from '../../molecules/entry-endpoints/entry-endpoints';
import { Keypad, keypadKeyOf } from '../../molecules/keypad/keypad';
import { ListItem } from '../../molecules/list-item/list-item';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { MONEY_FORMAT } from '../../money/money-format';
import { OverlayViews } from '../../services/overlay-views';
import { OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { AccountList, AccountListGroup } from '../account-list/account-list';
import { CategoryGrid, CategoryGridItem } from '../category-grid/category-grid';
import {
  asksIncludeInSpace,
  asksInstallments,
  categoryTreeOf,
  defaultTagIds,
  includeInSpaceDefault,
  needsToAmount,
  QuickEntryAccount,
  QuickEntryCategoryTree,
  QuickEntryContext,
  quickEntrySchema,
  QuickEntryValue,
  sameQuickEntry,
} from './quick-entry.model';

/**
 * How the quick entry ends: `saved` means it already saved; `delete`, that the user confirmed
 * deleting it; `duplicate` asks for a new movement with the same data (spec §7).
 */
export type QuickEntryResult = 'saved' | 'delete' | 'duplicate' | 'cancel';

/**
 * Where the quick entry lives: a `sheet` with the keypad at the bottom (compact), a two-column
 * `dialog`, or the detail `pane` of a list (expanded), whose columns stack when it is narrow.
 */
export type QuickEntryLayout = 'sheet' | 'dialog' | 'pane';

/** Data of `cc-quick-entry`. */
export interface QuickEntryData {
  readonly mode: 'create' | 'edit';
  /**
   * Whether tags and "incluir en el espacio" follow the category and the account until the user
   * touches them: a new movement, not an edited or duplicated one.
   */
  readonly followDefaults: boolean;
  /** e.g. "Mercado", "Transferencia" or "Ajuste"; the accessible name of the entry. */
  readonly title: string;
  /** Active accounts the user can write, in their order. */
  readonly accounts: readonly QuickEntryAccount[];
  /** The same accounts by group with their balance, for the account picker. */
  readonly accountGroups: readonly AccountListGroup[];
  /** Top-level categories of the movement's kind with their subcategories; none otherwise. */
  readonly categories: readonly QuickEntryCategoryTree[];
  /** Active tags of the space. */
  readonly tags: readonly ChipOption[];
  readonly today: IsoDate;
  readonly value: QuickEntryValue;
  /** Saves the values; the entry shows the error or ends. */
  readonly save: (value: QuickEntryValue) => Promise<ActionResult>;
}

/** What covers the form: a picker, the date, or a question (spec §13.5). */
type EntryView =
  | { readonly kind: 'form' }
  | { readonly kind: 'account'; readonly target: 'source' | 'destination' }
  | { readonly kind: 'category' }
  | { readonly kind: 'date' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'discard'; readonly then: 'cancel' | 'duplicate' };

const FORM_VIEW: EntryView = { kind: 'form' };

const QUICK_ENTRY_TEXT = {
  types: { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', adjustment: 'Ajuste' },
  endpoints: 'Origen y destino',
  fromAccount: 'De cuenta',
  toAccount: 'A cuenta',
  fromCategory: 'De categoría',
  toCategory: 'A categoría',
  account: 'Cuenta',
  pickAccount: 'Elige la cuenta',
  pickCategory: 'Elige la categoría',
  sent: 'Sale',
  received: 'Llega',
  subcategory: 'Subcategoría',
  date: 'Fecha',
  installments: 'Cuotas',
  monthlyRate: 'Tasa mensual',
  rateHint: '0 = sin interés',
  tags: 'Etiquetas',
  noTags: 'No hay etiquetas. Créalas en Configuración.',
  note: 'Nota',
  includeInSpace: 'Incluir en el espacio',
  includeHint: 'Lo verán los demás miembros y contará en el presupuesto conjunto.',
  direction: 'El ajuste',
  actions: 'Acciones del movimiento',
  delete: 'Borrar',
  duplicate: 'Duplicar',
  categories: 'Categorías',
  thousandsHint: (decimal: string) =>
    `Los miles se ponen solos; usa «${decimal}» para los decimales.`,
} as const;

const DELETE_QUESTION: ConfirmOptions = { ...DELETE_TRANSACTION_CONFIRM, destructive: true };

const DISCARD_QUESTION: ConfirmOptions = { ...UNSAVED_CHANGES_CONFIRM, destructive: true };

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
 * The quick entry (spec §7), like 1Money's: on top, where the money comes from and where it goes,
 * each in its color; the subcategory chips; the amount, large and in the color of the category; the
 * note; the date in one line; installments for credit cards and "incluir en el espacio" for
 * private accounts, and the tags. A new movement shows the keypad; an edited one shows it when the
 * amount is touched, with Borrar, Fecha and Duplicar below.
 *
 * The pickers, the date and the questions are views over the form, with ← (spec §13.5): Esc and the
 * system back button return to the form, which keeps its scroll. With unsaved changes, closing asks
 * first. One organism for expenses, incomes, transfers and adjustments, new or edited, in a sheet,
 * a dialog (`cc-quick-entry-sheet`) or the detail pane of a list. The physical keyboard types the
 * amount. The host renders one instance per movement: the values start from `data`.
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
    DecimalField,
    TextField,
    Switch,
    Disclosure,
    Button,
    Icon,
    Message,
    ListItem,
    EntryEndpoints,
    DateChoice,
    ConfirmPanel,
    AccountList,
    CategoryGrid,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Only in an overlay: views add history entries there, and its dismissals ask first. */
  private readonly handle = inject<OverlayHandle<unknown>>(OverlayHandle, { optional: true });

  protected readonly text = QUICK_ENTRY_TEXT;
  protected readonly ui = UI_TEXT;
  protected readonly limits = TRANSACTION_LIMITS;
  protected readonly deleteQuestion = DELETE_QUESTION;
  protected readonly discardQuestion = DISCARD_QUESTION;
  protected readonly error = signal<string | null>(null);
  protected readonly hint = signal<string | null>(null);
  protected readonly deleting = signal(false);
  /** Which amount the keypad writes: the source or, for a transfer between currencies, what arrived. */
  protected readonly target = signal<'source' | 'destination'>('source');
  protected readonly stacked = computed(() => this.layout() === 'sheet');

  private readonly views = new OverlayViews<EntryView>(
    FORM_VIEW,
    this.host,
    inject(Injector),
    this.handle,
    '.view',
  );
  protected readonly view = this.views.current;
  protected readonly atForm = computed(() => this.view().kind === 'form');

  private readonly context = contextOf(this.data);
  private readonly model = linkedSignal<QuickEntryValue>(() => this.data().value);
  protected readonly form = form(
    this.model,
    (path) => apply(path, quickEntrySchema(this.context)),
    {
      submission: { action: () => this.save() },
    },
  );
  /**
   * A new movement starts with the keypad. An edited one in a sheet shows it when the amount is
   * touched; the dialog and the pane have room for it, and the physical keyboard types there.
   */
  protected readonly keypadOpen = linkedSignal(
    () => this.data().mode === 'create' || this.layout() !== 'sheet',
  );
  /** The floating ✓, when the keypad (and its ✓) is not there; never two of them. */
  protected readonly floatingConfirm = computed(() => (this.keypadOpen() ? null : this.ui.save));

  private readonly accountById = computed(
    () => new Map(this.data().accounts.map((account) => [account.id, account])),
  );
  protected readonly source = computed(
    () => this.accountById().get(this.model().accountId) ?? null,
  );
  protected readonly destination = computed(
    () => this.accountById().get(this.model().toAccountId) ?? null,
  );
  /** The top-level category of the movement, with its subcategories. */
  protected readonly category = computed(() =>
    categoryTreeOf(this.data().categories, this.model().categoryId),
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

  /** Where the money comes from and where it goes, as 1Money shows them (spec §7). */
  protected readonly endpoints = computed<EntryEndpoint[]>(() => {
    const account = (role: string, chosen: QuickEntryAccount | null): EntryEndpoint => ({
      role,
      name: chosen?.name ?? QUICK_ENTRY_TEXT.pickAccount,
      icon: chosen?.icon ?? 'account_balance_wallet',
      color: chosen?.color ?? null,
    });
    const category = this.category();
    const categoryEnd = (role: string): EntryEndpoint => ({
      role,
      name: category?.name ?? QUICK_ENTRY_TEXT.pickCategory,
      icon: category?.icon ?? 'category',
      color: category?.color ?? null,
    });
    switch (this.model().type) {
      case 'expense':
        return [
          account(QUICK_ENTRY_TEXT.fromAccount, this.source()),
          categoryEnd(QUICK_ENTRY_TEXT.toCategory),
        ];
      case 'income':
        return [
          categoryEnd(QUICK_ENTRY_TEXT.fromCategory),
          account(QUICK_ENTRY_TEXT.toAccount, this.source()),
        ];
      case 'transfer':
        return [
          account(QUICK_ENTRY_TEXT.fromAccount, this.source()),
          account(QUICK_ENTRY_TEXT.toAccount, this.destination()),
        ];
      case 'adjustment':
        return [account(QUICK_ENTRY_TEXT.account, this.source())];
    }
  });

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
  protected readonly amountLabel = computed(() => QUICK_ENTRY_TEXT.types[this.model().type]);
  protected readonly amountError = computed(() => this.firstError(this.form.expression()));
  protected readonly toAmountError = computed(() => this.firstError(this.form.toExpression()));
  protected readonly toAccountError = computed(() => this.firstError(this.form.toAccountId()));

  /** The category and its subcategories, as chips with their icons. */
  protected readonly categoryOptions = computed<readonly ChipOption[]>(() => {
    const category = this.category();
    return category && category.subcategories.length > 0
      ? [category, ...category.subcategories].map(({ id, name, icon }) => ({
          value: id,
          label: name,
          icon,
        }))
      : [];
  });
  protected readonly installmentOptions: readonly SelectOption<number>[] = Array.from(
    { length: TRANSACTION_LIMITS.maxInstallments },
    (_, index) => ({ value: index + 1, label: index === 0 ? '1 cuota' : `${index + 1} cuotas` }),
  );
  protected readonly directionOptions: readonly SegmentOption<'increase' | 'decrease'>[] = [
    { value: 'increase', label: 'Sube el saldo' },
    { value: 'decrease', label: 'Baja el saldo' },
  ];
  protected readonly dateText = computed(() => entryDateText(this.model().date, this.data().today));

  protected readonly tagsLabel = computed(() => {
    const { tagIds } = this.model();
    const names = this.data()
      .tags.filter((tag) => tagIds.includes(tag.value))
      .map((tag) => tag.label);
    return names.length ? `${QUICK_ENTRY_TEXT.tags} · ${names.join(' · ')}` : QUICK_ENTRY_TEXT.tags;
  });

  // ── Views ──────────────────────────────────────────────────────────────────
  protected readonly viewTitle = computed(() => {
    const view = this.view();
    switch (view.kind) {
      case 'account':
        return view.target === 'destination'
          ? QUICK_ENTRY_TEXT.toAccount
          : this.model().type === 'income'
            ? QUICK_ENTRY_TEXT.toAccount
            : QUICK_ENTRY_TEXT.fromAccount;
      case 'category':
        return QUICK_ENTRY_TEXT.categories;
      case 'date':
        return QUICK_ENTRY_TEXT.date;
      default:
        return this.data().title;
    }
  });
  /** The accounts to pick from: a transfer never goes to the account it comes from. */
  protected readonly pickerGroups = computed<AccountListGroup[]>(() => {
    const view = this.view();
    const excluded =
      view.kind === 'account' && view.target === 'destination' ? this.model().accountId : null;
    return this.data()
      .accountGroups.map((group) => ({
        ...group,
        accounts: group.accounts.filter((account) => account.id !== excluded),
      }))
      .filter((group) => group.accounts.length > 0);
  });
  protected readonly pickerCategories = computed<CategoryGridItem[]>(() =>
    this.data().categories.map(({ id, name, icon, color }) => ({ id, name, icon, color })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.views.destroy());
    // The backdrop, Esc and the system back button ask before losing changes (spec §13.5).
    this.handle?.guardClose(() => {
      if (!this.hasUnsavedChanges()) {
        return true;
      }
      queueMicrotask(() => this.views.enter({ kind: 'discard', then: 'cancel' }));
      return false;
    });
    // In a pane the keyboard types the amount right away, as the overlays focus it (spec §7).
    afterNextRender(() => {
      if (this.layout() === 'pane') {
        this.host.querySelector<HTMLElement>('cc-amount-display .display')?.focus();
      }
    });
    // Until the user picks tags, they follow the chosen category or subcategory (spec §4.3).
    effect(() => {
      const categoryId = this.form.categoryId().value();
      const category = this.category();
      if (this.form.tagIds().touched() || !this.data().followDefaults) {
        return;
      }
      untracked(() =>
        this.form
          .tagIds()
          .value.set(defaultTagIds(categoryId, category, category?.subcategories ?? [])),
      );
    });
    // A new movement takes "incluir en el espacio" from its account until the user changes it.
    effect(() => {
      const account = this.source();
      if (this.form.includeInSpace().touched() || !this.data().followDefaults) {
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
    this.keypadOpen.set(true);
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

  /** Touching an amount brings the keypad and makes it the one it writes. */
  protected editAmount(target: 'source' | 'destination'): void {
    this.target.set(target);
    this.keypadOpen.set(true);
  }

  /** A block on top opens the picker of what it shows. */
  protected pickEndpoint(index: number): void {
    const type = this.model().type;
    const categoryFirst = type === 'income';
    const isCategory =
      type !== 'transfer' && type !== 'adjustment' && index === (categoryFirst ? 0 : 1);
    if (isCategory) {
      this.views.enter({ kind: 'category' });
    } else {
      this.views.enter({
        kind: 'account',
        target: type === 'transfer' && index === 1 ? 'destination' : 'source',
      });
    }
  }

  protected pickAccount(accountId: string): void {
    const view = this.view();
    if (view.kind !== 'account') {
      return;
    }
    if (view.target === 'destination') {
      this.form.toAccountId().value.set(accountId);
      this.form.toAccountId().markAsTouched();
    } else {
      this.form.accountId().value.set(accountId);
      if (this.model().toAccountId === accountId) {
        this.form.toAccountId().value.set('');
      }
    }
    this.views.back();
  }

  protected pickCategory(categoryId: string): void {
    this.form.categoryId().value.set(categoryId);
    this.views.back();
  }

  protected pickDate(date: IsoDate): void {
    this.form.date().value.set(date);
    this.views.back();
  }

  protected openDate(): void {
    this.views.enter({ kind: 'date' });
  }

  protected askDelete(): void {
    this.views.enter({ kind: 'delete' });
  }

  protected duplicate(): void {
    if (this.hasUnsavedChanges()) {
      this.views.enter({ kind: 'discard', then: 'duplicate' });
    } else {
      this.closed.emit('duplicate');
    }
  }

  protected answeredDelete(confirmed: boolean): void {
    if (confirmed) {
      this.deleting.set(true);
      this.closed.emit('delete');
    } else {
      this.views.back();
    }
  }

  protected answeredDiscard(confirmed: boolean, then: 'cancel' | 'duplicate'): void {
    if (confirmed) {
      this.closed.emit(then);
    } else {
      this.views.back();
    }
  }

  protected back(): void {
    this.views.back();
  }

  protected submitEntry(): void {
    void submit(this.form);
  }

  /** ✕ and Esc: closes, or asks first when something changed. */
  protected requestClose(): void {
    if (this.hasUnsavedChanges()) {
      this.views.enter({ kind: 'discard', then: 'cancel' });
    } else {
      this.closed.emit('cancel');
    }
  }

  /**
   * Physical keys type the amount anywhere but in text fields; Enter and Ctrl/⌘+S save. Esc goes
   * back from a view, or closes (asking first when something changed).
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Handled here, so the overlay does not close on its own.
      event.preventDefault();
      event.stopPropagation();
      if (this.atForm()) {
        this.requestClose();
      } else {
        this.views.back();
      }
      return;
    }
    if (!this.atForm()) {
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
    const key = keypadKeyOf(event, this.decimalSeparator());
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
