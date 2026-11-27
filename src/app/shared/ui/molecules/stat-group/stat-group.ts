import { Component, input } from '@angular/core';
import { Amount, AmountTone } from '../../atoms/amount/amount';

/** One figure of a `cc-stat-group`, e.g. "Ingresos +$ 3.000.000". */
export interface StatItem {
  readonly label: string;
  /** Minor units of `currency`. */
  readonly amount: number;
  readonly currency: string;
  /** `auto` paints negatives in the error color; neutral by default. */
  readonly tone?: AmountTone;
  /** Shows a plus sign before positive amounts. */
  readonly signed?: boolean;
  /** A short line under the figure, e.g. a comparison with the previous period. */
  readonly note?: string;
}

/**
 * A few labeled figures, e.g. incomes, expenses and net of a list. They go in rows while the
 * container is narrow and in columns when it is wide.
 */
@Component({
  selector: 'cc-stat-group',
  imports: [Amount],
  templateUrl: './stat-group.html',
  styleUrl: './stat-group.scss',
})
export class StatGroup {
  readonly items = input.required<readonly StatItem[]>();
  /** Accessible name of the group, e.g. "Totales de lo filtrado". */
  readonly label = input.required<string>();
}
