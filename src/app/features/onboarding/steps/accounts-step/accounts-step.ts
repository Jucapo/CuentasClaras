import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsService } from '../../../../core/accounts/accounts.service';
import { ACCOUNT_GROUP_LABELS } from '../../../../core/config/catalog.constants';
import { SPACE_DEFAULTS } from '../../../../core/config/space.constants';
import { ONBOARDING_STEPS, stepUrl } from '../../../../core/onboarding/onboarding-steps';
import { NEW_ITEM_PATH } from '../../../../core/routing/app-paths';
import { SpaceService } from '../../../../core/spaces/space.service';
import { ACCOUNT_KIND_GROUP, accountsTotal } from '../../../../domain/accounts/account-kinds';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { FieldRow } from '../../../../shared/ui/molecules/field-row/field-row';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import {
  OptionPanel,
  OptionPanelData,
} from '../../../../shared/ui/molecules/option-panel/option-panel';
import { Section } from '../../../../shared/ui/molecules/section/section';
import { AccountList } from '../../../../shared/ui/organisms/account-list/account-list';
import { useShortcuts } from '../../../../shared/ui/services/keyboard-shortcuts';
import { OverlayService } from '../../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../../shared/ui/services/toast.service';
import { WizardStep } from '../../../../shared/ui/templates/wizard-step/wizard-step';
import { chooseAccountGroup, newAccountQueryParams } from '../../../accounts/account-group-chooser';
import { toAccountListGroups } from '../../../accounts/account-list-groups';
import { StepActions } from '../../step-actions/step-actions';

/** Value of the "no default account" option. */
const NO_DEFAULT = '';

/**
 * Wizard step 2, the current financial situation: accounts, savings, debts and receivables with
 * today's balance, created and edited with the account screens of the app, then the default one.
 */
@Component({
  selector: 'app-accounts-step',
  imports: [WizardStep, StepActions, AccountList, Section, FormActions, FieldRow, Button, Message],
  templateUrl: './accounts-step.html',
})
export class AccountsStep {
  private readonly accounts = inject(AccountsService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly step = ONBOARDING_STEPS[1];
  protected readonly loadError = this.accounts.loadError;
  private readonly stepLink = stepUrl(this.step.id);

  private readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );
  private readonly active = computed(() =>
    this.accounts.accounts().filter((account) => !account.archived_at),
  );
  protected readonly isEmpty = computed(() => this.accounts.loaded() && this.active().length === 0);
  protected readonly totals = computed(() => accountsTotal(this.active(), this.mainCurrency()));
  protected readonly groups = computed(() =>
    toAccountListGroups(this.active(), {
      mainCurrency: this.mainCurrency(),
      defaultAccountId: this.spaces.defaultAccountId(),
      linkFor: (id) => [this.stepLink, id],
    }),
  );
  protected readonly defaultName = computed(() => {
    const id = this.spaces.defaultAccountId();
    return this.active().find((account) => account.id === id)?.name ?? 'Ninguna';
  });

  constructor() {
    useShortcuts({ n: () => void this.add() });
  }

  /** "¿Qué vas a crear?", then the account screen; saving it comes back here. */
  protected async add(): Promise<void> {
    const group = await chooseAccountGroup(this.overlay);
    if (group) {
      await this.router.navigate([this.stepLink, NEW_ITEM_PATH], {
        queryParams: newAccountQueryParams(group),
      });
    }
  }

  protected async pickDefault(): Promise<void> {
    const picked = await this.overlay.open<string, OptionPanelData<string>>(OptionPanel, {
      label: 'Cuenta predeterminada',
      data: {
        title: 'Cuenta predeterminada',
        mode: 'single',
        selected: this.spaces.defaultAccountId() ?? NO_DEFAULT,
        options: [
          { value: NO_DEFAULT, label: 'Ninguna', icon: 'close', color: 'gray' },
          ...this.active().map((account) => ({
            value: account.id,
            label: account.name,
            icon: account.icon,
            color: account.color,
            group: ACCOUNT_GROUP_LABELS[ACCOUNT_KIND_GROUP[account.kind]],
          })),
        ],
      },
    });
    if (picked === undefined || picked === (this.spaces.defaultAccountId() ?? NO_DEFAULT)) {
      return;
    }
    const saved = await this.spaces.setDefaultAccount(picked || null);
    void this.toast.show(saved.ok ? 'Cuenta predeterminada guardada.' : saved.message);
  }
}
