import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Period } from '../../../domain/periods/periods';
import { currencySymbol } from '../../../domain/money/currencies';
import { formatMoney } from '../../../domain/money/money';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { PeriodChip } from '../../../shared/ui/molecules/period-chip/period-chip';
import { MONEY_FORMAT } from '../../../shared/ui/money/money-format';
import {
  PeriodPanel,
  PeriodPanelData,
} from '../../../shared/ui/organisms/period-panel/period-panel';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';
import {
  OptionPanel,
  OptionPanelData,
} from '../../../shared/ui/molecules/option-panel/option-panel';
import { iconOrFallback } from '../../../shared/ui/icons/icon-glyphs';
import { MEMBER_ROLE_LABELS } from '../../config/member.constants';
import { ReceivedInvitation } from '../../invitations/invitation.models';
import { InvitationsService } from '../../invitations/invitations.service';
import { AppShell } from '../../../shared/ui/templates/app-shell/app-shell';
import { AuthService } from '../../auth/auth.service';
import { ExchangeRateFlow } from '../../exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../periods/period.service';
import { APP_PATHS, INVITATION_QUERY_PARAMS, ROUTE_DATA_KEYS } from '../../routing/app-paths';
import { activeRouteData } from '../../routing/route-chain';
import { SpaceService } from '../../spaces/space.service';
import { TotalsService } from '../../totals/totals.service';
import { NAV_ITEMS } from '../nav-items';

/**
 * Signed-in area: fills the app shell template with the accounts total and the period selector
 * (spec §7), asks once per visit for an exchange rate the totals need (spec §4.6), and leaves when
 * the session ends.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, AppShell, IconButton, PeriodChip],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly overlay = inject(OverlayService);
  private readonly spaces = inject(SpaceService);
  private readonly totals = inject(TotalsService);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly format = inject(MONEY_FORMAT);
  protected readonly periods = inject(PeriodService);

  protected readonly navItems = NAV_ITEMS;
  protected readonly paths = APP_PATHS;
  private readonly invitations = inject(InvitationsService);
  private readonly toast = inject(ToastService);
  /** Currencies whose rate was already asked for in this visit. */
  private readonly askedRates = new Set<string>();
  /** Invitations already announced in this visit. */
  private readonly announcedInvitations = new Set<string>();

  /** `ROUTE_DATA_KEYS` flags set anywhere in the active route chain. */
  protected readonly routeFlags = computed(() => {
    // Only a dependency: the snapshot changes on every successful navigation.
    this.router.lastSuccessfulNavigation();
    const data = activeRouteData(this.router);
    return {
      flow: data[ROUTE_DATA_KEYS.flow] === true,
      listDetail: data[ROUTE_DATA_KEYS.listDetail] === true,
    };
  });

  /** Accounts included in the total, in the main currency; says which rates are missing. */
  protected readonly total = computed(() => {
    const total = this.totals.accountsTotal();
    if (!total) {
      return '—';
    }
    const text = formatMoney(total.total, total.currency, this.format());
    const missing = total.missingRateCurrencies.map(currencySymbol).join(', ');
    return missing ? `${text} (sin ${missing})` : text;
  });

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        void this.router.navigate(['/', APP_PATHS.login]);
      }
    });
    // An invitation to another space shows once per visit, outside flows.
    effect(() => {
      const invitation = this.invitations.mine()[0];
      if (!invitation || this.routeFlags().flow || this.announcedInvitations.has(invitation.id)) {
        return;
      }
      this.announcedInvitations.add(invitation.id);
      untracked(() => void this.announceInvitation(invitation));
    });
    // The first time a total needs a rate, ask for it; never in the middle of a flow.
    effect(() => {
      const missing = this.totals.missingRateCurrencies();
      if (this.routeFlags().flow || !this.spaces.canEdit()) {
        return;
      }
      const currency = missing.find((code) => !this.askedRates.has(code));
      if (currency) {
        this.askedRates.add(currency);
        untracked(() =>
          this.rateFlow.open(currency, {
            reason: `Tienes movimientos o cuentas en ${currencySymbol(currency)}. Para sumarlos en los totales hace falta la tasa de cambio.`,
          }),
        );
      }
    });
  }

  /** Icon of the space selector; only with more than one space (spec §3.1 and §7). */
  protected readonly spaceIcon = computed(() =>
    this.spaces.memberships().length > 1 ? iconOrFallback(this.spaces.activeSpace()?.icon) : null,
  );
  protected readonly spaceLabel = computed(
    () => `Espacio: ${this.spaces.activeSpace()?.name ?? ''}. Cambiar de espacio`,
  );

  protected async chooseSpace(): Promise<void> {
    const current = this.spaces.activeSpace()?.id;
    const spaceId = await this.overlay.open<string, OptionPanelData<string>>(OptionPanel, {
      label: 'Espacio',
      data: {
        title: 'Espacio',
        mode: 'single',
        selected: current,
        prominent: true,
        options: this.spaces.memberships().map((membership) => ({
          value: membership.space.id,
          label: membership.space.name,
          description: MEMBER_ROLE_LABELS[membership.role],
          icon: membership.space.icon,
          color: membership.space.color,
        })),
      },
    });
    if (!spaceId || spaceId === current) {
      return;
    }
    await this.spaces.select(spaceId);
    // Screens of the other space (an account, a category) do not exist here: start at home.
    await this.router.navigateByUrl('/');
  }

  /** Once per visit, the invitations for the user to other spaces (spec §3.3). */
  private async announceInvitation(invitation: ReceivedInvitation): Promise<void> {
    const open = await this.toast.showWithAction(`Te invitaron a ${invitation.spaceName}.`, 'Ver', {
      persistent: true,
    });
    if (open) {
      await this.router.navigate(['/', APP_PATHS.invitation], {
        queryParams: { [INVITATION_QUERY_PARAMS.id]: invitation.id },
      });
    }
  }

  protected async choosePeriod(): Promise<void> {
    const period = await this.overlay.open<Period, PeriodPanelData>(PeriodPanel, {
      label: 'Periodo',
      data: {
        period: this.periods.period(),
        settings: this.periods.settings(),
        today: this.periods.today(),
      },
    });
    if (period) {
      this.periods.select(period);
    }
  }
}
