import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  viewChild,
} from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { currencyMinorUnits, currencySymbol } from '../../../../domain/money/currencies';
import {
  AmountEdit,
  AmountEditKind,
  formatAmountInput,
  MoneyParseError,
  parseMoney,
  regroupAmountInput,
} from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS } from '../../../../domain/money/number-format';
import { MONEY_FORMAT } from '../../money/money-format';
import { MONEY_PARSE_MESSAGES } from '../../ui.constants';
import { FormControlBase } from '../form-control-base';

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
 * Amount input in minor units (null when empty). It reads and writes the user's number format,
 * groups the thousands while the user types keeping the caret in place (spec §4.6), and reports
 * what it cannot read as a parse error of the bound field.
 */
@Component({
  selector: 'cc-money-field',
  imports: [MatFormField, MatLabel, MatInput, MatPrefix, MatHint, MatError],
  templateUrl: './money-field.html',
  styleUrl: './money-field.scss',
})
export class MoneyField extends FormControlBase implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly currency = input.required<string>();
  readonly allowNegative = input(false);
  readonly placeholder = input('');

  private readonly format = inject(MONEY_FORMAT);
  private readonly injector = inject(Injector);
  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly matInput = viewChild.required(MatInput);
  /** Text and selection start right before the current edit. */
  private beforeEdit: AmountEdit | null = null;

  protected readonly symbol = computed(() => currencySymbol(this.currency()));
  protected readonly text = transformedValue(this.value, {
    parse: (raw: string) => {
      const result = parseMoney(raw, this.currency(), this.format().numberFormat, {
        allowNegative: this.allowNegative(),
      });
      return result.ok ? { value: result.value } : { error: this.parseError(result.error) };
    },
    format: (value: number | null) =>
      value === null ? '' : formatAmountInput(value, this.currency(), this.format().numberFormat),
  });

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  protected onBeforeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.beforeEdit = { text: input.value, caret: input.selectionStart ?? input.value.length };
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Keyboards that compose (IME, some Android ones) regroup once the composition ends.
    if ((event as Partial<InputEvent>).isComposing) {
      this.text.set(input.value);
      return;
    }
    this.regroup(input, editKindOf(event));
  }

  protected onCompositionEnd(event: Event): void {
    this.regroup(event.target as HTMLInputElement, 'other');
  }

  protected onBlur(): void {
    // Shows the amount with its grouping once the user is done, unless it could not be read.
    if (this.text.parseErrors().length === 0) {
      const value = this.value();
      this.text.set(
        value === null ? '' : formatAmountInput(value, this.currency(), this.format().numberFormat),
      );
    }
    this.touch.emit();
  }

  protected override errorStateTarget(): MatInput {
    return this.matInput();
  }

  private regroup(input: HTMLInputElement, kind: AmountEditKind): void {
    const previous = this.beforeEdit ?? { text: this.text(), caret: this.text().length };
    this.beforeEdit = null;
    const edit = regroupAmountInput(
      previous,
      { text: input.value, caret: input.selectionStart ?? input.value.length },
      kind,
      this.currency(),
      this.format().numberFormat,
      { allowNegative: this.allowNegative() },
    );
    if (input.value !== edit.text) {
      input.value = edit.text;
    }
    this.text.set(edit.text);
    if (input.ownerDocument.activeElement === input) {
      input.setSelectionRange(edit.caret, edit.caret);
      // The [value] binding writes the same text again on the next render; keep the caret there.
      afterNextRender(() => input.setSelectionRange(edit.caret, edit.caret), {
        injector: this.injector,
      });
    }
  }

  private parseError(error: MoneyParseError): ValidationError.WithoutFieldTree {
    const messages = MONEY_PARSE_MESSAGES;
    const message =
      error === 'grouping'
        ? messages.grouping(NUMBER_FORMAT_SEPARATORS[this.format().numberFormat].decimal)
        : error === 'too_many_decimals'
          ? messages.too_many_decimals(currencyMinorUnits(this.currency()))
          : messages[error];
    return { kind: 'money', message };
  }
}
