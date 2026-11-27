import { Component, inject, signal } from '@angular/core';
import { apply, disabled, form, FormField, required } from '@angular/forms/signals';
import { ACTION_OK } from '../../core/action-result';
import { NUMBER_FORMAT_DEFAULTS, SPACE_DEFAULTS } from '../../core/config/space.constants';
import { NAV_ITEMS } from '../../core/layout/nav-items';
import { APP_PATHS } from '../../core/routing/app-paths';
import { CurrencyAmount } from '../../domain/money/money';
import { Amount } from '../../shared/ui/atoms/amount/amount';
import { Button } from '../../shared/ui/atoms/button/button';
import { ColorSwatch } from '../../shared/ui/atoms/color-swatch/color-swatch';
import { CurrencySelect } from '../../shared/ui/atoms/currency-select/currency-select';
import { DateField } from '../../shared/ui/atoms/date-field/date-field';
import { DecimalField } from '../../shared/ui/atoms/decimal-field/decimal-field';
import { Donut, DonutSegment } from '../../shared/ui/atoms/donut/donut';
import { IconBadge } from '../../shared/ui/atoms/icon-badge/icon-badge';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import { MoneyField } from '../../shared/ui/atoms/money-field/money-field';
import { PasswordField } from '../../shared/ui/atoms/password-field/password-field';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/atoms/segmented-control/segmented-control';
import { Select, SelectOption } from '../../shared/ui/atoms/select/select';
import { Switch } from '../../shared/ui/atoms/switch/switch';
import { TabOption, Tabs } from '../../shared/ui/atoms/tabs/tabs';
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
import { TitleField } from '../../shared/ui/atoms/title-field/title-field';
import { AccountRow } from '../../shared/ui/molecules/account-row/account-row';
import {
  AmountPanel,
  AmountPanelData,
  AmountPanelResult,
} from '../../shared/ui/molecules/amount-panel/amount-panel';
import { AppearanceEditor } from '../../shared/ui/molecules/appearance-editor/appearance-editor';
import { AppearancePicker } from '../../shared/ui/molecules/appearance-picker/appearance-picker';
import { Brand } from '../../shared/ui/molecules/brand/brand';
import { AmountDisplay } from '../../shared/ui/molecules/amount-display/amount-display';
import { CategoryBubble } from '../../shared/ui/molecules/category-bubble/category-bubble';
import { ChipChoice } from '../../shared/ui/molecules/chip-choice/chip-choice';
import { Keypad } from '../../shared/ui/molecules/keypad/keypad';
import { PeriodChip } from '../../shared/ui/molecules/period-chip/period-chip';
import {
  ExchangeRateSheet,
  ExchangeRateSheetData,
} from '../../shared/ui/organisms/exchange-rate-sheet/exchange-rate-sheet';
import { PeriodPanel, PeriodPanelData } from '../../shared/ui/organisms/period-panel/period-panel';
import {
  QuickEntrySheet,
  QuickEntrySheetData,
} from '../../shared/ui/organisms/quick-entry-sheet/quick-entry-sheet';
import { QuickEntryValue } from '../../shared/ui/organisms/quick-entry-sheet/quick-entry.model';
import {
  TransactionList,
  TransactionListGroup,
} from '../../shared/ui/organisms/transaction-list/transaction-list';
import { ChipOption, ChipSelect } from '../../shared/ui/molecules/chip-select/chip-select';
import { ColorGrid } from '../../shared/ui/molecules/color-grid/color-grid';
import { Disclosure } from '../../shared/ui/molecules/disclosure/disclosure';
import { FieldRow } from '../../shared/ui/molecules/field-row/field-row';
import { FlowHero } from '../../shared/ui/molecules/flow-hero/flow-hero';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
import { IconGrid } from '../../shared/ui/molecules/icon-grid/icon-grid';
import { ListItem } from '../../shared/ui/molecules/list-item/list-item';
import { NavItem } from '../../shared/ui/molecules/nav-item/nav-item';
import { OverlayPanel } from '../../shared/ui/molecules/overlay-panel/overlay-panel';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { AccountEditor } from '../../shared/ui/organisms/account-editor/account-editor';
import {
  accountFormSchema,
  AccountFormValue,
  newAccountFormValue,
} from '../../shared/ui/organisms/account-editor/account-editor.model';
import { AccountList, AccountListGroup } from '../../shared/ui/organisms/account-list/account-list';
import { BottomNav } from '../../shared/ui/organisms/bottom-nav/bottom-nav';
import { CategoryEditor } from '../../shared/ui/organisms/category-editor/category-editor';
import {
  categoryFormSchema,
  CategoryFormValue,
  newCategoryFormValue,
} from '../../shared/ui/organisms/category-editor/category-editor.model';
import {
  CategoryGrid,
  CategoryGridItem,
} from '../../shared/ui/organisms/category-grid/category-grid';
import {
  CategoryList,
  CategoryListEntry,
} from '../../shared/ui/organisms/category-list/category-list';
import { NavRail } from '../../shared/ui/organisms/nav-rail/nav-rail';
import {
  NumberFormatForm,
  NumberFormatPreferences,
} from '../../shared/ui/organisms/number-format-form/number-format-form';
import {
  SpacePreferences,
  spacePreferencesSchema,
} from '../../shared/ui/organisms/space-preferences-form/space-preferences';
import { SpacePreferencesForm } from '../../shared/ui/organisms/space-preferences-form/space-preferences-form';
import {
  SubcategorySheet,
  SubcategorySheetData,
} from '../../shared/ui/organisms/subcategory-sheet/subcategory-sheet';
import { TagList, TagListEntry } from '../../shared/ui/organisms/tag-list/tag-list';
import { TagSheet, TagSheetData } from '../../shared/ui/organisms/tag-sheet/tag-sheet';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { WindowClass } from '../../shared/ui/services/window-class';
import { AppShell } from '../../shared/ui/templates/app-shell/app-shell';
import { AuthLayout } from '../../shared/ui/templates/auth-layout/auth-layout';
import { FlowLayout } from '../../shared/ui/templates/flow-layout/flow-layout';
import { ListDetailLayout } from '../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { WizardLayout } from '../../shared/ui/templates/wizard-layout/wizard-layout';
import { WizardStep } from '../../shared/ui/templates/wizard-step/wizard-step';
import { Checkbox } from '../../shared/ui/atoms/checkbox/checkbox';
import { StepProgress, StepProgressState } from '../../shared/ui/atoms/step-progress/step-progress';
import { WizardStepItem, WizardSteps } from '../../shared/ui/molecules/wizard-steps/wizard-steps';
import { BudgetList, BudgetListEntry } from '../../shared/ui/organisms/budget-list/budget-list';
import {
  CategoryChecklist,
  CategoryChecklistNode,
} from '../../shared/ui/organisms/category-checklist/category-checklist';
import { chooseAccountGroup } from '../accounts/account-group-chooser';
import { CatalogEntry } from './catalog-entry/catalog-entry';
import { FixedLayout } from './fixed-layout/fixed-layout';

