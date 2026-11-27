import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  ModelSignal,
  WritableSignal,
} from '@angular/core';
import { TransformedValueSignal, transformedValue, ValidationError } from '@angular/forms/signals';
import { currencyMinorUnits } from '../../../../domain/money/currencies';
import {
  AmountEdit,
  AmountEditKind,
  formatAmountInput,
  MoneyParseError,
  parseMoney,
  regroupAmountInput,
} from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS, NumberFormat } from '../../../../domain/money/number-format';
import { MONEY_FORMAT } from '../../money/money-format';
import { MONEY_PARSE_MESSAGES } from '../../ui.constants';

/** How an amount control reads its text. */
export interface MoneyTextOptions {
  readonly currency: () => string;
  readonly allowNegative: () => boolean;
}

/**
 * The raw text of an amount control in minor units (null when empty), read and written in the
 * user's number format. What it cannot read is a parse error, reported to the bound field if any.
 * Call it in the control's injection context.
 */
export function moneyText(
  value: ModelSignal<number | null>,
  options: MoneyTextOptions,
): TransformedValueSignal<string> {
  const format = inject(MONEY_FORMAT);
  return transformedValue(value, {
    parse: (raw: string) => {
      const numberFormat = format().numberFormat;
      const result = parseMoney(raw, options.currency(), numberFormat, {
        allowNegative: options.allowNegative(),
      });
      return result.ok
        ? { value: result.value }
        : { error: moneyParseError(result.error, options.currency(), numberFormat) };
    },
    format: (amount: number | null) =>
      amount === null ? '' : formatAmountInput(amount, options.currency(), format().numberFormat),
  });
}

function moneyParseError(
  error: MoneyParseError,
  currency: string,
  numberFormat: NumberFormat,
): ValidationError.WithoutFieldTree {
  const messages = MONEY_PARSE_MESSAGES;
  const message =
    error === 'grouping'
      ? messages.grouping(NUMBER_FORMAT_SEPARATORS[numberFormat].decimal)
      : error === 'too_many_decimals'
        ? messages.too_many_decimals(currencyMinorUnits(currency))
        : messages[error];
  return { kind: 'money', message };
}

/** What an input event did, from its `inputType`; synthetic events count as `other`. */
function editKindOf(event: Event): AmountEditKind {
  const type = (event as Partial<InputEvent>).inputType ?? '';
  if (type === 'deleteContentBackward') {
    return 'deleteBackward';
  }
  if (type === 'deleteContentForward') {
    return 'deleteForward';
  }
  return type.startsWith('insert') ? 'insert' : 'other';
}

/**
 * Typing behavior of an amount input (spec §4.6): groups the thousands while the user types and
 * keeps the caret next to the same digit. It writes the text to the bound signal; the control that
 * owns that signal parses it and formats it when the user leaves.
 */
@Directive({
  selector: 'input[ccMoneyInput]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(beforeinput)': 'onBeforeInput()',
    '(input)': 'onInput($event)',
    '(compositionend)': 'onCompositionEnd()',
  },
})
export class MoneyInput {
  /** Raw text of the amount, as typed. */
  readonly text = input.required<WritableSignal<string>>({ alias: 'ccMoneyInput' });
  readonly ccMoneyInputCurrency = input.required<string>();
  readonly ccMoneyInputAllowNegative = input(false);

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly format = inject(MONEY_FORMAT);
  private readonly injector = inject(Injector);
  /** Text and selection start right before the current edit. */
  private beforeEdit: AmountEdit | null = null;

  protected onBeforeInput(): void {
    const input = this.element;
    this.beforeEdit = { text: input.value, caret: input.selectionStart ?? input.value.length };
  }

  protected onInput(event: Event): void {
    // Keyboards that compose (IME, some Android ones) regroup once the composition ends.
    if ((event as Partial<InputEvent>).isComposing) {
      this.text().set(this.element.value);
      return;
    }
    this.regroup(editKindOf(event));
  }

  protected onCompositionEnd(): void {
    this.regroup('other');
  }

  private regroup(kind: AmountEditKind): void {
    const input = this.element;
    const text = this.text();
    const previous = this.beforeEdit ?? { text: text(), caret: text().length };
    this.beforeEdit = null;
    const edit = regroupAmountInput(
      previous,
      { text: input.value, caret: input.selectionStart ?? input.value.length },
      kind,
      this.ccMoneyInputCurrency(),
      this.format().numberFormat,
      { allowNegative: this.ccMoneyInputAllowNegative() },
    );
    if (input.value !== edit.text) {
      input.value = edit.text;
    }
    text.set(edit.text);
    if (input.ownerDocument.activeElement === input) {
      input.setSelectionRange(edit.caret, edit.caret);
      // The [value] binding writes the same text again on the next render; keep the caret there.
      afterNextRender(() => input.setSelectionRange(edit.caret, edit.caret), {
        injector: this.injector,
      });
    }
  }
}
