import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, schema, submit, validate } from '@angular/forms/signals';
import { ActionResult } from '../../../../core/action-result';
import { TRANSACTION_LIMITS } from '../../../../core/config/transaction.constants';
import { IsoDate, isIsoDate } from '../../../../domain/dates/local-date';
import { currencySymbol } from '../../../../domain/money/currencies';
import { Button } from '../../atoms/button/button';
import { DateField } from '../../atoms/date-field/date-field';
import { DecimalField } from '../../atoms/decimal-field/decimal-field';
import { Message } from '../../atoms/message/message';
import { FormActions } from '../../molecules/form-actions/form-actions';
import { Form } from '../../molecules/form/form';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';

/** Values edited by `cc-exchange-rate-sheet`. */
export interface ExchangeRateFormValue {
  date: IsoDate;
  /** Units of the main currency that one unit of the other currency is worth. */
  rate: number | null;
}

/** What the sheet asks the page to do after closing; `saved` means it already saved. */
export type ExchangeRateSheetResult = 'saved' | 'delete';

/** Data of `cc-exchange-rate-sheet`. */
export interface ExchangeRateSheetData {
  readonly title: string;
  /** The other currency, e.g. USD. */
  readonly currency: string;
  readonly mainCurrency: string;
  readonly value: ExchangeRateFormValue;
  /** Why the rate is asked for, e.g. when a total needs it (spec §4.6). */
  readonly reason?: string;
  /** Delete; omitted when creating. */
  readonly canDelete?: boolean;
  readonly save: (value: ExchangeRateFormValue) => Promise<ActionResult>;
}

const MESSAGES = {
  rateRequired: 'Escribe la tasa.',
  ratePositive: 'La tasa debe ser mayor que cero.',
  dateRequired: 'Elige la fecha.',
} as const;

const rateSchema = schema<ExchangeRateFormValue>((path) => {
  required(path.rate, { message: MESSAGES.rateRequired });
  validate(path.rate, ({ value }) => {
    const rate = value();
    return rate !== null && rate <= 0
      ? { kind: 'min', message: MESSAGES.ratePositive }
      : undefined;
  });
  validate(path.date, ({ value }) =>
    isIsoDate(value()) ? undefined : { kind: 'required', message: MESSAGES.dateRequired },
  );
});

/**
 * A manual exchange rate in a short sheet (spec §4.6): the date it applies from and how much one
 * unit of the other currency is worth in the main one, "1 US$ = $ X".
 */
@Component({
  selector: 'cc-exchange-rate-sheet',
  imports: [FormField, OverlayPanel, Form, DateField, DecimalField, FormActions, Button, Message],
  templateUrl: './exchange-rate-sheet.html',
  styleUrl: './exchange-rate-sheet.scss',
})
export class ExchangeRateSheet {
  protected readonly data = inject<ExchangeRateSheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<ExchangeRateSheetResult>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  protected readonly decimals = TRANSACTION_LIMITS.exchangeRateDecimals;
  protected readonly prefix = `1 ${currencySymbol(this.data.currency)} =`;
  protected readonly suffix = currencySymbol(this.data.mainCurrency);
  protected readonly error = signal<string | null>(null);

  private readonly model = signal<ExchangeRateFormValue>(this.data.value);
  protected readonly form = form(this.model, rateSchema, {
    submission: { action: () => this.save() },
  });

  protected done(): void {
    void submit(this.form);
  }

  protected remove(): void {
    this.handle.close('delete');
  }

  protected close(): void {
    this.handle.close();
  }

  private async save(): Promise<undefined> {
    this.error.set(null);
    const result = await this.data.save(this.model());
    if (!result.ok) {
      this.error.set(result.message);
      return undefined;
    }
    this.handle.close('saved');
    return undefined;
  }
}
