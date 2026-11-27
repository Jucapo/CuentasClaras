import { Component, computed, inject, signal } from '@angular/core';
import { addDays, IsoDate, isIsoDate } from '../../../../domain/dates/local-date';
import { periodRangeText } from '../../../../domain/periods/period-labels';
import {
  AnchoredPeriodKind,
  Period,
  periodContaining,
  PeriodKind,
  PeriodSettings,
} from '../../../../domain/periods/periods';
import { Button } from '../../atoms/button/button';
import { DateField } from '../../atoms/date-field/date-field';
import { Icon } from '../../atoms/icon/icon';
import { Message } from '../../atoms/message/message';
import { IconName } from '../../icons/icon-glyphs';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';

/** Data of `cc-period-panel`. */
export interface PeriodPanelData {
  readonly period: Period;
  readonly settings: PeriodSettings;
  readonly today: IsoDate;
}

type PeriodOption = 'today' | 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface OptionRow {
  readonly value: PeriodOption;
  readonly label: string;
  readonly icon: IconName;
  /** Range of the option right now, e.g. "1 nov – 30 nov". */
  readonly detail: string;
}

const TEXT = {
  title: 'Periodo',
  day: 'Día',
  from: 'Desde',
  to: 'Hasta',
  apply: 'Aplicar',
  invalidRange: 'La fecha final no puede ser anterior a la inicial.',
  invalidDate: 'Elige una fecha.',
} as const;

const OPTIONS: readonly { value: PeriodOption; label: string; icon: IconName }[] = [
  { value: 'today', label: 'Hoy', icon: 'today' },
  { value: 'day', label: 'Día específico', icon: 'event' },
  { value: 'week', label: 'Semana', icon: 'date_range' },
  { value: 'month', label: 'Mes', icon: 'calendar_month' },
  { value: 'year', label: 'Año', icon: 'calendar_today' },
  { value: 'all', label: 'Siempre', icon: 'all_inclusive' },
  { value: 'custom', label: 'Rango personalizado', icon: 'tune' },
];

/**
 * The options of the global period selector (spec §4.5): today, a specific day, the current week,
 * month or year, "Siempre" and a custom range. Dates are picked inline because a sheet never opens
 * another. Closes with the chosen period.
 */
@Component({
  selector: 'cc-period-panel',
  imports: [OverlayPanel, Icon, DateField, Button, Message],
  templateUrl: './period-panel.html',
  styleUrl: './period-panel.scss',
})
export class PeriodPanel {
  protected readonly data = inject<PeriodPanelData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<Period>>(OverlayHandle);

  protected readonly text = TEXT;
  /** The option whose dates are being picked. */
  protected readonly expanded = signal<'day' | 'custom' | null>(null);
  protected readonly day = signal<IsoDate>(
    this.data.period.kind === 'day' ? this.data.period.anchor : this.data.today,
  );
  protected readonly start = signal<IsoDate>(
    this.data.period.kind === 'custom' ? this.data.period.start : addDays(this.data.today, -6),
  );
  protected readonly end = signal<IsoDate>(
    this.data.period.kind === 'custom' ? this.data.period.end : this.data.today,
  );
  protected readonly error = signal<string | null>(null);

  protected readonly selected: PeriodOption = this.currentOption(this.data.period);

  protected readonly options = computed<OptionRow[]>(() =>
    OPTIONS.map((option) => ({ ...option, detail: this.detail(option.value) })),
  );

  protected choose(option: PeriodOption): void {
    this.error.set(null);
    if (option === 'day' || option === 'custom') {
      this.expanded.set(this.expanded() === option ? null : option);
      return;
    }
    if (option === 'today') {
      this.handle.close({ kind: 'day', anchor: this.data.today });
    } else if (option === 'all') {
      this.handle.close({ kind: 'all' });
    } else {
      this.handle.close(periodContaining(option, this.data.today, this.data.settings));
    }
  }

  protected applyDay(): void {
    if (!isIsoDate(this.day())) {
      this.error.set(TEXT.invalidDate);
      return;
    }
    this.handle.close({ kind: 'day', anchor: this.day() });
  }

  protected applyRange(): void {
    const [start, end] = [this.start(), this.end()];
    if (!isIsoDate(start) || !isIsoDate(end)) {
      this.error.set(TEXT.invalidDate);
      return;
    }
    if (end < start) {
      this.error.set(TEXT.invalidRange);
      return;
    }
    this.handle.close({ kind: 'custom', start, end });
  }

  protected close(): void {
    this.handle.close();
  }

  private currentOption(period: Period): PeriodOption {
    if (period.kind === 'day') {
      return period.anchor === this.data.today ? 'today' : 'day';
    }
    return period.kind satisfies PeriodKind;
  }

  private detail(option: PeriodOption): string {
    const { settings, today } = this.data;
    switch (option) {
      case 'today':
        return periodRangeText({ kind: 'day', anchor: today }, settings, today);
      case 'week':
      case 'month':
      case 'year':
        return periodRangeText(
          periodContaining(option as AnchoredPeriodKind, today, settings),
          settings,
          today,
        );
      case 'day':
        return this.data.period.kind === 'day' && this.selected === 'day'
          ? periodRangeText(this.data.period, settings, today)
          : '';
      case 'custom':
        return this.data.period.kind === 'custom'
          ? periodRangeText(this.data.period, settings, today)
          : '';
      case 'all':
        return '';
    }
  }
}
