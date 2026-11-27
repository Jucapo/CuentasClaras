import { netWorth, NetWorthRow } from './net-worth';

const rows: NetWorthRow[] = [
  { group: 'accounts', currency: 'COP', balance: 4_250_000, converted: 4_250_000 },
  { group: 'savings', currency: 'COP', balance: 40_000_000, converted: 40_000_000 },
  { group: 'savings', currency: 'USD', balance: 120_000, converted: 492_000 },
  { group: 'receivables', currency: 'COP', balance: 2_000_000, converted: 2_000_000 },
  { group: 'debts', currency: 'COP', balance: -31_800_000, converted: -31_800_000 },
];

describe('netWorth', () => {
  it('puts the assets against the debts, consolidated in the main currency', () => {
    expect(netWorth(rows, 'COP').consolidated).toEqual({
      assets: 46_742_000,
      debts: 31_800_000,
      net: 14_942_000,
    });
  });

  it('gives each group its balance per currency, with debts as what is owed', () => {
    expect(netWorth(rows, 'COP').groups).toEqual([
      { group: 'accounts', totals: [{ currency: 'COP', amount: 4_250_000 }], converted: 4_250_000 },
      {
        group: 'savings',
        totals: [
          { currency: 'COP', amount: 40_000_000 },
          { currency: 'USD', amount: 120_000 },
        ],
        converted: 40_492_000,
      },
      {
        group: 'receivables',
        totals: [{ currency: 'COP', amount: 2_000_000 }],
        converted: 2_000_000,
      },
      { group: 'debts', totals: [{ currency: 'COP', amount: 31_800_000 }], converted: 31_800_000 },
    ]);
  });

  it('adds up each currency on its own, the main one first', () => {
    expect(netWorth(rows, 'COP').byCurrency).toEqual([
      { currency: 'COP', assets: 46_250_000, debts: 31_800_000, net: 14_450_000 },
      { currency: 'USD', assets: 120_000, debts: 0, net: 120_000 },
    ]);
  });

  it('leaves a currency without a rate out of the consolidated figures and reports it', () => {
    const result = netWorth(
      [
        { group: 'accounts', currency: 'COP', balance: 1_000, converted: 1_000 },
        { group: 'savings', currency: 'EUR', balance: 500, converted: null },
      ],
      'COP',
    );
    expect(result.consolidated).toEqual({ assets: 1_000, debts: 0, net: 1_000 });
    expect(result.missingRateCurrencies).toEqual(['EUR']);
    expect(result.byCurrency.map((row) => row.currency)).toEqual(['COP', 'EUR']);
  });
});
