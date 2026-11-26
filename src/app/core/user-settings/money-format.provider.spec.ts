import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_MONEY_FORMAT } from '../../domain/money/number-format';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { UserSettings } from '../spaces/space.models';
import { provideMoneyFormat } from './money-format.provider';
import { UserSettingsService } from './user-settings.service';

describe('provideMoneyFormat', () => {
  const settings = signal<UserSettings | null>(null);

  beforeEach(() => {
    settings.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideMoneyFormat(),
        { provide: UserSettingsService, useValue: { settings: settings.asReadonly() } },
      ],
    });
  });

  it('uses the default format until the settings load', () => {
    expect(TestBed.inject(MONEY_FORMAT)()).toEqual(DEFAULT_MONEY_FORMAT);
  });

  it('follows the user preferences', () => {
    const format = TestBed.inject(MONEY_FORMAT);
    settings.set({
      user_id: 'u',
      theme: 'system',
      number_format: 'dot_comma',
      show_decimals: false,
      home_screen: 'categories',
      last_space_id: null,
    });
    expect(format()).toEqual({ numberFormat: 'dot_comma', showDecimals: false });
  });
});
