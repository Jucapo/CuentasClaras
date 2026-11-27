import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Button } from '../../atoms/button/button';
import { CurrencySelect } from '../../atoms/currency-select/currency-select';
import { MoneyField } from '../../atoms/money-field/money-field';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { Form } from '../form/form';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** Data of `cc-amount-panel`. */
export interface AmountPanelData {
  readonly title: string;
  /** Label of the amount field. */
  readonly label: string;
  /** Currency of the amount; the starting one when `currencyEditable`. */
  readonly currency: string;
  /** Minor units. */
  readonly value: number | null;
  readonly allowNegative?: boolean;
  readonly hint?: string;
  readonly requiredMessage: string;
  /** Shows a currency picker above the amount. */
  readonly currencyEditable?: boolean;
}

/** What `cc-amount-panel` resolves with on "Listo". */
export interface AmountPanelResult {
  /** Minor units. */
  readonly amount: number;
  readonly currency: string;
}

/** Focused sheet or dialog to type one amount (and its currency); open it with `autoFocus: 'input'`. */
@Component({
  selector: 'cc-amount-panel',
  imports: [OverlayPanel, Form, MoneyField, CurrencySelect, FormField, Button],
  templateUrl: './amount-panel.html',
  styleUrl: './amount-panel.scss',
})
export class AmountPanel {
  protected readonly data = inject<AmountPanelData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<AmountPanelResult>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  private readonly model = signal<{ amount: number | null; currency: string }>({
    amount: this.data.value,
    currency: this.data.currency,
  });
  protected readonly form = form(
    this.model,
    (path) => required(path.amount, { message: this.data.requiredMessage }),
    {
      submission: {
        action: async () => {
          const { amount, currency } = this.model();
          this.handle.close({ amount: amount ?? 0, currency });
          return undefined;
        },
      },
    },
  );

  protected done(): void {
    void submit(this.form);
  }

  protected close(): void {
    this.handle.close();
  }
}
