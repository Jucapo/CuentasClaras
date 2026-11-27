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
import { MEMBER_ROLE_LABELS } from '../../../../core/config/member.constants';
import { ReceivedInvitation } from '../../../../core/invitations/invitation.models';
import { InvitationsService } from '../../../../core/invitations/invitations.service';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { InvitationCard } from '../../../../shared/ui/molecules/invitation-card/invitation-card';
import { Section } from '../../../../shared/ui/molecules/section/section';
import { ConfirmService } from '../../../../shared/ui/services/confirm.service';
import { ToastService } from '../../../../shared/ui/services/toast.service';
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
  imports: [
    Form,
    WizardStep,
    StepActions,
    SpacePreferencesForm,
    NumberFormatForm,
    Section,
    InvitationCard,
    Button,
    Message,
  ],
  templateUrl: './space-step.html',
  styleUrl: './space-step.scss',
})
export class SpaceStep {
  private readonly spaces = inject(SpaceService);
  private readonly userSettings = inject(UserSettingsService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly invitationsService = inject(InvitationsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly step = ONBOARDING_STEPS[0];
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly editing = computed(() => this.spaces.hasSpace());

  /** Without a space, a pending invitation is offered next to creating one (spec §3.3). */
  protected readonly invitations = computed(() =>
    this.editing() ? [] : this.invitationsService.mine(),
  );
  protected readonly roleLabels = MEMBER_ROLE_LABELS;
  protected readonly answering = signal<string | null>(null);
  protected readonly invitationError = signal<string | null>(null);

  protected async accept(invitation: ReceivedInvitation): Promise<void> {
    this.invitationError.set(null);
    this.answering.set(invitation.id);
    const result = await this.invitationsService.accept({ invitationId: invitation.id });
    this.answering.set(null);
    if (!result.ok) {
      this.invitationError.set(result.message);
      return;
    }
    void this.toast.show(`Ya eres parte de ${invitation.spaceName}.`);
    await this.router.navigateByUrl('/');
  }

  protected async decline(invitation: ReceivedInvitation): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Rechazar la invitación a ${invitation.spaceName}?`,
      message: 'Si cambias de opinión, pide que te inviten de nuevo.',
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.invitationError.set(null);
    this.answering.set(invitation.id);
    const result = await this.invitationsService.decline({ invitationId: invitation.id });
    this.answering.set(null);
    if (!result.ok) {
      this.invitationError.set(result.message);
    }
  }
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
