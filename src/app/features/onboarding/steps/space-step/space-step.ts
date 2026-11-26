import { Component, inject, signal } from '@angular/core';
import { apply, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { NUMBER_FORMAT_DEFAULTS, SPACE_DEFAULTS } from '../../../../core/config/space.constants';
import { SpaceService } from '../../../../core/spaces/space.service';
import { UserSettingsService } from '../../../../core/user-settings/user-settings.service';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import {
  NumberFormatForm,
  NumberFormatPreferences,
} from '../../../../shared/ui/organisms/number-format-form/number-format-form';
import {
  SpacePreferences,
  spacePreferencesSchema,
} from '../../../../shared/ui/organisms/space-preferences-form/space-preferences';
import { SpacePreferencesForm } from '../../../../shared/ui/organisms/space-preferences-form/space-preferences-form';
import { nextStepUrl } from '../../onboarding-steps';

interface SpaceStepModel {
  space: SpacePreferences;
  numberFormat: NumberFormatPreferences;
}

/** Wizard step 1: creates the space and saves the user's number format. */
@Component({
  selector: 'app-space-step',
  imports: [PageHeader, Form, FormActions, Button, SpacePreferencesForm, NumberFormatForm],
  templateUrl: './space-step.html',
})
export class SpaceStep {
  private readonly spaces = inject(SpaceService);
  private readonly userSettings = inject(UserSettingsService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal<SpaceStepModel>({
    space: { name: '', ...SPACE_DEFAULTS },
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

    const created = await this.spaces.createSpace({
      name: space.name.trim(),
      mainCurrency: space.mainCurrency,
      monthStartDay: space.monthStartDay,
      weekStart: space.weekStart,
    });
    if (!created.ok) {
      this.errorMessage.set(created.message);
      return;
    }

    await this.router.navigateByUrl(nextStepUrl('space'));
  }

  private initialNumberFormat(): NumberFormatPreferences {
    const settings = this.userSettings.settings();
    return settings
      ? { numberFormat: settings.number_format, showDecimals: settings.show_decimals }
      : { ...NUMBER_FORMAT_DEFAULTS };
  }
}