interface WindowClassDemo {
  readonly value: WindowClass;
  readonly label: string;
  readonly description: string;
}

/** Development-only catalog of the design system: every component and variant, light and dark. */
@Component({
  selector: 'app-ui-catalog-page',
  imports: [
    DecimalField,
    AmountDisplay,
    ChipChoice,
    Keypad,
    PeriodChip,
    TransactionList,
    FormField,
    CatalogEntry,
    FixedLayout,
    Amount,
    Button,
    ColorSwatch,
    CurrencySelect,
    DateField,
    Donut,
    IconBadge,
    IconButton,
    Icon,
    Message,
    MoneyField,
    PasswordField,
    SegmentedControl,
    Select,
    Switch,
    Tabs,
    TextField,
    TitleField,
    AccountRow,
    AppearanceEditor,
    AppearancePicker,
    Brand,
    CategoryBubble,
    ChipSelect,
    ColorGrid,
    Disclosure,
    FieldRow,
    FlowHero,
    Form,
    FormActions,
    IconGrid,
    ListItem,
    NavItem,
    OverlayPanel,
    PageHeader,
    Section,
    BottomNav,
    NavRail,
    SpacePreferencesForm,
    NumberFormatForm,
    AccountList,
    AccountEditor,
    CategoryGrid,
    CategoryList,
    CategoryEditor,
    TagList,
    AppShell,
    AuthLayout,
    FlowLayout,
    ListDetailLayout,
    WizardLayout,
    WizardStep,
    Checkbox,
    StepProgress,
    WizardSteps,
    BudgetList,
    CategoryChecklist,
  ],
  templateUrl: './ui-catalog-page.html',
  styleUrl: './ui-catalog-page.scss',
})
export class UiCatalogPage {
  private readonly overlay = inject(OverlayService);

