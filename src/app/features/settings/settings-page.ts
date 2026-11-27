import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { apply, disabled, form, FormField } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  NUMBER_FORMAT_DEFAULTS,
  SPACE_APPEARANCE_DEFAULTS,
  SPACE_DEFAULTS,
  THEME_OPTIONS,
} from '../../core/config/space.constants';
import { pendingStepsText } from '../../core/onboarding/onboarding-texts';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { APP_PATHS, CATEGORY_PATHS, SETTINGS_PATHS } from '../../core/routing/app-paths';
import { SpaceMembership, ThemePreference } from '../../core/spaces/space.models';
import { SpaceService } from '../../core/spaces/space.service';
import { UserSettingsService } from '../../core/user-settings/user-settings.service';
import { Button } from '../../shared/ui/atoms/button/button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Select } from '../../shared/ui/atoms/select/select';
import { Switch } from '../../shared/ui/atoms/switch/switch';
import { AppearancePicker } from '../../shared/ui/molecules/appearance-picker/appearance-picker';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
import { ListItem } from '../../shared/ui/molecules/list-item/list-item';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import {
  NumberFormatForm,
  NumberFormatPreferences,
} from '../../shared/ui/organisms/number-format-form/number-format-form';
import {
  SpacePreferences,
  spacePreferencesSchema,
} from '../../shared/ui/organisms/space-preferences-form/space-preferences';
import { SpacePreferencesForm } from '../../shared/ui/organisms/space-preferences-form/space-preferences-form';
import { KeyboardShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { LayoutService } from '../../shared/ui/services/layout.service';
import { ToastService } from '../../shared/ui/services/toast.service';

interface UserPreferences {
  theme: ThemePreference;
  numberFormat: NumberFormatPreferences;
}

/** Settings of the active space (owner only), the user's preferences and the session. */
@Component({
  selector: 'app-settings-page',
  imports: [
    FormField,
    PageHeader,
    Section,
    Form,
    FormActions,
    Button,
    Icon,
    Select,
    AppearancePicker,
    Switch,
    ListItem,
    SpacePreferencesForm,
    NumberFormatForm,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly spaces = inject(SpaceService);
  private readonly userSettings = inject(UserSettingsService);
  private readonly toast = inject(ToastService);
  private readonly onboarding = inject(OnboardingService);
  protected readonly layout = inject(LayoutService);
  protected readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly canConfigure = this.spaces.canConfigure;
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly spaceError = signal<string | null>(null);
  protected readonly preferencesError = signal<string | null>(null);
  protected readonly signingOut = signal(false);
  protected readonly catalogLinks = {
    accounts: ['/', APP_PATHS.accounts],
    categories: ['/', APP_PATHS.categories, CATEGORY_PATHS.edit],
    tags: ['/', APP_PATHS.settings, SETTINGS_PATHS.tags],
    currencies: ['/', APP_PATHS.settings, SETTINGS_PATHS.currencies],
  };

  /** The setup wizard: complete it while pending, review it afterwards (spec §7). */
  protected readonly onboardingLink = ['/', APP_PATHS.welcome];
  protected readonly onboardingRow = computed(() =>
    this.onboarding.isComplete()
      ? {
          title: 'Revisar configuración inicial',
          subtitle: 'Vuelve a cualquier paso del asistente',
        }
      : {
          title: 'Completar configuración inicial',
          subtitle: pendingStepsText(this.onboarding.pendingSteps()),
        },
  );

  protected readonly spaceDescription = computed(() =>
    this.canConfigure()
      ? 'Aplica a todos los miembros del espacio.'
      : 'Solo el propietario puede cambiar la configuración del espacio.',
  );
  protected readonly sessionDescription = computed(() => {
    const email = this.auth.user()?.email;
    return email ? `Sesión iniciada como ${email}` : undefined;
  });

  // Follow the loaded values: a reload or a space switch replaces what is shown.
  private readonly spaceModel = linkedSignal(() => {
    const active = this.spaces.active();
    return {
      space: toSpacePreferences(active),
      icon: active?.space.icon ?? SPACE_APPEARANCE_DEFAULTS.icon,
      color: (active?.space.color ?? SPACE_APPEARANCE_DEFAULTS.color) as string | null,
    };
  });
  protected readonly spaceForm = form(
    this.spaceModel,
    (path) => {
      apply(path.space, spacePreferencesSchema);
      disabled(path, () => !this.canConfigure());
    },
    { submission: { action: () => this.saveSpace() } },
  );

  private readonly preferencesModel = linkedSignal<UserPreferences>(() => {
    const settings = this.userSettings.settings();
    return settings
      ? {
          theme: settings.theme,
          numberFormat: {
            numberFormat: settings.number_format,
            showDecimals: settings.show_decimals,
          },
        }
      : { theme: 'system', numberFormat: { ...NUMBER_FORMAT_DEFAULTS } };
  });
  protected readonly preferencesForm = form(this.preferencesModel, {
    submission: { action: () => this.savePreferences() },
  });

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigate(['/', APP_PATHS.login]);
    } finally {
      this.signingOut.set(false);
    }
  }

  private async saveSpace(): Promise<void> {
    this.spaceError.set(null);
    const { space, icon, color } = this.spaceModel();
    const saved = await this.spaces.saveActivePreferences(
      { name: space.name.trim(), icon, color: color ?? undefined },
      {
        main_currency: space.mainCurrency,
        month_start_day: space.monthStartDay,
        week_start: space.weekStart,
      },
    );
    if (!saved.ok) {
      this.spaceError.set(saved.message);
      return;
    }
    void this.toast.show('Espacio guardado.');
  }

  private async savePreferences(): Promise<void> {
    this.preferencesError.set(null);
    const { theme, numberFormat } = this.preferencesModel();
    const saved = await this.userSettings.update({
      theme,
      number_format: numberFormat.numberFormat,
      show_decimals: numberFormat.showDecimals,
    });
    if (!saved.ok) {
      this.preferencesError.set(saved.message);
      return;
    }
    void this.toast.show('Preferencias guardadas.');
  }
}

function toSpacePreferences(membership: SpaceMembership | null): SpacePreferences {
  if (!membership) {
    return { name: '', ...SPACE_DEFAULTS };
  }
  return {
    name: membership.space.name,
    mainCurrency: membership.settings.main_currency,
    monthStartDay: membership.settings.month_start_day,
    weekStart: membership.settings.week_start,
  };
}
