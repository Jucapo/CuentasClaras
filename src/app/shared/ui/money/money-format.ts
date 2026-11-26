import { InjectionToken, Signal, signal } from '@angular/core';
import { DEFAULT_MONEY_FORMAT, MoneyFormatOptions } from '../../../domain/money/number-format';

/**
 * How amounts look for the current user (spec §4.6). Atoms read it instead of a data service; the
 * app binds it to the user settings and the catalog and tests get the default.
 */
export const MONEY_FORMAT = new InjectionToken<Signal<MoneyFormatOptions>>('MONEY_FORMAT', {
  factory: () => signal(DEFAULT_MONEY_FORMAT).asReadonly(),
});
