import { Component, input } from '@angular/core';
import { CurrencyAmount } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { LinkCommands } from '../../atoms/button/button';
import { AccountRow } from '../../molecules/account-row/account-row';

/** An account as the list shows it. */
export interface AccountListItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  /** Stored balance in minor units (debts negative). */
  readonly balance: number;
  readonly currency: string;
  /** Short notes, e.g. "Privada · Predeterminada". */
  readonly notes?: string;
  readonly link?: LinkCommands;
  readonly archived?: boolean;
  /** Its detail is open next to the list. */
  readonly selected?: boolean;
}

/** A group of accounts (Cuentas, Ahorros, Deudas, Me deben) with its totals per currency. */
export interface AccountListGroup {
  readonly id: string;
  readonly label: string;
  readonly totals: readonly CurrencyAmount[];
  readonly accounts: readonly AccountListItem[];
}

/** Accounts grouped by kind, each group with its total per currency, plus an overall total. */
@Component({
  selector: 'cc-account-list',
  imports: [AccountRow, Amount],
  templateUrl: './account-list.html',
  styleUrl: './account-list.scss',
})
export class AccountList {
  readonly groups = input.required<readonly AccountListGroup[]>();
  /** Overall total per currency; hidden when empty. */
  readonly totals = input<readonly CurrencyAmount[]>([]);
  readonly totalLabel = input('Total');
}