  protected readonly paths = APP_PATHS;
  protected readonly navItems = NAV_ITEMS;
  protected readonly currencies: readonly SelectOption<string>[] = [
    { value: 'COP', label: 'Peso colombiano (COP)' },
    { value: 'USD', label: 'Dólar estadounidense (USD)' },
  ];

  protected readonly groupedKinds: readonly SelectOption<string>[] = [
    { value: 'cash', label: 'Efectivo', group: 'Cuentas' },
    { value: 'bank', label: 'Banco', group: 'Cuentas' },
    { value: 'credit_card', label: 'Tarjeta de crédito', group: 'Deudas' },
  ];
  protected readonly kindOptions: readonly SegmentOption<string>[] = [
    { value: 'expense', label: 'Gastos' },
    { value: 'income', label: 'Ingresos' },
  ];
  protected readonly kindTabs: readonly TabOption<string>[] = [
    { value: 'expense', label: 'Gastos', icon: 'trending_down' },
    { value: 'income', label: 'Ingresos', icon: 'trending_up' },
  ];
  protected readonly kind = signal('expense');
  protected readonly moreOpen = signal(true);

  /** The templates that change with the window class, shown in each one (spec §13.5). */
  protected readonly shellClasses: readonly WindowClassDemo[] = [
    { value: 'compact', label: 'compacta', description: 'Navegación inferior' },
    { value: 'medium', label: 'mediana', description: 'Rail' },
    { value: 'expanded', label: 'expandida', description: 'Rail expandido' },
  ];
  protected readonly listDetailClasses: readonly WindowClassDemo[] = [
    { value: 'compact', label: 'compacta', description: 'Un panel a la vez' },
    { value: 'expanded', label: 'expandida', description: 'Lista y detalle lado a lado' },
  ];

  private readonly model = signal({
    empty: '',
    filled: 'ana@example.com',
    invalid: '',
    locked: 'Hogar',
    password: '',
    currency: 'COP',
    missingCurrency: '',
    accountKind: 'bank',
    decimals: true,
    budgets: false,
    lockedSwitch: true,
    balance: 123456790 as number | null,
    debt: null as number | null,
    badAmount: null as number | null,
    date: '2026-11-01',
    title: 'Tarjeta Visa',
    emptyTitle: '',
  });

  /** Fields for the control demos; the invalid ones start touched so their errors show. */
  protected readonly demo = form(this.model, (path) => {
    required(path.invalid, { message: 'Ingresa un correo.' });
    required(path.password, { message: 'Ingresa tu contraseña.' });
    required(path.missingCurrency, { message: 'Elige una moneda.' });
    required(path.badAmount, { message: 'Ingresa un monto.' });
    required(path.emptyTitle, { message: 'Ponle un nombre a la cuenta.' });
    disabled(path.locked);
    disabled(path.lockedSwitch);
  });

