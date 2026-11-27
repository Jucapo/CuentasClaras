import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { todayIsoDate } from '../../domain/dates/local-date';
import { periodMonth } from '../../domain/periods/period-month';
import { SpaceService } from '../spaces/space.service';
import { spaceSettingsFixture } from '../spaces/space.testing';
import { Budget } from './budget.models';
import { BudgetsApi } from './budgets.api';
import { BudgetsService } from './budgets.service';

describe('BudgetsService', () => {
  const month = periodMonth(todayIsoDate(), 1);
  const rows: Budget[] = [];
  const api = {
    fetch: vi.fn(async () => ({ ok: true as const, value: rows })),
    create: vi.fn().mockResolvedValue({ ok: true }),
    update: vi.fn().mockResolvedValue({ ok: true }),
  };

  function budget(overrides: Partial<Budget>): Budget {
    return {
      id: 'budget-1',
      space_id: 'space-1',
      category_id: 'home',
      amount: 300000000,
      currency: 'COP',
      effective_from: month,
      created_at: '2026-11-01T00:00:00Z',
      ...overrides,
    };
  }

  async function setup(existing: Budget[] = []) {
    rows.splice(0, rows.length, ...existing);
    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetsApi, useValue: api },
        {
          provide: SpaceService,
          useValue: {
            activeSpace: signal({ id: 'space-1', name: 'Hogar', icon: 'home', color: 'green' }),
            activeSettings: signal(spaceSettingsFixture()),
          },
        },
      ],
    });
    const service = TestBed.inject(BudgetsService);
    // The resource loads from an effect: flush it until the rows arrive.
    await vi.waitFor(() => {
      TestBed.tick();
      expect(service.loaded()).toBe(true);
    });
    return service;
  }

  beforeEach(() => {
    api.create.mockClear();
    api.update.mockClear();
  });

  it('creates the amount of the current period', async () => {
    const service = await setup();

    await service.setMonthly('home', 250000000, 'COP');

    expect(api.create).toHaveBeenCalledWith({
      space_id: 'space-1',
      category_id: 'home',
      amount: 250000000,
      currency: 'COP',
      effective_from: month,
    });
  });

  it('changes the amount already set this period', async () => {
    const service = await setup([budget({})]);

    await service.setMonthly('home', 10000, 'USD');

    expect(api.update).toHaveBeenCalledWith('budget-1', 10000, 'USD');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('ends an older budget from this period on with 0', async () => {
    const service = await setup([budget({ effective_from: '2020-01-01' })]);

    await service.setMonthly('home', 0, 'COP');

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }));
  });

  it('writes nothing for 0 when there was no amount', async () => {
    const service = await setup();

    await service.setMonthly('home', 0, 'COP');

    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('saves an edit of only one month keeping the next month first', async () => {
    const service = await setup([budget({ effective_from: '2020-01-01' })]);

    await service.setAmount('home', 100, 'COP', '2026-10-01', 'month');

    const rows = api.create.mock.calls.map(
      (call) => call[0] as { effective_from: string; amount: number },
    );
    expect(rows.map((row) => [row.effective_from, row.amount])).toEqual([
      ['2026-11-01', 300000000],
      ['2026-10-01', 100],
    ]);
  });

  it('stops at the first failed row, so later months stay as they were', async () => {
    const service = await setup([budget({ effective_from: '2020-01-01' })]);
    api.create.mockResolvedValueOnce({ ok: false, message: 'Sin conexión.' });

    const result = await service.setAmount('home', 100, 'COP', '2026-10-01', 'month');

    expect(result).toEqual({ ok: false, message: 'Sin conexión.' });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('reads the amount in force and the totals per currency', async () => {
    const service = await setup([
      budget({ effective_from: '2020-01-01' }),
      budget({ id: 'budget-2', category_id: 'trips', amount: 50000, currency: 'USD' }),
    ]);

    expect(service.amountFor('home')?.amount).toBe(300000000);
    expect(service.totalsFor(['home', 'trips'])).toEqual([
      { currency: 'COP', amount: 300000000 },
      { currency: 'USD', amount: 50000 },
    ]);
  });
});
