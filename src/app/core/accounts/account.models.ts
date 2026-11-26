import { Tables, TablesInsert, TablesUpdate } from '../supabase/database.types';

/** An account row with its computed balance (spec §4.1: balances are not stored). */
export type Account = Tables<'accounts'> & {
  /** Balance in minor units from `account_balances` (debts negative). */
  readonly balance: number;
};

/**
 * Columns a client sets when creating an account. `sort_order` is left to the database, which
 * appends the account; owner, id and timestamps are never chosen by the client.
 */
export type NewAccount = Omit<
  TablesInsert<'accounts'>,
  'id' | 'owner_id' | 'created_at' | 'archived_at' | 'account_group' | 'sort_order'
>;

/** Columns a client may change on an account. */
export type AccountPatch = Omit<
  TablesUpdate<'accounts'>,
  'id' | 'space_id' | 'owner_id' | 'created_at' | 'account_group'
>;
