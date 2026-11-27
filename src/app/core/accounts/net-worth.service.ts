import { computed, inject, Injectable, resource } from '@angular/core';
import { NetWorth, netWorth } from '../../domain/accounts/net-worth';
import { SPACE_DEFAULTS } from '../config/space.constants';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PeriodService } from '../periods/period.service';
import { SpaceService } from '../spaces/space.service';
import { AccountsService } from './accounts.service';
import { NetWorthApi } from './net-worth.api';

/**
 * "Mis finanzas" (spec §6, §7): the net worth of the accounts the user sees, with today's rate.
 * It reloads with the accounts (which follow every movement) and the rates.
 */
@Injectable({ providedIn: 'root' })
export class NetWorthService {
  private readonly api = inject(NetWorthApi);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly accounts = inject(AccountsService);
  private readonly rates = inject(ExchangeRatesService);

  readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );

  private readonly store = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId
        ? {
            spaceId,
            today: this.periods.today(),
            accounts: this.accounts.accounts(),
            rates: this.rates.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.fetch(params.spaceId, params.today);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Null until loaded. */
  readonly netWorth = computed<NetWorth | null>(() =>
    this.store.hasValue() ? netWorth(this.store.value(), this.mainCurrency()) : null,
  );
  readonly error = computed(() => this.store.error()?.message ?? null);
}
