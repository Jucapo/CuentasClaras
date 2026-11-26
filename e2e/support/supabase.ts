import { Page } from '@playwright/test';
import { environment } from '../../src/environments/environment.development';

/** Base URL of the Supabase instance the dev server talks to. */
export const SUPABASE_URL = environment.supabase.url;

/** Aborts every Supabase request, so smoke tests never depend on a running backend. */
export async function blockSupabase(page: Page): Promise<void> {
  await page.route(`${SUPABASE_URL}/**`, (route) => route.abort());
}
