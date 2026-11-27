import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { actionFailed, ActionResult } from '../action-result';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { ExchangeRate, ExchangeRateEntry } from './exchange-rate.models';
import { ExchangeRatesApi } from './exchange-rates.api';

/** Manual exchange rates of the active space (spec §4.6). Totals reload when `revision` changes. */
@Injectable({ providedIn: 'root' })
export class ExchangeRatesService {
  private readonly api = inject(ExchangeRatesApi);
  private readonly spaces = inject(SpaceService);

  private readonly changes = signal(0);

  private readonly store = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId ? { spaceId, revision: this.changes() } : undefined;
    },
    loader: async ({ params: { spaceId } }) => {
      const result = await this.api.fetch(spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Goes up after every saved or deleted rate. */
  readonly revision = this.changes.asReadonly();

  /** Rates of the space, newest first. */
  readonly rates = computed<readonly ExchangeRate[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );
  readonly loaded = computed(() => this.store.hasValue());
  readonly loadError = computed(() => this.store.error()?.message ?? null);

  /** Rates between a currency and the main one, in either direction, newest first. */
  history(currency: string, mainCurrency: string): readonly ExchangeRate[] {
    return this.rates().filter(
      (rate) =>
        (rate.base === currency && rate.quote === mainCurrency) ||
        (rate.base === mainCurrency && rate.quote === currency),
    );
  }

  /** Saves a rate in the active space. */
  async save(entry: ExchangeRateEntry): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const saved = await this.api.save(spaceId, entry);
    if (saved.ok) {
      this.changes.update((value) => value + 1);
    }
    return saved;
  }

  /** Deletes a rate. */
  async remove(id: string): Promise<ActionResult> {
    const removed = await this.api.remove(id);
    if (removed.ok) {
      this.changes.update((value) => value + 1);
    }
    return removed;
  }
}

/** How many units of `mainCurrency` one unit of `currency` is worth under a rate. */
export function rateToMain(rate: ExchangeRate, currency: string): number {
  return rate.base === currency ? rate.rate : 1 / rate.rate;
}
