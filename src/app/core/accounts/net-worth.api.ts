import { inject, Injectable } from '@angular/core';
import { IsoDate } from '../../domain/dates/local-date';
import { NET_WORTH_GROUPS, NetWorthGroup, NetWorthRow } from '../../domain/accounts/net-worth';
import { actionFailed, DataResult } from '../action-result';
import { dataErrorMessage, LOAD_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';

function isNetWorthGroup(group: string): group is NetWorthGroup {
  return (NET_WORTH_GROUPS as readonly string[]).includes(group);
}

/** The `net_worth` RPC of "Mis finanzas" (security invoker: it follows RLS). */
@Injectable({ providedIn: 'root' })
export class NetWorthApi {
  private readonly client = inject(SupabaseService).client;

  /** Balances per group and currency of the accounts the user sees, converted on `onDate`. */
  async fetch(spaceId: string, onDate: IsoDate): Promise<DataResult<NetWorthRow[]>> {
    const { data, error, status } = await this.client.rpc('net_worth', {
      target_space_id: spaceId,
      on_date: onDate,
    });
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: (data ?? []).flatMap((row) =>
        // Assets have a manual value from the F2; the RPC leaves them out already.
        isNetWorthGroup(row.account_group)
          ? [
              {
                group: row.account_group,
                currency: row.currency,
                balance: row.balance,
                // RETURNS TABLE columns come typed as non-null even when they can be null.
                converted: (row.converted as number | null) ?? null,
              },
            ]
          : [],
      ),
    };
  }
}
