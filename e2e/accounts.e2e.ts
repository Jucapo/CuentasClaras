import { expect, Page, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean) {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

test('accounts are grouped and a new debt is created from "¿Qué vas a crear?"', async ({
  page,
  isMobile,
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

  await page.getByRole('button', { name: 'Nueva cuenta' }).first().click();
  const chooser = overlay(page, isMobile);
  await expect(chooser.getByRole('heading', { name: '¿Qué vas a crear?' })).toBeVisible();
  for (const choice of ['Cuenta', 'Ahorro', 'Deuda', 'Me deben']) {
    await expect(chooser.getByRole('button', { name: new RegExp(`^${choice}`) })).toBeVisible();
  }
  await captureViewport(page, 'cuenta-que-crear');
  await chooser.getByRole('button', { name: /^Deuda/ }).click();

  await expect(page).toHaveURL(/\/cuentas\/nueva\?grupo=deuda$/);
  await expect(page.getByRole('heading', { name: 'Nueva deuda' })).toBeVisible();
  // Creating puts the cursor in the name.
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused();
  await page.getByLabel('Nombre', { exact: true }).fill('Tarjeta Master');
  await expect(page.getByRole('button', { name: /^Tipo/ })).toContainText('Tarjeta de crédito');

  await page.getByRole('button', { name: /^Lo que debes/ }).click();
  const balance = overlay(page, isMobile);
  await expect(balance.getByRole('textbox', { name: 'Lo que debes' })).toBeFocused();
  await balance.getByRole('textbox', { name: 'Lo que debes' }).fill('1,250,000');
  await expect(balance.getByText('Escríbelo en positivo')).toBeVisible();
  await captureViewport(page, 'cuenta-saldo');
  await balance.getByRole('button', { name: 'Listo' }).click();
  await expect(balance).toBeHidden();
  await expect(page.getByRole('button', { name: /^Lo que debes/ })).toContainText('$ 1,250,000.00');
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

test('an account gets a new color and becomes the default one', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/cuentas');
  await page.getByRole('link', { name: /Efectivo/ }).click();

  await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);
  await expect(page.getByRole('heading', { name: 'Efectivo', level: 1 })).toBeVisible();
  // Editing an existing account: back instead of close, and no cursor in the name.
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).not.toBeFocused();
  await capture(page, 'cuenta-editar');

  await page.getByRole('button', { name: /^Cambiar ícono y color/ }).click();
  const picker = overlay(page, isMobile);
  await expect(picker.getByRole('heading', { name: 'Ícono y color' })).toBeVisible();
  await picker.getByRole('tab', { name: 'Color' }).click();
  await picker.getByRole('button', { name: 'Morado' }).click();
  await captureViewport(page, 'cuenta-icono-color');
  await picker.getByRole('button', { name: 'Listo' }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('button', { name: /^Cambiar ícono y color/ })).toHaveAccessibleName(
    /Morado/,
  );

  await page.getByRole('switch', { name: 'Cuenta predeterminada' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/cuentas$/);
  const saved = api.writes().find((write) => write.table === 'accounts');
  expect(saved).toMatchObject({
    method: 'PATCH',
    body: expect.objectContaining({ color: 'purple' }),
  });
  expect(api.rpcCalls('set_default_account')).toEqual([
    { target_space_id: '00000000-0000-4000-8000-00000000005e', target_account_id: 'acc-cash' },
  ]);
  await expect(page.getByRole('link', { name: /Efectivo/ })).toContainText('Predeterminada');
});
