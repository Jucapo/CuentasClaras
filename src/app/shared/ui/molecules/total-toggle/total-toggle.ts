import { Component, ElementRef, inject, input, model } from '@angular/core';
import { Amount } from '../../atoms/amount/amount';

/** Whether a total is spending or income: it sets the color of its card. */
export type TotalTone = 'expense' | 'income';

/** One card of `cc-total-toggle`, e.g. "Gastos $ 4.100.000 · ▼ 9 % vs. 28 sep – 26 oct". */
export interface TotalOption<T> {
  readonly value: T;
  readonly label: string;
  /** Minor units of `currency`. */
  readonly amount: number;
  readonly currency: string;
  readonly tone: TotalTone;
  /** A short line under the amount, e.g. the comparison with the previous period. */
  readonly note?: string | null;
  /** Whether the note is good or bad news, which colors it on the card that is not selected. */
  readonly noteTone?: 'good' | 'bad' | 'neutral';
}

/**
 * Totals that are also the selector of what the screen below shows (spec §7): Gastos and Ingresos
 * in the Resumen. The selected card is filled with its tone. It is a radio group: arrows move the
 * selection, as in any group of radio buttons.
 */
@Component({
  selector: 'cc-total-toggle',
  imports: [Amount],
  templateUrl: './total-toggle.html',
  styleUrl: './total-toggle.scss',
})
export class TotalToggle<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly TotalOption<T>[]>();
  /** Accessible name of the group, e.g. "Qué mostrar". */
  readonly label = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected select(value: T): void {
    this.value.set(value);
  }

  protected move(event: KeyboardEvent, index: number): void {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const options = this.options();
    const next = (index + step + options.length) % options.length;
    this.value.set(options[next].value);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}
