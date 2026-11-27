import { Component, computed, input, output } from '@angular/core';
import { addDays, IsoDate, isIsoDate } from '../../../../domain/dates/local-date';
import { longDateText } from '../../../../domain/periods/period-labels';
import { DateField } from '../../atoms/date-field/date-field';
import { Icon } from '../../atoms/icon/icon';
import { IconName } from '../../icons/icon-glyphs';

const DATE_CHOICE_TEXT = {
  today: 'Hoy',
  yesterday: 'Ayer',
  pick: 'Elegir día',
} as const;

interface DayChoice {
  readonly label: string;
  readonly icon: IconName;
  readonly date: IsoDate;
}

/**
 * The date of a movement (spec §7): Hoy and Ayer as tiles, each with its date spelled out, and
 * "Elegir día" with the calendar of the system. Emits the chosen date; the one in `value` shows
 * as picked.
 */
@Component({
  selector: 'cc-date-choice',
  imports: [DateField, Icon],
  templateUrl: './date-choice.html',
  styleUrl: './date-choice.scss',
})
export class DateChoice {
  readonly value = input.required<IsoDate>();
  readonly today = input.required<IsoDate>();
  readonly chosen = output<IsoDate>();

  protected readonly text = DATE_CHOICE_TEXT;
  protected readonly days = computed<DayChoice[]>(() => [
    { label: DATE_CHOICE_TEXT.today, icon: 'sunny', date: this.today() },
    { label: DATE_CHOICE_TEXT.yesterday, icon: 'bedtime', date: addDays(this.today(), -1) },
  ]);
  protected readonly longDate = (date: IsoDate) => longDateText(date, this.today());

  protected pick(date: IsoDate): void {
    if (isIsoDate(date)) {
      this.chosen.emit(date);
    }
  }
}
