import { expect, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

test('accounts are grouped with their totals and a new debt is saved as negative', async ({
  page,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/cuentas');

  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeVisible();
  for (const group of ['Cuentas', 'Ahorros', 'Deudas', 'Me deben']) {
    await expect(page.getByRole('heading', { name: group, level: 2 })).toBeVisible();
  }
  // Only the everyday accounts count in the total: 350,000 + 2,543,000 + 48,900.50.
  await expect(page.locator('.summary')).toContainText('$ 2,941,900.50');
  await expect(page.getByRole('link', { name: /Tarjeta Visa/ })).toContainText('-$ 1,850,000.00');
  await expect(page.getByRole('link', { name: /Bancolombia/ })).toContainText('Predeterminada');
  await expect(page.getByRole('link', { name: /Nequi/ })).toContainText('Privada');
  await capture(page, 'cuentas');

  await page.getByRole('link', { name: 'Nueva' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva cuenta' })).toBeVisible();
  await page.getByLabel('Nombre').fill('Tarjeta Master');
  await page.getByRole('combobox', { name: 'Tipo' }).click();
  await page.getByRole('option', { name: 'Tarjeta de crédito' }).click();
  await page.getByLabel('Lo que debes').fill('1,250,000');
  await expect(page.getByText('Escríbelo en positivo')).toBeVisible();
  await capture(page, 'cuenta-nueva');

  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/cuentas$/);
  const created = api.writes().find((write) => write.table === 'accounts');
  expect(created?.method).toBe('POST');
  expect(created?.body).toMatchObject({
    name: 'Tarjeta Master',
    kind: 'credit_card',
    initial_balance: -125000000,
    include_in_total: false,
    icon: 'credit_card',
    color: 'red',
    visibility: 'shared',
  });
  await expect(page.getByRole('link', { name: /Tarjeta Master/ })).toContainText('-$ 1,250,000.00');
});

test('an account becomes the default one', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/cuentas/acc-cash');

  await expect(page.getByRole('heading', { name: 'Efectivo' })).toBeVisible();
  await page.getByRole('switch', { name: 'Cuenta predeterminada' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/cuentas$/);
  expect(api.rpcCalls('set_default_account')).toEqual([
    { target_space_id: '00000000-0000-4000-8000-00000000005e', target_account_id: 'acc-cash' },
  ]);
  await expect(page.getByRole('link', { name: /Efectivo/ })).toContainText('Predeterminada');
});
