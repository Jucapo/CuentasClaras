import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { IsoDate, isIsoDate, todayIsoDate } from '../../domain/dates/local-date';
import { periodRangeText, periodTitle } from '../../domain/periods/period-labels';
import {
  AnchoredPeriodKind,
  budgetMonths,
  canShiftPeriod,
  Period,
  periodContaining,
  PeriodKind,
  periodRange,
  PeriodSettings,
  shiftPeriod,
} from '../../domain/periods/periods';
import { PERIOD_STORAGE_KEY } from '../config/app.constants';
import { SPACE_DEFAULTS } from '../config/space.constants';
import { SpaceService } from '../spaces/space.service';

/** What a device remembers: the kind, plus the dates of a custom range. */
interface StoredPeriod {
  readonly kind: PeriodKind;
  readonly start?: IsoDate;
  readonly end?: IsoDate;
}

const ANCHORED_KINDS: readonly PeriodKind[] = ['day', 'week', 'month', 'year'];

function isAnchored(kind: PeriodKind): kind is AnchoredPeriodKind {
  return ANCHORED_KINDS.includes(kind);
}

/**
 * The global period selection (spec §4.5). The device remembers its kind: when the app opens, day,
 * week, month and year go back to the current one, while "Siempre" and custom ranges come back as
 * they were. Without anything remembered, the default period of the space applies.
 */
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly spaces = inject(SpaceService);
  private readonly window = inject(DOCUMENT).defaultView;

  /** Today's local date; refreshed when the app comes back to the foreground. */
  readonly today = signal(todayIsoDate());

  private readonly remembered = signal<StoredPeriod | null>(this.read());
  /** Picked or moved to in this visit; null follows today. */
  private readonly current = signal<Period | null>(this.restore(this.remembered()));

  /** Month start day and first day of the week of the active space. */
  readonly settings = computed<PeriodSettings>(() => {
    const settings = this.spaces.activeSettings();
    return {
      monthStartDay: settings?.month_start_day ?? SPACE_DEFAULTS.monthStartDay,
      weekStart: settings?.week_start ?? SPACE_DEFAULTS.weekStart,
    };
  });

  /** The selected period. */
  readonly period = computed<Period>(() => {
    const current = this.current();
    if (current) {
      return current;
    }
    const kind = this.remembered()?.kind ?? this.spaces.activeSettings()?.default_period ?? 'month';
    return isAnchored(kind)
      ? periodContaining(kind, this.today(), this.settings())
      : { kind: 'all' };
  });

  readonly range = computed(() => periodRange(this.period(), this.settings()));
  readonly title = computed(() => periodTitle(this.period(), this.settings(), this.today()));
  readonly rangeText = computed(() =>
    periodRangeText(this.period(), this.settings(), this.today()),
  );
  readonly budgetMonths = computed(() => budgetMonths(this.period(), this.settings()));
  readonly canShift = computed(() => canShiftPeriod(this.period()));

  constructor() {
    this.window?.document.addEventListener('visibilitychange', () => {
      if (this.window?.document.visibilityState === 'visible') {
        this.today.set(todayIsoDate());
      }
    });
  }

  /** Selects a period and remembers its kind on this device. */
  select(period: Period): void {
    this.current.set(period);
    this.remember(period);
  }

  /** The period before the selected one. */
  previous(): void {
    this.current.set(shiftPeriod(this.period(), -1, this.settings()));
  }

  /** The period after the selected one. */
  next(): void {
    this.current.set(shiftPeriod(this.period(), 1, this.settings()));
  }

  private restore(stored: StoredPeriod | null): Period | null {
    if (stored?.kind === 'all') {
      return { kind: 'all' };
    }
    if (stored?.kind === 'custom' && stored.start && stored.end) {
      return { kind: 'custom', start: stored.start, end: stored.end };
    }
    return null;
  }

  private remember(period: Period): void {
    const stored: StoredPeriod =
      period.kind === 'custom'
        ? { kind: 'custom', start: period.start, end: period.end }
        : { kind: period.kind };
    this.remembered.set(stored);
    try {
      this.window?.localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage may be blocked (private mode); the period then lasts for this visit.
    }
  }

  // Anything unreadable counts as nothing remembered.
  private read(): StoredPeriod | null {
    try {
      const raw = this.window?.localStorage.getItem(PERIOD_STORAGE_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (typeof value !== 'object' || value === null) {
        return null;
      }
      const { kind, start, end } = value as Record<string, unknown>;
      const kinds: readonly unknown[] = [...ANCHORED_KINDS, 'all', 'custom'];
      if (!kinds.includes(kind)) {
        return null;
      }
      if (kind === 'custom') {
        return typeof start === 'string' &&
          typeof end === 'string' &&
          isIsoDate(start) &&
          isIsoDate(end) &&
          start <= end
          ? { kind, start, end }
          : null;
      }
      return { kind: kind as PeriodKind };
    } catch {
      return null;
    }
  }
}
