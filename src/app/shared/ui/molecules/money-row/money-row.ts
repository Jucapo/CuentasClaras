import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { currencySymbol } from '../../../../domain/money/currencies';
import { formatAmountInput } from '../../../../domain/money/money';
import { FormControlBase } from '../../atoms/form-control-base';
import { Icon } from '../../atoms/icon/icon';
import { MoneyInput, moneyText } from '../../atoms/money-input/money-input';
import { IconName } from '../../icons/icon-glyphs';
import { MONEY_FORMAT } from '../../money/money-format';
import { OverlayService } from '../../services/overlay.service';
import { OptionPanel, OptionPanelData, PanelOption } from '../option-panel/option-panel';

/** An amount confirmed in a `cc-money-row` (Enter, leaving the field or a new currency). */
export interface MoneyRowCommit {
  /** Minor units; null when the field was left empty. */
  readonly amount: number | null;
  readonly currency: string;
  /** Puts back what the row had before, e.g. when saving it failed. */
  readonly revert: () => void;
}

interface RowAmount {
  readonly amount: number | null;
  readonly currency: string;
}

const TEXT = { currency: 'Moneda' } as const;

/**
 * List row whose amount is typed in place (spec §13.5, "Menos modales"): touching any part of it
 * focuses the amount with the numeric keyboard. It works bound to a form field or on its own, where
 * `committed` reports each confirmed amount. With `currencyOptions` the currency symbol is a button
 * that opens the list of currencies.
 */
@Component({
  selector: 'cc-money-row',
  imports: [Icon, MoneyInput],
  templateUrl: './money-row.html',
  styleUrl: './money-row.scss',
  host: { '[class.end]': "valuePosition() === 'end'" },
})
export class MoneyRow extends FormControlBase implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly currency = model.required<string>();
  /** Currencies to choose from; without them the symbol is plain text. */
  readonly currencyOptions = input<readonly PanelOption<string>[]>([]);
  /** Leading icon; without it the projected `[ccMoneyRowLeading]` content leads. */
  readonly icon = input<IconName>();
  readonly allowNegative = input(false);
  /** Shown while the amount is empty, e.g. "Sin presupuesto". */
  readonly placeholder = input('');
  /** Under the label, like `cc-field-row`, or at the end of the row, for lists of amounts. */
  readonly valuePosition = input<'below' | 'end'>('below');
  /** What Enter does on touch keyboards: go to the next row or finish. */
  readonly enterKeyHint = input<'next' | 'done'>('done');
  readonly committed = output<MoneyRowCommit>();
  /** Enter was pressed, e.g. to move to the next row. */
  readonly enter = output<void>();

  private readonly format = inject(MONEY_FORMAT);
  private readonly overlay = inject(OverlayService);
  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** Amount and currency the row had when it was last confirmed or focused. */
  private confirmed: RowAmount | null = null;

  protected readonly focused = signal(false);
  protected readonly supportId = `${this.controlId}-support`;
  protected readonly symbol = computed(() => currencySymbol(this.currency()));
  protected readonly text = moneyText(this.value, {
    currency: () => this.currency(),
    allowNegative: () => this.allowNegative(),
  });
  /** The field's error, or what could not be read when the row is not bound to a form. */
  protected readonly shownError = computed(
    () =>
      this.errorMessage() ??
      (this.focused() ? null : (this.text.parseErrors()[0]?.message ?? null)),
  );
  /** The hint shows while typing, so the row stays compact. */
  protected readonly shownHint = computed(() => (this.focused() ? (this.hint() ?? null) : null));
  protected readonly currencyButtonLabel = computed(() => {
    const code = this.currency();
    const option = this.currencyOptions().find((candidate) => candidate.value === code);
    return `${TEXT.currency}: ${option?.label ?? code}`;
  });

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  /** Touching the row anywhere but its buttons edits the amount. */
  protected focusFromRow(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.disabled() && !target.closest('button, input, label')) {
      this.focus();
    }
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.confirmed = this.snapshot();
  }

  protected onBlur(): void {
    this.focused.set(false);
    // Shows the amount with its grouping once the user is done, unless it could not be read.
    if (this.text.parseErrors().length === 0) {
      const value = this.value();
      this.text.set(
        value === null ? '' : formatAmountInput(value, this.currency(), this.format().numberFormat),
      );
    }
    this.touch.emit();
    this.commit();
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    this.commit();
    this.enter.emit();
    if (this.enterKeyHint() === 'done') {
      this.inputElement().nativeElement.blur();
    }
  }

  protected async pickCurrency(): Promise<void> {
    const before = this.snapshot();
    const picked = await this.overlay.open<string, OptionPanelData<string>>(OptionPanel, {
      label: TEXT.currency,
      data: {
        title: TEXT.currency,
        mode: 'single',
        selected: before.currency,
        options: this.currencyOptions(),
      },
    });
    if (!picked || picked === before.currency) {
      return;
    }
    this.confirmed ??= before;
    this.currency.set(picked);
    // A row with an amount saves the new currency at once.
    if (this.value() !== null) {
      this.commit();
    }
  }

  private commit(): void {
    if (this.text.parseErrors().length > 0) {
      return;
    }
    const current = this.snapshot();
    const previous = this.confirmed ?? current;
    if (current.amount === previous.amount && current.currency === previous.currency) {
      return;
    }
    this.confirmed = current;
    this.committed.emit({
      ...current,
      revert: () => {
        this.confirmed = previous;
        this.currency.set(previous.currency);
        this.value.set(previous.amount);
      },
    });
  }

  private snapshot(): RowAmount {
    return { amount: this.value(), currency: this.currency() };
  }
}
