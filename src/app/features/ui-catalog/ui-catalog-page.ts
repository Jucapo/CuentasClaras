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
import { BottomNav } from '../../shared/ui/organisms/bottom-nav/bottom-nav';
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
