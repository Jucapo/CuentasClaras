import { Component, computed, inject, input } from '@angular/core';
import { NetWorthFigures } from '../../../../domain/accounts/net-worth';
import { CurrencyAmount, formatMoney } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { MONEY_FORMAT } from '../../money/money-format';
import { ListItem } from '../../molecules/list-item/list-item';
import { StatGroup, StatItem } from '../../molecules/stat-group/stat-group';

/** A group of accounts in "Mis finanzas", e.g. Ahorros with its balance per currency. */
export interface NetWorthGroupView {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly color: string | null;
  /** Per currency; debts go positive, as what is owed. */
  readonly totals: readonly CurrencyAmount[];
  /** In the main currency. */
  readonly converted: number;
  /** Whether it is what is owed rather than an asset. */
  readonly debt: boolean;
}

/** Figures of one currency on its own. */
export type NetWorthCurrency = NetWorthFigures & { readonly currency: string };

const NET_WORTH_TEXT = {
  summary: 'Patrimonio',
  assets: 'Activos',
  debts: 'Deudas',
  net: 'Neto',
  byCurrency: 'Por moneda',
} as const;

/**
 * "Mis finanzas" (spec §6, §7): assets against debts and the net, consolidated in the main
 * currency; then each group with its balance per currency, and each currency on its own when there
 * is more than one.
 */
@Component({
  selector: 'cc-net-worth',
  imports: [Amount, IconBadge, ListItem, StatGroup],
  templateUrl: './net-worth.html',
  styleUrl: './net-worth.scss',
})
export class NetWorthPanel {
  readonly figures = input.required<NetWorthFigures>();
  readonly groups = input.required<readonly NetWorthGroupView[]>();
  readonly byCurrency = input<readonly NetWorthCurrency[]>([]);
  /** The main currency, of the consolidated figures. */
  readonly currency = input.required<string>();

  private readonly format = inject(MONEY_FORMAT);
  protected readonly text = NET_WORTH_TEXT;

  protected readonly summary = computed<StatItem[]>(() => {
    const { assets, debts, net } = this.figures();
    const currency = this.currency();
    return [
      { label: NET_WORTH_TEXT.assets, amount: assets, currency },
      { label: NET_WORTH_TEXT.debts, amount: debts, currency },
      { label: NET_WORTH_TEXT.net, amount: net, currency, tone: 'auto' },
    ];
  });
  /** Assets, then debts; a section without groups is left out. */
  protected readonly sections = computed(() =>
    [
      { title: NET_WORTH_TEXT.assets, rows: this.groups().filter((group) => !group.debt) },
      { title: NET_WORTH_TEXT.debts, rows: this.groups().filter((group) => group.debt) },
    ].filter((section) => section.rows.length > 0),
  );

  /** Balances in other currencies, shown under the converted one. */
  protected foreign(group: NetWorthGroupView): CurrencyAmount[] {
    return group.totals.filter((total) => total.currency !== this.currency());
  }

  protected currencyLine(row: NetWorthCurrency): string {
    const money = (amount: number) => formatMoney(amount, row.currency, this.format());
    return `${NET_WORTH_TEXT.assets} ${money(row.assets)} · ${NET_WORTH_TEXT.debts} ${money(row.debts)}`;
  }
}
