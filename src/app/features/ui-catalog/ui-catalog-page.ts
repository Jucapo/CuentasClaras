import { Component, inject, signal } from '@angular/core';
import { apply, disabled, form, FormField, required } from '@angular/forms/signals';
import { ACTION_OK } from '../../core/action-result';
import { ACCOUNT_GROUP_CHOICES } from '../../core/config/catalog.constants';
import { NUMBER_FORMAT_DEFAULTS, SPACE_DEFAULTS } from '../../core/config/space.constants';
import { NAV_ITEMS } from '../../core/layout/nav-items';
import { APP_PATHS } from '../../core/routing/app-paths';
import { CurrencyAmount } from '../../domain/money/money';
import { Amount } from '../../shared/ui/atoms/amount/amount';
import { Button } from '../../shared/ui/atoms/button/button';
import { ColorSwatch } from '../../shared/ui/atoms/color-swatch/color-swatch';
import { CurrencySelect } from '../../shared/ui/atoms/currency-select/currency-select';
import { DateField } from '../../shared/ui/atoms/date-field/date-field';
import { Donut } from '../../shared/ui/atoms/donut/donut';
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
import { AmountPanel, AmountPanelData } from '../../shared/ui/molecules/amount-panel/amount-panel';
import { AppearanceEditor } from '../../shared/ui/molecules/appearance-editor/appearance-editor';
import { AppearancePicker } from '../../shared/ui/molecules/appearance-picker/appearance-picker';
import { Brand } from '../../shared/ui/molecules/brand/brand';
import { CategoryBubble } from '../../shared/ui/molecules/category-bubble/category-bubble';
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
import { OptionPanel, OptionPanelData } from '../../shared/ui/molecules/option-panel/option-panel';
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
    const groups = Object.values(ACCOUNT_GROUP_CHOICES);
    void this.overlay.open<string, OptionPanelData<string>>(OptionPanel, {
      label: '¿Qué vas a crear?',
      data: {
        title: '¿Qué vas a crear?',
        mode: 'action',
        prominent: true,
        options: groups.map((choice) => ({
          value: choice.param,
          label: choice.label,
          description: choice.example,
          icon: choice.icon,
          color: choice.color,
        })),
      },
    });
  }

  protected openAmount(): void {
    void this.overlay.open<number, AmountPanelData>(AmountPanel, {
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

  protected openTag(): void {
    void this.overlay.open<unknown, TagSheetData>(TagSheet, {
      label: 'Nueva etiqueta',
      autoFocus: 'input',
      data: {
        title: 'Nueva etiqueta',
        value: { name: '', color: 'indigo' },
        save: async () => ACTION_OK,
      },
    });
  }
}
