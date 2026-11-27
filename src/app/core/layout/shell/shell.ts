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
import { AppShell } from '../../../shared/ui/templates/app-shell/app-shell';
import { AuthService } from '../../auth/auth.service';
import { ExchangeRateFlow } from '../../exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../periods/period.service';
import { APP_PATHS, ROUTE_DATA_KEYS } from '../../routing/app-paths';
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
  /** Currencies whose rate was already asked for in this visit. */
  private readonly askedRates = new Set<string>();

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
