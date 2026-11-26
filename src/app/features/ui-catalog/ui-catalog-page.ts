import { Component, signal } from '@angular/core';
import { apply, disabled, form, FormField, required } from '@angular/forms/signals';
import { NUMBER_FORMAT_DEFAULTS, SPACE_DEFAULTS } from '../../core/config/space.constants';
import { NAV_ITEMS } from '../../core/layout/nav-items';
import { APP_PATHS } from '../../core/routing/app-paths';
import { Amount } from '../../shared/ui/atoms/amount/amount';
import { Button } from '../../shared/ui/atoms/button/button';
import { ColorSwatch } from '../../shared/ui/atoms/color-swatch/color-swatch';
import { CurrencySelect } from '../../shared/ui/atoms/currency-select/currency-select';
import { DateField } from '../../shared/ui/atoms/date-field/date-field';
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
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
import { AccountRow } from '../../shared/ui/molecules/account-row/account-row';
import { Brand } from '../../shared/ui/molecules/brand/brand';
import { ChipOption, ChipSelect } from '../../shared/ui/molecules/chip-select/chip-select';
import { ColorPicker } from '../../shared/ui/molecules/color-picker/color-picker';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
import { IconPicker } from '../../shared/ui/molecules/icon-picker/icon-picker';
import { ListItem } from '../../shared/ui/molecules/list-item/list-item';
import { NavItem } from '../../shared/ui/molecules/nav-item/nav-item';
import { OverlayPanel } from '../../shared/ui/molecules/overlay-panel/overlay-panel';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { CurrencyAmount } from '../../domain/money/money';
import { AccountForm } from '../../shared/ui/organisms/account-form/account-form';
import {
  accountFormSchema,
  AccountFormValue,
  newAccountFormValue,
} from '../../shared/ui/organisms/account-form/account-form.model';
import { AccountList, AccountListGroup } from '../../shared/ui/organisms/account-list/account-list';
import { BottomNav } from '../../shared/ui/organisms/bottom-nav/bottom-nav';
import {
  CategoryForm,
  ParentCategoryOption,
} from '../../shared/ui/organisms/category-form/category-form';
import {
  categoryFormSchema,
  CategoryFormValue,
  newCategoryFormValue,
} from '../../shared/ui/organisms/category-form/category-form.model';
import {
  CategoryList,
  CategoryListNode,
} from '../../shared/ui/organisms/category-list/category-list';
import { TagForm } from '../../shared/ui/organisms/tag-form/tag-form';
import { tagFormSchema, TagFormValue } from '../../shared/ui/organisms/tag-form/tag-form.model';
import { TagList, TagListEntry } from '../../shared/ui/organisms/tag-list/tag-list';
import {
  NumberFormatForm,
  NumberFormatPreferences,
} from '../../shared/ui/organisms/number-format-form/number-format-form';
import {
  SpacePreferences,
  spacePreferencesSchema,
} from '../../shared/ui/organisms/space-preferences-form/space-preferences';
import { SpacePreferencesForm } from '../../shared/ui/organisms/space-preferences-form/space-preferences-form';
import { AppShell } from '../../shared/ui/templates/app-shell/app-shell';
import { AuthLayout } from '../../shared/ui/templates/auth-layout/auth-layout';
import { WizardLayout } from '../../shared/ui/templates/wizard-layout/wizard-layout';
import { CatalogEntry } from './catalog-entry/catalog-entry';

/** Development-only catalog of the design system: every component and variant, light and dark. */
@Component({
  selector: 'app-ui-catalog-page',
  imports: [
    FormField,
    CatalogEntry,
    Amount,
    Button,
    ColorSwatch,
    CurrencySelect,
    DateField,
    IconBadge,
    IconButton,
    Icon,
    Message,
    MoneyField,
    PasswordField,
    SegmentedControl,
    Select,
    Switch,
    TextField,
    AccountRow,
    Brand,
    ChipSelect,
    ColorPicker,
    Form,
    FormActions,
    IconPicker,
    ListItem,
    NavItem,
    OverlayPanel,
    PageHeader,
    Section,
    BottomNav,
    SpacePreferencesForm,
    NumberFormatForm,
    AccountList,
    AccountForm,
    CategoryList,
    CategoryForm,
    TagList,
    TagForm,
    AppShell,
    AuthLayout,
    WizardLayout,
  ],
  templateUrl: './ui-catalog-page.html',
  styleUrl: './ui-catalog-page.scss',
})
export class UiCatalogPage {
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
  protected readonly kind = signal('expense');

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
  });

  /** Fields for the control demos; the invalid ones start touched so their errors show. */
  protected readonly demo = form(this.model, (path) => {
    required(path.invalid, { message: 'Ingresa un correo.' });
    required(path.password, { message: 'Ingresa tu contraseña.' });
    required(path.missingCurrency, { message: 'Elige una moneda.' });
    required(path.badAmount, { message: 'Ingresa un monto.' });
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
    subColor: string | null;
    tags: readonly string[];
    noTags: readonly string[];
  }>({ icon: 'shopping_cart', color: 'green', subColor: null, tags: ['fixed'], noTags: [] });
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
  protected readonly categoryNodes: readonly CategoryListNode[] = [
    {
      id: 'c1',
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      children: [
        { id: 'c2', name: 'Arriendo', icon: 'key', color: 'orange', subtitle: 'Fijos' },
        { id: 'c3', name: 'Servicios públicos', icon: 'bolt', color: 'amber' },
      ],
      addChildLink: ['/', APP_PATHS.uiCatalog],
    },
    { id: 'c4', name: 'Mercado', icon: 'shopping_cart', color: 'green', children: [] },
  ];
  protected readonly parentCategories: readonly ParentCategoryOption[] = [
    { id: 'c1', name: 'Hogar', kind: 'expense', color: 'orange' },
    { id: 'c4', name: 'Mercado', kind: 'expense', color: 'green' },
  ];
  protected readonly tagEntries: readonly TagListEntry[] = [
    { id: 'fixed', name: 'Fijos', color: 'indigo', subtitle: 'Por defecto en 2 categorías' },
    { id: 'trips', name: 'Viajes', color: 'blue', subtitle: 'Archivada', archived: true },
  ];
  private readonly catalogFormsModel = signal<{
    account: AccountFormValue;
    category: CategoryFormValue;
    tag: TagFormValue;
  }>({
    account: {
      ...newAccountFormValue('COP', '2026-11-01', 'credit_card'),
      name: 'Tarjeta Visa',
      balance: 185000000,
    },
    category: {
      ...newCategoryFormValue('expense', 'c1'),
      name: 'Arriendo',
      icon: 'key',
      tagIds: ['fixed'],
    },
    tag: { name: 'Fijos', color: 'indigo' },
  });
  /** Fields of the organism form demos. */
  protected readonly catalogForms = form(this.catalogFormsModel, (path) => {
    apply(path.account, accountFormSchema);
    apply(path.category, categoryFormSchema);
    apply(path.tag, tagFormSchema);
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
  }
}
