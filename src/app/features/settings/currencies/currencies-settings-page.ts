import { Component, computed, inject } from '@angular/core';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { SPACE_DEFAULTS } from '../../../core/config/space.constants';
import { TRANSACTION_LIMITS } from '../../../core/config/transaction.constants';
import { ExchangeRate } from '../../../core/exchange-rates/exchange-rate.models';
import { ExchangeRateFlow } from '../../../core/exchange-rates/exchange-rate-flow';
import {
  ExchangeRatesService,
  rateToMain,
} from '../../../core/exchange-rates/exchange-rates.service';
import { PeriodService } from '../../../core/periods/period.service';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { currencySymbol } from '../../../domain/money/currencies';
import { formatDecimal } from '../../../domain/money/money';
import { rangeText } from '../../../domain/periods/period-labels';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { ListItem } from '../../../shared/ui/molecules/list-item/list-item';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import { MONEY_FORMAT } from '../../../shared/ui/money/money-format';

interface RateRow {
  readonly rate: ExchangeRate;
  /** e.g. "1 US$ = $ 4.150,25". */
  readonly title: string;
  /** e.g. "Desde 26 nov". */
  readonly subtitle: string;
}

interface CurrencySection {
  readonly currency: string;
  readonly title: string;
  readonly description: string;
  readonly rows: readonly RateRow[];
}

/**
 * Configuración → Monedas (spec §4.6, §7): each currency in use other than the main one, with the
 * rate in force and its history. The newest rate on or before a movement's date converts it.
 */
@Component({
  selector: 'app-currencies-settings-page',
  imports: [PageHeader, Section, ListItem, Button, FormActions, Message],
  templateUrl: './currencies-settings-page.html',
  styleUrl: './currencies-settings-page.scss',
})
export class CurrenciesSettingsPage {
  private readonly accounts = inject(AccountsService);
  private readonly rates = inject(ExchangeRatesService);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly format = inject(MONEY_FORMAT);

  protected readonly backLink = ['/', APP_PATHS.settings];
  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.rates.loadError;
  protected readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );
  protected readonly mainSymbol = computed(() => currencySymbol(this.mainCurrency()));

  /** Currencies of the accounts and of the saved rates, other than the main one. */
  private readonly currencies = computed(() => {
    const main = this.mainCurrency();
    const codes = new Set<string>();
    for (const account of this.accounts.accounts()) {
      codes.add(account.currency);
    }
    for (const rate of this.rates.rates()) {
      codes.add(rate.base);
      codes.add(rate.quote);
    }
    codes.delete(main);
    return [...codes].sort();
  });

  protected readonly sections = computed<CurrencySection[]>(() => {
    const main = this.mainCurrency();
    const today = this.periods.today();
    return this.currencies().map((currency) => {
      const rows = this.rates.history(currency, main).map((rate) => ({
        rate,
        title: `1 ${currencySymbol(currency)} = ${currencySymbol(main)} ${formatDecimal(
          rateToMain(rate, currency),
          TRANSACTION_LIMITS.exchangeRateDecimals,
          this.format().numberFormat,
        )}`,
        subtitle: `Desde ${rangeText({ start: rate.date, end: rate.date }, today)}`,
      }));
      return {
        currency,
        title: `${currencySymbol(currency)} → ${currencySymbol(main)}`,
        description: rows[0]
          ? `Vigente: ${rows[0].title}.`
          : 'Sin tasa: sus montos no suman en los totales.',
        rows,
      };
    });
  });
  protected readonly isEmpty = computed(
    () => this.accounts.loaded() && this.currencies().length === 0,
  );

  protected add(currency: string): void {
    void this.rateFlow.open(currency);
  }

  protected openRate(currency: string, rate: ExchangeRate): void {
    if (this.canEdit()) {
      void this.rateFlow.open(currency, { existing: rate });
    }
  }
}
