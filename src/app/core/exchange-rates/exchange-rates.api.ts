import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { ExchangeRate, ExchangeRateEntry } from './exchange-rate.models';

/** Supabase queries for the manual exchange rates of a space. */
@Injectable({ providedIn: 'root' })
export class ExchangeRatesApi {
  private readonly client = inject(SupabaseService).client;

  /** Rates of a space, newest first. */
  async fetch(spaceId: string): Promise<DataResult<ExchangeRate[]>> {
    const { data, error, status } = await this.client
      .from('exchange_rates')
      .select('*')
      .eq('space_id', spaceId)
      .order('date', { ascending: false });
    return error
      ? actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE))
      : { ok: true, value: data ?? [] };
  }

  /** Saves a rate; it replaces the one of the same pair and day, in either direction. */
  async save(spaceId: string, entry: ExchangeRateEntry): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('save_exchange_rate', {
      target_space_id: spaceId,
      rate_date: entry.date,
      base_currency: entry.base,
      quote_currency: entry.quote,
      rate_value: entry.rate,
    });
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  /** Deletes a rate. */
  async remove(id: string): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('exchange_rates')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }
}
