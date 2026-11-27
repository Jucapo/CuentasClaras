import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  apply,
  disabled,
  form,
  FormField,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import {
  DEFAULT_PERIOD_OPTIONS,
  DISPLAY_NAME_MAX_LENGTH,
  HOME_SCREEN_OPTIONS,
  NUMBER_FORMAT_DEFAULTS,
  SPACE_APPEARANCE_DEFAULTS,
  SPACE_DEFAULTS,
} from '../../core/config/space.constants';
import { pendingStepsText } from '../../core/onboarding/onboarding-texts';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { ProfileService } from '../../core/profiles/profile.service';
import { APP_PATHS, CATEGORY_PATHS, SETTINGS_PATHS } from '../../core/routing/app-paths';
import { BackNavigation } from '../../core/routing/back-navigation';
import { SpaceMembership } from '../../core/spaces/space.models';
import { SpaceMembersService } from '../../core/spaces/space-members.service';
import { SpaceService } from '../../core/spaces/space.service';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { Enums } from '../../core/supabase/database.types';
import { UserSettingsService } from '../../core/user-settings/user-settings.service';
import { Button } from '../../shared/ui/atoms/button/button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Select } from '../../shared/ui/atoms/select/select';
import { Switch } from '../../shared/ui/atoms/switch/switch';
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
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
  homeScreen: Enums<'home_screen'>;
  numberFormat: NumberFormatPreferences;
}

/** Validation messages of the profile. */
const PROFILE_MESSAGES = {
  nameRequired: 'Escribe tu nombre.',
  nameTooLong: `Usa máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
} as const;

/**
 * Configuración (spec §7), a subscreen opened from the menu: first the user (profile and
 * preferences), then the active space (preferences, owner only; members; setup wizard) and its
 * catalogs. The theme and signing out are in the menu.
 */
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
    TextField,
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
  private readonly spaces = inject(SpaceService);
  private readonly userSettings = inject(UserSettingsService);
  private readonly toast = inject(ToastService);
  private readonly onboarding = inject(OnboardingService);
  private readonly profiles = inject(ProfileService);
  private readonly members = inject(SpaceMembersService);
  private readonly invitations = inject(InvitationsService);
  private readonly back = inject(BackNavigation);
  protected readonly layout = inject(LayoutService);
  protected readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly canConfigure = this.spaces.canConfigure;
  protected readonly homeScreenOptions = HOME_SCREEN_OPTIONS;
  protected readonly defaultPeriodOptions = DEFAULT_PERIOD_OPTIONS;
  protected readonly spaceError = signal<string | null>(null);
  protected readonly preferencesError = signal<string | null>(null);
  protected readonly profileError = signal<string | null>(null);
  protected readonly catalogLinks = {
    accounts: ['/', APP_PATHS.accounts],
    categories: ['/', APP_PATHS.categories, CATEGORY_PATHS.edit],
    tags: ['/', APP_PATHS.settings, SETTINGS_PATHS.tags],
    currencies: ['/', APP_PATHS.settings, SETTINGS_PATHS.currencies],
  };

  /** The setup wizard: complete it while pending, review it afterwards (spec §7). */
  protected readonly onboardingLink = ['/', APP_PATHS.welcome];

  /** Configuración → Miembros, with how many members and pending invitations (spec §7). */
  protected readonly membersLink = ['/', APP_PATHS.settings, SETTINGS_PATHS.members];
  protected readonly membersSummary = computed(() => {
    const members = this.members.members().length;
    const pending = this.invitations.pending().length;
    const membersText = `${members} ${members === 1 ? 'miembro' : 'miembros'}`;
    return pending === 0
      ? membersText
      : `${membersText} · ${pending} ${pending === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}`;
  });
  protected readonly onboardingRow = computed(() =>
    this.onboarding.isComplete()
      ? { title: 'Revisar configuración inicial', subtitle: undefined }
      : {
          title: 'Completar configuración inicial',
          subtitle: pendingStepsText(this.onboarding.pendingSteps()),
        },
  );

  /** Only to those who cannot change it: it explains why the fields are locked. */
  protected readonly spaceDescription = computed(() =>
    this.canConfigure() ? undefined : 'Solo el propietario puede cambiar la configuración del espacio.',
  );

  // Follow the loaded values: a reload or a space switch replaces what is shown.
  private readonly profileModel = linkedSignal(() => ({
    displayName: this.profiles.profile()?.display_name ?? '',
  }));
  protected readonly profileForm = form(
    this.profileModel,
    (path) => {
      required(path.displayName, { message: PROFILE_MESSAGES.nameRequired });
      // Only spaces counts as empty too; `required` covers the empty field.
      validate(path.displayName, ({ value }) =>
        value() && !value().trim()
          ? { kind: 'blank', message: PROFILE_MESSAGES.nameRequired }
          : undefined,
      );
      maxLength(path.displayName, DISPLAY_NAME_MAX_LENGTH, {
        message: PROFILE_MESSAGES.nameTooLong,
      });
    },
    { submission: { action: () => this.saveProfile() } },
  );

  private readonly spaceModel = linkedSignal(() => {
    const active = this.spaces.active();
    return {
      space: toSpacePreferences(active),
      icon: active?.space.icon ?? SPACE_APPEARANCE_DEFAULTS.icon,
      color: (active?.space.color ?? SPACE_APPEARANCE_DEFAULTS.color) as string | null,
      defaultPeriod: active?.settings.default_period ?? 'month',
      budgetsEnabled: active?.settings.budgets_enabled ?? true,
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
          homeScreen: settings.home_screen,
          numberFormat: {
            numberFormat: settings.number_format,
            showDecimals: settings.show_decimals,
          },
        }
      : { homeScreen: 'categories', numberFormat: { ...NUMBER_FORMAT_DEFAULTS } };
  });
  protected readonly preferencesForm = form(this.preferencesModel, {
    submission: { action: () => this.savePreferences() },
  });

  /** ← goes back to where Configuración was opened from (the menu of any screen). */
  protected goBack(): void {
    this.back.back(['/']);
  }

  private async saveProfile(): Promise<void> {
    this.profileError.set(null);
    const saved = await this.profiles.updateDisplayName(this.profileModel().displayName);
    if (!saved.ok) {
      this.profileError.set(saved.message);
      return;
    }
    void this.toast.show('Perfil guardado.');
  }

  private async saveSpace(): Promise<void> {
    this.spaceError.set(null);
    const { space, icon, color, defaultPeriod, budgetsEnabled } = this.spaceModel();
    const saved = await this.spaces.saveActivePreferences(
      { name: space.name.trim(), icon, color: color ?? undefined },
      {
        main_currency: space.mainCurrency,
        month_start_day: space.monthStartDay,
        week_start: space.weekStart,
        default_period: defaultPeriod,
        budgets_enabled: budgetsEnabled,
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
    const { homeScreen, numberFormat } = this.preferencesModel();
    const saved = await this.userSettings.update({
      home_screen: homeScreen,
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
