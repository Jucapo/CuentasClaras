import { Component, signal } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NAV_ITEMS } from '../../core/layout/nav-items';
import { APP_PATHS } from '../../core/routing/app-paths';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import { PasswordField } from '../../shared/ui/atoms/password-field/password-field';
import { Select, SelectOption } from '../../shared/ui/atoms/select/select';
import { Switch } from '../../shared/ui/atoms/switch/switch';
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
import { Brand } from '../../shared/ui/molecules/brand/brand';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
import { NavItem } from '../../shared/ui/molecules/nav-item/nav-item';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { BottomNav } from '../../shared/ui/organisms/bottom-nav/bottom-nav';
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
    Button,
    IconButton,
    Icon,
    Message,
    PasswordField,
    Select,
    Switch,
    TextField,
    Brand,
    Form,
    FormActions,
    NavItem,
    PageHeader,
    Section,
    BottomNav,
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

  private readonly model = signal({
    empty: '',
    filled: 'ana@example.com',
    invalid: '',
    locked: 'Hogar',
    password: '',
    currency: 'COP',
    missingCurrency: '',
    decimals: true,
    budgets: false,
    lockedSwitch: true,
  });

  /** Fields for the control demos; the invalid ones start touched so their errors show. */
  protected readonly demo = form(this.model, (path) => {
    required(path.invalid, { message: 'Ingresa un correo.' });
    required(path.password, { message: 'Ingresa tu contraseña.' });
    required(path.missingCurrency, { message: 'Elige una moneda.' });
    disabled(path.locked);
    disabled(path.lockedSwitch);
  });

  private readonly loginModel = signal({ email: 'ana@example.com', password: 'secreto-123' });
  protected readonly loginDemo = form(this.loginModel, (path) => {
    required(path.email);
  });

  constructor() {
    this.demo.invalid().markAsTouched();
    this.demo.password().markAsTouched();
    this.demo.missingCurrency().markAsTouched();
  }
}