  protected readonly tagOptions: readonly ChipOption[] = [
    { value: 'fixed', label: 'Fijos', color: 'indigo' },
    { value: 'health', label: 'Salud', color: 'red' },
    { value: 'kids', label: 'Emiliano', color: 'sky' },
  ];
  private readonly pickersModel = signal<{
    icon: string;
    color: string | null;
    subIcon: string;
    subColor: string | null;
    tags: readonly string[];
    noTags: readonly string[];
  }>({
    icon: 'shopping_cart',
    color: 'green',
    subIcon: 'key',
    subColor: null,
    tags: ['fixed'],
    noTags: [],
  });
  /** Fields of the picker demos. */
  protected readonly pickers = form(this.pickersModel);

  protected readonly accountGroups: readonly AccountListGroup[] = [
    {
      id: 'accounts',
      label: 'Cuentas',
      totals: [{ currency: 'COP', amount: 264300000 }],
      accounts: [
        {
          id: 'a1',
          name: 'Efectivo',
          icon: 'payments',
          color: 'green',
          balance: 10000000,
          currency: 'COP',
        },
        {
          id: 'a2',
          name: 'Bancolombia',
          icon: 'account_balance',
          color: 'amber',
          balance: 254300000,
          currency: 'COP',
          notes: 'Predeterminada',
          selected: true,
        },
      ],
    },
    {
      id: 'savings',
      label: 'Ahorros',
      totals: [
        { currency: 'COP', amount: 50000000 },
        { currency: 'USD', amount: 120000 },
      ],
      accounts: [
        {
          id: 'a3',
          name: 'Caja menor',
          icon: 'savings',
          color: 'teal',
          balance: 50000000,
          currency: 'COP',
        },
        {
          id: 'a4',
          name: 'DollarApp',
          icon: 'currency_exchange',
          color: 'sky',
          balance: 120000,
          currency: 'USD',
        },
      ],
    },
    {
      id: 'debts',
      label: 'Deudas',
      totals: [{ currency: 'COP', amount: -185000000 }],
      accounts: [
        {
          id: 'a5',
          name: 'Tarjeta Visa',
          icon: 'credit_card',
          color: 'red',
          balance: -185000000,
          currency: 'COP',
          notes: 'Privada',
        },
      ],
    },
  ];
  protected readonly accountTotals: readonly CurrencyAmount[] = [
    { currency: 'COP', amount: 264300000 },
  ];
  protected readonly gridItems: readonly CategoryGridItem[] = [
    { id: 'c1', name: 'Hogar', icon: 'home', color: 'orange' },
    { id: 'c4', name: 'Mercado', icon: 'shopping_cart', color: 'green' },
    { id: 'c5', name: 'Transporte', icon: 'directions_car', color: 'blue' },
    { id: 'c6', name: 'Salud', icon: 'medical_services', color: 'red' },
    { id: 'c7', name: 'Ocio', icon: 'sports_esports', color: 'purple' },
    { id: 'c8', name: 'Mascotas', icon: 'pets', color: 'mustard' },
    { id: 'c9', name: 'Regalos', icon: 'redeem', color: 'pink' },
    { id: 'c10', name: 'Educación', icon: 'school', color: 'indigo' },
    { id: 'c11', name: 'Otros', icon: 'more_horiz', color: 'gray' },
  ];
  protected readonly gridItemsWithAmounts: readonly CategoryGridItem[] = [
    {
      id: 'c1',
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      amount: 180000000,
      remaining: 20000000,
      progress: 0.9,
    },
    {
      id: 'c4',
      name: 'Mercado',
      icon: 'shopping_cart',
      color: 'green',
      amount: 32050000,
      remaining: 87950000,
      progress: 0.27,
    },
    { id: 'c5', name: 'Transporte', icon: 'directions_car', color: 'blue', amount: 2500000 },
    {
      id: 'c7',
      name: 'Ocio',
      icon: 'sports_esports',
      color: 'purple',
      amount: 61000000,
      remaining: -11000000,
      progress: 1.22,
    },
    { id: 'c8', name: 'Mascotas', icon: 'pets', color: 'mustard', amount: 0 },
  ];
  protected readonly gridTotals = [
    { label: 'Gastos', amount: 275550000 },
    { label: 'Ingresos', amount: 650000000 },
  ];
  protected readonly donutSegments: readonly DonutSegment[] = [
    { value: 180000000, color: 'orange' },
    { value: 32050000, color: 'green' },
    { value: 61000000, color: 'purple' },
  ];
  protected readonly rateDemo = signal<number | null>(4150.25);
  protected readonly percentDemo = signal<number | null>(1.89);
  protected readonly chipChoice = signal<string | null>('c2');
  protected readonly subcategoryChips: readonly ChipOption[] = [
    { value: 'c1', label: 'Hogar' },
    { value: 'c2', label: 'Arriendo' },
    { value: 'c3', label: 'Servicios públicos' },
    { value: 'c12', label: 'Mantenimiento' },
    { value: 'c13', label: 'Aseo' },
  ];
  protected readonly transactionGroups: readonly TransactionListGroup[] = [
    {
      title: 'Hoy',
      items: [
        {
          id: 't1',
          title: 'Mercado',
          subtitle: 'Mercado de la semana',
          icon: 'shopping_cart',
          color: 'green',
          amount: -32050000,
          currency: 'COP',
          editable: true,
        },
        {
          id: 't2',
          title: 'Transferencia a DollarApp',
          icon: 'swap_horiz',
          color: null,
          amount: -41000000,
          currency: 'COP',
          editable: true,
        },
      ],
    },
    {
      title: 'Ayer',
      items: [
        {
          id: 't3',
          title: 'Salario',
          icon: 'work',
          color: 'teal',
          amount: 650000000,
          currency: 'COP',
          editable: true,
        },
        {
          id: 't4',
          title: 'Hogar › Arriendo',
          subtitle: 'Fijos · 3 cuotas',
          icon: 'key',
          color: 'orange',
          amount: -180000000,
          currency: 'COP',
          editable: false,
        },
      ],
    },
  ];
  protected readonly subcategoryEntries: readonly CategoryListEntry[] = [
    { id: 'c2', name: 'Arriendo', icon: 'key', color: 'orange', subtitle: 'Fijos' },
    { id: 'c3', name: 'Servicios públicos', icon: 'bolt', color: 'amber' },
  ];
  protected readonly archivedEntries: readonly CategoryListEntry[] = [
    {
      id: 'c12',
      name: 'Jardín',
      icon: 'yard',
      color: 'orange',
      subtitle: 'Archivada',
      muted: true,
    },
  ];
  protected readonly checklistNodes: readonly CategoryChecklistNode[] = [
    {
      id: 'c1',
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      children: [
        { id: 'c2', name: 'Arriendo', icon: 'key', color: null },
        { id: 'c3', name: 'Servicios públicos', icon: 'bolt', color: 'amber' },
      ],
    },
    { id: 'c9', name: 'Regalos', icon: 'redeem', color: 'pink', children: [] },
  ];
  protected readonly templateSelection = signal<readonly string[]>(['c1', 'c2', 'c3']);
  protected readonly tagSelection = signal<readonly string[]>(['c2']);
  protected readonly budgetEntries: readonly BudgetListEntry[] = [
    {
      id: 'c1',
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      amount: { currency: 'COP', amount: 300000000 },
    },
    { id: 'c4', name: 'Mercado', icon: 'shopping_cart', color: 'green', amount: null },
    {
      id: 'c7',
      name: 'Ocio',
      icon: 'sports_esports',
      color: 'purple',
      amount: { currency: 'USD', amount: 20000 },
    },
  ];
  protected readonly budgetTotals: readonly CurrencyAmount[] = [
    { currency: 'COP', amount: 300000000 },
    { currency: 'USD', amount: 20000 },
  ];
  protected readonly progressStates: readonly StepProgressState[] = [
    'done',
    'done',
    'current',
    'pending',
    'pending',
    'pending',
    'pending',
  ];
  protected readonly wizardSteps: readonly WizardStepItem[] = [
    { id: 'space', title: 'Tu espacio', state: 'done', link: ['/', APP_PATHS.uiCatalog] },
    {
      id: 'accounts',
      title: 'Tu situación actual',
      state: 'current',
      link: ['/', APP_PATHS.uiCatalog],
    },
    { id: 'income', title: 'Ingresos', state: 'available', link: ['/', APP_PATHS.uiCatalog] },
    {
      id: 'budget',
      title: 'Presupuesto',
      state: 'locked',
      note: 'Opcional',
      link: ['/', APP_PATHS.uiCatalog],
    },
  ];
  /** The wizard in each window class it changes with (spec §13.5). */
  protected readonly wizardClasses: readonly WindowClassDemo[] = [
    { value: 'compact', label: 'compacta', description: 'Un paso por pantalla, progreso arriba' },
    { value: 'expanded', label: 'expandida', description: 'Pasos en una columna lateral' },
  ];
  protected readonly tagEntries: readonly TagListEntry[] = [
    { id: 'fixed', name: 'Fijos', color: 'indigo', subtitle: 'Por defecto en 2 categorías' },
    { id: 'trips', name: 'Viajes', color: 'blue', subtitle: 'Archivada', archived: true },
  ];
  private readonly catalogFormsModel = signal<{
    account: AccountFormValue;
    category: CategoryFormValue;
  }>({
    account: {
      ...newAccountFormValue('COP', '2026-11-01', 'credit_card'),
      name: 'Tarjeta Visa',
      balance: 185000000,
    },
    category: {
      ...newCategoryFormValue('expense'),
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      tagIds: ['fixed'],
    },
  });
  /** Fields of the organism demos. */
  protected readonly catalogForms = form(this.catalogFormsModel, (path) => {
    apply(path.account, accountFormSchema);
    apply(path.category, categoryFormSchema);
  });

