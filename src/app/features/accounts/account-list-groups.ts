import { Account } from '../../core/accounts/account.models';
import { ACCOUNT_GROUP_LABELS } from '../../core/config/catalog.constants';
import { ACCOUNT_KIND_GROUP, groupAccounts } from '../../domain/accounts/account-kinds';
import { LinkCommands } from '../../shared/ui/atoms/button/button';
import {
  AccountListGroup,
  AccountListItem,
} from '../../shared/ui/organisms/account-list/account-list';

/** What the account list needs besides the accounts. */
export interface AccountListOptions {
  readonly mainCurrency: string;
  readonly defaultAccountId: string | null;
  readonly selectedId?: string | null;
  /**
   * Where each row leads, e.g. its screen under `/cuentas` or under the wizard; none when the
   * rows are picked instead (`cc-account-list` with `actionable`).
   */
  readonly linkFor?: (accountId: string) => LinkCommands;
}

/** Accounts grouped as in spec §4.1 with their totals, as `cc-account-list` shows them. */
export function toAccountListGroups(
  accounts: readonly Account[],
  options: AccountListOptions,
): AccountListGroup[] {
  return groupAccounts(accounts, options.mainCurrency).map((summary) => ({
    id: summary.group,
    label: ACCOUNT_GROUP_LABELS[summary.group],
    totals: summary.totals,
    accounts: summary.accounts.map((account) => toAccountListItem(account, options)),
  }));
}

function toAccountListItem(account: Account, options: AccountListOptions): AccountListItem {
  const notes = [
    account.visibility === 'private' ? 'Privada' : null,
    account.id === options.defaultAccountId ? 'Predeterminada' : null,
    // Only the Accounts group counts by default, so only an exception there is worth noting.
    ACCOUNT_KIND_GROUP[account.kind] === 'accounts' && !account.include_in_total
      ? 'No suma en el total'
      : null,
  ].filter(Boolean);
  return {
    id: account.id,
    name: account.name,
    icon: account.icon,
    color: account.color,
    balance: account.balance,
    currency: account.currency,
    notes: notes.join(' · ') || undefined,
    link: options.linkFor?.(account.id),
    archived: !!account.archived_at,
    selected: account.id === options.selectedId,
  };
}
