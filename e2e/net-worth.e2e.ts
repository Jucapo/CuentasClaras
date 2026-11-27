import { expect, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00'));
  await blockSupabase(page);
  await seedSession(page);
});

test('"Mis finanzas" puts the assets against the debts, and the tab stays on reload', async ({
  page,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/cuentas');
  await page.getByRole('tab', { name: 'Mis finanzas' }).click();
  await expect(page).toHaveURL(/\/cuentas\?vista=mis-finanzas$/);

  // Every visible account, also those outside the total; US$ 1,200 at 4,100.
  const summary = page.getByRole('group', { name: 'Patrimonio' });
  await expect(summary).toContainText('$ 8,661,900.50');
  await expect(summary).toContainText('$ 1,850,000.00');
  await expect(summary).toContainText('$ 6,811,900.50');
  const assets = page.getByRole('region', { name: 'Activos' });
  await expect(assets.getByRole('listitem').filter({ hasText: 'Ahorros' })).toContainText(
    'US$ 1,200.00',
  );
  await expect(page.getByRole('region', { name: 'Deudas' })).toContainText('$ 1,850,000.00');
  await expect(page.getByRole('region', { name: 'Por moneda' })).toContainText('USD');
  expect(api.rpcCalls('net_worth').at(-1)).toMatchObject({ on_date: '2026-11-26' });
  await capture(page, 'cuentas-mis-finanzas');

  await page.reload();
  await expect(page.getByRole('group', { name: 'Patrimonio' })).toContainText('$ 6,811,900.50');
});

test('a currency without a rate stays out of the net worth and asks for it', async ({ page }) => {
  await mockDataApi(page, { withSpace: true, catalog: { ...HOUSEHOLD, exchangeRates: [] } });
  await page.goto('/cuentas?vista=mis-finanzas');

  await expect(page.getByRole('group', { name: 'Patrimonio' })).toContainText('$ 3,741,900.50');
  await expect(page.getByText(/US\$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /tasa/i })).toBeVisible();
});