  private readonly preferencesModel = signal<{
    space: SpacePreferences;
    numberFormat: NumberFormatPreferences;
  }>({
    space: { name: 'Hogar', ...SPACE_DEFAULTS, monthStartDay: 28 },
    numberFormat: { ...NUMBER_FORMAT_DEFAULTS },
  });
  protected readonly preferencesDemo = form(this.preferencesModel, (path) => {
    apply(path.space, spacePreferencesSchema);
  });

  private readonly loginModel = signal({ email: 'ana@example.com', password: 'secreto-123' });
  protected readonly loginDemo = form(this.loginModel, (path) => {
    required(path.email);
  });

  constructor() {
    this.demo.invalid().markAsTouched();
    this.demo.password().markAsTouched();
    this.demo.missingCurrency().markAsTouched();
    this.demo.badAmount().markAsTouched();
    this.demo.emptyTitle().markAsTouched();
  }

  protected openOptions(): void {
    void chooseAccountGroup(this.overlay);
  }

  protected openBudgetAmount(): void {
    void this.overlay.open<AmountPanelResult, AmountPanelData>(AmountPanel, {
      label: 'Presupuesto de Hogar',
      autoFocus: 'input',
      data: {
        title: 'Presupuesto de Hogar',
        label: 'Presupuesto mensual',
        hint: 'Se repite cada mes hasta que lo cambies. Escribe 0 para quitarlo.',
        currency: 'COP',
        currencyEditable: true,
        value: 300000000,
        requiredMessage: 'Escribe el monto; puede ser 0.',
      },
    });
  }

