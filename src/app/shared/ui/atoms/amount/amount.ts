import { Component, computed, inject, input } from '@angular/core';
import { formatMoney } from '../../../../domain/money/money';
import { MONEY_FORMAT } from '../../money/money-format';

/** `auto` paints negative amounts (debts) in the error color; `neutral` never colors them. */
export type AmountTone = 'auto' | 'neutral';

/** An amount in minor units, formatted with the user's number format, e.g. `-$ 1,234,567.90`. */
@Component({
  selector: 'cc-amount',
  templateUrl: './amount.html',
  styleUrl: './amount.scss',
  host: { '[class.negative]': "tone() === 'auto' && amount() < 0" },
})
export class Amount {
  /** Integer, in minor units. */
  readonly amount = input.required<number>();
  readonly currency = input.required<string>();
  readonly tone = input<AmountTone>('auto');
  /** Shows a plus sign before positive amounts, e.g. money coming into an account. */
  readonly signed = input(false);

  private readonly format = inject(MONEY_FORMAT);

  protected readonly text = computed(() => {
    const text = formatMoney(this.amount(), this.currency(), this.format());
    return this.signed() && this.amount() > 0 ? `+${text}` : text;
  });
}
