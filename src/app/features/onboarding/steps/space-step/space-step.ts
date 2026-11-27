import { Component, computed, inject, signal } from '@angular/core';
import { apply, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { NUMBER_FORMAT_DEFAULTS, SPACE_DEFAULTS } from '../../../../core/config/space.constants';
import { OnboardingService } from '../../../../core/onboarding/onboarding.service';
import { nextStepUrl, ONBOARDING_STEPS } from '../../../../core/onboarding/onboarding-steps';
import { SpaceService } from '../../../../core/spaces/space.service';
import { UserSettingsService } from '../../../../core/user-settings/user-settings.service';
import { Form } from '../../../../shared/ui/molecules/form/form';
import {
  NumberFormatForm,
  NumberFormatPreferences,
} from '../../../../shared/ui/organisms/number-format-form/number-format-form';
import {
  SpacePreferences,
  spacePreferencesSchema,
} from '../../../../shared/ui/organisms/space-preferences-form/space-preferences';
import { SpacePreferencesForm } from '../../../../shared/ui/organisms/space-preferences-form/space-preferences-form';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { StepActions } from '../../step-actions/step-actions';

interface SpaceStepModel {
  space: SpacePreferences;
  numberFormat: NumberFormatPreferences;
}

/**
 * Wizard step 1: creates the space and saves the user's number format; once the space exists
 * (resuming or reviewing) it saves changes to it instead.
 */
@Component({
  selector: 'app-space-step',
  imports: [Form, WizardStep, StepActions, SpacePreferencesForm, NumberFormatForm],
  templateUrl: './space-step.html',
})
export class SpaceStep {
  private readonly spaces = inject(SpaceService);
  private readonly userSettings = inject(UserSettingsService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  protected readonly step = ONBOARDING_STEPS[0];
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly editing = computed(() => this.spaces.hasSpace());
  protected readonly busyLabel = computed(() =>
    this.editing() ? 'Guardando' : 'Creando el espacio',
  );

  private readonly model = signal<SpaceStepModel>({
    space: this.initialSpace(),
    numberFormat: this.initialNumberFormat(),
  });

  protected readonly stepForm = form(
    this.model,
    (path) => {
      apply(path.space, spacePreferencesSchema);
    },
    { submission: { action: () => this.save() } },
  );

  // Order matters: the idempotent save goes first, so a retry after a failure never creates a
  // second space; the space is created last and records the step as completed.
  private async save(): Promise<void> {
    this.errorMessage.set(null);
    const { space, numberFormat } = this.model();

    const saved = await this.userSettings.update({
      number_format: numberFormat.numberFormat,
      show_decimals: numberFormat.showDecimals,
    });
    if (!saved.ok) {
      this.errorMessage.set(saved.message);
      return;
    }

    const result = this.editing()
      ? await this.spaces.saveActivePreferences(
          { name: space.name.trim() },
          {
            main_currency: space.mainCurrency,
            month_start_day: space.monthStartDay,
            week_start: space.weekStart,
          },
        )
      : await this.spaces.createSpace({
          name: space.name.trim(),
          mainCurrency: space.mainCurrency,
          monthStartDay: space.monthStartDay,
          weekStart: space.weekStart,
        });
    if (!result.ok) {
      this.errorMessage.set(result.message);
      return;
    }

    const completed = await this.onboarding.completeStep('space');
    if (!completed.ok) {
      this.errorMessage.set(completed.message);
      return;
    }
    await this.router.navigateByUrl(nextStepUrl('space'));
  }

  private initialSpace(): SpacePreferences {
    const space = this.spaces.activeSpace();
    const settings = this.spaces.activeSettings();
    return space && settings
      ? {
          name: space.name,
          mainCurrency: settings.main_currency,
          monthStartDay: settings.month_start_day,
          weekStart: settings.week_start,
        }
      : { name: '', ...SPACE_DEFAULTS };
  }

  private initialNumberFormat(): NumberFormatPreferences {
    const settings = this.userSettings.settings();
    return settings
      ? { numberFormat: settings.number_format, showDecimals: settings.show_decimals }
      : { ...NUMBER_FORMAT_DEFAULTS };
  }
}
