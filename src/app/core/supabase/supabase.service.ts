import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Database } from './database.types';

/** Single, app-wide Supabase client. */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabase.url,
    environment.supabase.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow on purpose: PKCE requires opening the email link in the same browser,
        // and on iOS the email opens Safari instead of the installed PWA.
        flowType: 'implicit',
      },
    },
  );
}
