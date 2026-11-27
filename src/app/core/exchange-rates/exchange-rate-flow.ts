import { inject, Injectable } from '@angular/core';
import { currencySymbol } from '../../domain/money/currencies';
import {
  ExchangeRateSheet,
  ExchangeRateSheetData,
  ExchangeRateSheetResult,
} from '../../shared/ui/organisms/exchange-rate-sheet/exchange-rate-sheet';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ToastService } from '../../shared/ui/services/toast.service';
import { SPACE_DEFAULTS } from '../config/space.constants';
import { PeriodService } from '../periods/period.service';
import { SpaceService } from '../spaces/space.service';
import { ExchangeRate } from './exchange-rate.models';
import { ExchangeRatesService, rateToMain } from './exchange-rates.service';

/** Opens the rate sheet of a currency and saves or deletes what it returns (spec §4.6). */
@Injectable({ providedIn: 'root' })
export class ExchangeRateFlow {
  private readonly rates = inject(ExchangeRatesService);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  /** A new rate of `currency`, or an existing one; `reason` says why it is needed. */
  async open(currency: string, options: { existing?: ExchangeRate; reason?: string } = {}) {
    const mainCurrency = this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency;
    const { existing, reason } = options;
    const latest = this.rates.history(currency, mainCurrency)[0];
    const title = `${currencySymbol(currency)} → ${currencySymbol(mainCurrency)}`;
    const result = await this.overlay.open<ExchangeRateSheetResult, ExchangeRateSheetData>(
      ExchangeRateSheet,
      {
        label: `Tasa ${title}`,
        autoFocus: 'input',
        data: {
          title: existing ? `Tasa ${title}` : `Nueva tasa ${title}`,
          currency,
          mainCurrency,
          reason,
          canDelete: !!existing,
          value: {
            date: existing?.date ?? this.periods.today(),
            rate: existing
              ? rateToMain(existing, currency)
              : latest
                ? rateToMain(latest, currency)
                : null,
          },
          save: (value) =>
            this.rates.save({
              date: value.date,
              base: currency,
              quote: mainCurrency,
              rate: value.rate ?? 0,
            }),
        },
      },
    );
    if (result === 'saved') {
      void this.toast.show('Tasa guardada.');
    } else if (result === 'delete' && existing) {
      const confirmed = await this.confirm.confirm({
        title: '¿Eliminar esta tasa?',
        message: 'Los movimientos de esa fecha usarán la tasa anterior.',
        confirmLabel: 'Eliminar',
        destructive: true,
      });
      if (confirmed) {
        const removed = await this.rates.remove(existing.id);
        void this.toast.show(removed.ok ? 'Tasa eliminada.' : removed.message);
      }
    }
  }
}