  protected openAmount(): void {
    void this.overlay.open<AmountPanelResult, AmountPanelData>(AmountPanel, {
      label: 'Lo que debes',
      autoFocus: 'input',
      data: {
        title: 'Lo que debes',
        label: 'Lo que debes',
        hint: 'Escríbelo en positivo: la app lo cuenta como deuda.',
        currency: 'COP',
        value: 125000000,
        requiredMessage: 'Escribe el saldo; puede ser 0.',
      },
    });
  }

  protected openSubcategory(): void {
    void this.overlay.open<unknown, SubcategorySheetData>(SubcategorySheet, {
      label: 'Subcategoría',
      data: {
        title: 'Subcategoría',
        value: { ...newCategoryFormValue('expense', 'c1'), name: 'Arriendo', icon: 'key' },
        parents: [
          { id: 'c1', name: 'Hogar', color: 'orange' },
          { id: 'c4', name: 'Mercado', color: 'green' },
        ],
        tagOptions: this.tagOptions,
        actions: { archived: false, canDelete: true },
        save: async () => ACTION_OK,
      },
    });
  }

  protected openQuickEntry(type: QuickEntryValue['type']): void {
    const value: QuickEntryValue = {
      type,
      expression: type === 'adjustment' ? '5000' : '12000+3500',
      toExpression: '',
      categoryId: type === 'expense' ? 'c2' : null,
      accountId: 'a1',
      toAccountId: type === 'transfer' ? 'a3' : '',
      date: '2026-11-26',
      tagIds: type === 'expense' ? ['t1'] : [],
      note: '',
      includeInSpace: false,
      installments: 1,
      monthlyRatePercent: 0,
      adjustmentDirection: 'increase',
    };
    void this.overlay.open<unknown, QuickEntrySheetData>(QuickEntrySheet, {
      label: 'Registro rápido',
      size: 'entry',
      autoFocus: 'cc-amount-display .display',
      data: {
        mode: type === 'adjustment' ? 'edit' : 'create',
        title: type === 'expense' ? 'Hogar' : type === 'transfer' ? 'Transferencia' : 'Ajuste',
        accounts: [
          {
            id: 'a1',
            name: 'Bancolombia',
            currency: 'COP',
            isCard: false,
            isPrivate: false,
            includeInSpaceByDefault: false,
            group: 'Cuentas',
          },
          {
            id: 'a2',
            name: 'Nequi',
            currency: 'COP',
            isCard: false,
            isPrivate: true,
            includeInSpaceByDefault: true,
            group: 'Cuentas',
          },
          {
            id: 'a3',
            name: 'DollarApp',
            currency: 'USD',
            isCard: false,
            isPrivate: false,
            includeInSpaceByDefault: false,
            group: 'Ahorros',
          },
          {
            id: 'a4',
            name: 'Tarjeta Visa',
            currency: 'COP',
            isCard: true,
            isPrivate: false,
            includeInSpaceByDefault: false,
            group: 'Deudas',
          },
        ],
        category: type === 'expense' ? { id: 'c1', name: 'Hogar', defaultTagIds: [] } : null,
        subcategories:
          type === 'expense'
            ? [
                { id: 'c2', name: 'Arriendo', defaultTagIds: ['t1'] },
                { id: 'c3', name: 'Servicios públicos', defaultTagIds: [] },
              ]
            : [],
        tags: this.tagOptions,
        today: '2026-11-26',
        value,
        save: async () => ACTION_OK,
      },
    });
  }

