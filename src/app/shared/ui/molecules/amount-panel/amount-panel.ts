import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Button } from '../../atoms/button/button';
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
  readonly currency: string;
  /** Minor units. */
  readonly value: number | null;
  readonly allowNegative?: boolean;
  readonly hint?: string;
  readonly requiredMessage: string;
}

/** Focused sheet or dialog to type one amount; resolves with minor units on "Listo". Open it with `autoFocus: 'input'`. */
@Component({
  selector: 'cc-amount-panel',
  imports: [OverlayPanel, Form, MoneyField, FormField, Button],
  templateUrl: './amount-panel.html',
  styleUrl: './amount-panel.scss',
})
export class AmountPanel {
  protected readonly data = inject<AmountPanelData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<number>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  private readonly model = signal<{ amount: number | null }>({ amount: this.data.value });
  protected readonly form = form(
    this.model,
    (path) => required(path.amount, { message: this.data.requiredMessage }),
    {
      submission: {
        action: async () => {
          this.handle.close(this.model().amount ?? 0);
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
