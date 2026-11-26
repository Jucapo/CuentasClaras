import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { apply, disabled, form, FormField } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  NUMBER_FORMAT_DEFAULTS,
  SPACE_DEFAULTS,
  THEME_OPTIONS,
} from '../../core/config/space.constants';
import { APP_PATHS } from '../../core/routing/app-paths';
import { SpaceMembership, ThemePreference } from '../../core/spaces/space.models';
import { SpaceService } from '../../core/spaces/space.service';
import { UserSettingsService } from '../../core/user-settings/user-settings.service';
import { Button } from '../../shared/ui/atoms/button/button';
import { Select } from '../../shared/ui/atoms/select/select';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../shared/ui/molecules/form/form';
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
    Select,
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

  protected readonly canConfigure = this.spaces.canConfigure;
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly spaceError = signal<string | null>(null);
  protected readonly preferencesError = signal<string | null>(null);
  protected readonly signingOut = signal(false);

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
  private readonly spaceModel = linkedSignal(() => ({
    space: toSpacePreferences(this.spaces.active()),
  }));
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
    const { space } = this.spaceModel();
    const name = space.name.trim();
    if (name !== this.spaces.activeSpace()?.name) {
      const renamed = await this.spaces.renameActiveSpace(name);
      if (!renamed.ok) {
        this.spaceError.set(renamed.message);
        return;
      }
    }
    const saved = await this.spaces.updateActiveSettings({
      main_currency: space.mainCurrency,
      month_start_day: space.monthStartDay,
      week_start: space.weekStart,
    });
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