  protected openPeriodPanel(): void {
    void this.overlay.open<unknown, PeriodPanelData>(PeriodPanel, {
      label: 'Periodo',
      data: {
        period: { kind: 'month', anchor: '2026-11-01' },
        settings: { monthStartDay: 1, weekStart: 'monday' },
        today: '2026-11-26',
      },
    });
  }

  protected openRate(): void {
    void this.overlay.open<unknown, ExchangeRateSheetData>(ExchangeRateSheet, {
      label: 'Tasa US$ → $',
      autoFocus: 'input',
      data: {
        title: 'Nueva tasa US$ → $',
        currency: 'USD',
        mainCurrency: 'COP',
        reason: 'Tienes cuentas en US$. Para sumarlas en los totales hace falta la tasa de cambio.',
        value: { date: '2026-11-26', rate: 4150.25 },
        save: async () => ACTION_OK,
      },
    });
  }

  protected openTag(): void {
    void this.overlay.open<unknown, TagSheetData>(TagSheet, {
      label: 'Etiqueta',
      data: {
        title: 'Etiqueta',
        value: { name: 'Fijos', color: 'indigo', categoryIds: ['c2'] },
        categories: [{ label: 'Gastos', nodes: this.checklistNodes }],
        actions: { archived: false, canDelete: true },
        save: async () => ACTION_OK,
      },
    });
  }
}
