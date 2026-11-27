import { Component, computed, input, output } from '@angular/core';
import { currencySymbol } from '../../../../domain/money/currencies';
import { Button } from '../../atoms/button/button';
import { FormActions } from '../../molecules/form-actions/form-actions';
import { Section } from '../../molecules/section/section';

const MISSING_RATES_TEXT = {
  title: 'Falta una tasa de cambio',
  description: (symbols: string) =>
    `Falta la tasa de ${symbols}: esos montos no suman en los totales.`,
  define: 'Definir tasa',
} as const;

/**
 * The notice of totals that leave out currencies without an exchange rate (spec §4.6), with
 * "Definir tasa" for whoever can write rates. Renders nothing while every rate exists.
 */
@Component({
  selector: 'cc-missing-rates-notice',
  imports: [Section, FormActions, Button],
  templateUrl: './missing-rates-notice.html',
  styleUrl: './missing-rates-notice.scss',
})
export class MissingRatesNotice {
  /** Currency codes without a rate, e.g. `['USD']`. */
  readonly currencies = input.required<readonly string[]>();
  /** Owners and editors define rates. */
  readonly canDefine = input(false);
  /** The first currency without a rate. */
  readonly define = output<string>();

  protected readonly text = MISSING_RATES_TEXT;
  protected readonly description = computed(() =>
    MISSING_RATES_TEXT.description(this.currencies().map(currencySymbol).join(', ')),
  );

  protected defineFirst(): void {
    const [currency] = this.currencies();
    if (currency) {
      this.define.emit(currency);
    }
  }
}
