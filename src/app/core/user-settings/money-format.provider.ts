import { computed, inject, Provider } from '@angular/core';
import { DEFAULT_MONEY_FORMAT, MoneyFormatOptions } from '../../domain/money/number-format';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { UserSettingsService } from './user-settings.service';

/** Binds the design system's MONEY_FORMAT to the signed-in user's number format preferences. */
export function provideMoneyFormat(): Provider {
  return {
    provide: MONEY_FORMAT,
    useFactory: () => {
      const userSettings = inject(UserSettingsService);
      return computed<MoneyFormatOptions>(() => {
        const settings = userSettings.settings();
        return settings
          ? { numberFormat: settings.number_format, showDecimals: settings.show_decimals }
          : DEFAULT_MONEY_FORMAT;
      });
    },
  };
}
