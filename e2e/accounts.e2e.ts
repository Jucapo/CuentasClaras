import { expect, Page, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
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
  // Only the everyday accounts count in the total: 350,000 + 2,543,000 + 48,900.50. In one currency
  // it is the header's, so the list has no total row of its own (spec §7).
  await expect(page.locator('cc-app-shell .total-value')).toContainText('$ 2,941,900.50');
  await expect(page.locator('cc-account-list .summary')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Tarjeta Visa/ })).toContainText('-$ 1,850,000.00');
  await expect(page.getByRole('link', { name: /Bancolombia/ })).toContainText('Predeterminada');
  await expect(page.getByRole('link', { name: /Nequi/ })).toContainText('Privada');

  await page.getByRole('button', { name: 'Nueva cuenta' }).first().click();
  const chooser = overlay(page, isMobile);
  await expect(chooser.getByRole('heading', { name: '¿Qué vas a crear?' })).toBeVisible();
  for (const choice of ['Cuenta', 'Ahorro', 'Deuda', 'Me deben']) {
    await expect(chooser.getByRole('button', { name: new RegExp(`^${choice}`) })).toBeVisible();
  }
  await chooser.getByRole('button', { name: /^Deuda/ }).click();

  await expect(page).toHaveURL(/\/cuentas\/nueva\?grupo=deuda$/);
  await expect(page.getByRole('heading', { name: 'Nueva deuda' })).toBeVisible();
  // Creating puts the cursor in the name.
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused();
  await page.getByLabel('Nombre', { exact: true }).fill('Tarjeta Master');
  await expect(page.getByRole('button', { name: /^Tipo/ })).toContainText('Tarjeta de crédito');

  // Spec §13.3: "Sugeridos" goes first, from the words of the name and the account context.
  await page.getByRole('button', { name: /^Cambiar ícono y color/ }).click();
  const icons = overlay(page, isMobile);
  const suggested = icons.locator('section[data-group="suggested"]');
  await expect(suggested.getByRole('heading', { name: 'Sugeridos' })).toBeVisible();
  await expect(suggested.getByRole('button').first()).toHaveAccessibleName(/^Tarjeta/);
  await expect(suggested.getByRole('button', { name: 'Banco', exact: true })).toBeVisible();
  await icons.getByRole('button', { name: 'Cerrar' }).click();
  await expect(icons).toBeHidden();

  // Spec §13.5: the balance is typed in its row; touching the row focuses it with the numeric keyboard.
  const balanceRow = page.locator('cc-money-row').filter({ hasText: 'Lo que debes' });
  const balance = page.getByRole('textbox', { name: 'Lo que debes' });
  await balanceRow.click({ position: { x: 12, y: 12 } });
  await expect(balance).toBeFocused();
  await expect(balance).toHaveAttribute('inputmode', 'decimal');
  await balance.fill('1250000.5');
  await expect(balanceRow.getByText('Escríbelo en positivo')).toBeVisible();
  await balance.press('Enter');
  await expect(balance).not.toBeFocused();
  // Leaving the row shows the amount with its grouping and decimals.
  await expect(balance).toHaveValue('1,250,000.50');

  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/cuentas$/);
  const created = api.writes().find((write) => write.table === 'accounts');
  expect(created?.method).toBe('POST');
  expect(created?.body).toMatchObject({
    name: 'Tarjeta Master',
    kind: 'credit_card',
    initial_balance: -125000050,
    include_in_total: false,
    icon: 'credit_card',
    color: 'red',
    visibility: 'shared',
  });
  await expect(page.getByRole('link', { name: /Tarjeta Master/ })).toContainText('-$ 1,250,000.50');
});

test(
  'an account gets a new color and becomes the default one',
  { tag: '@desktop' },
  async ({ page, isMobile }) => {
    const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
    await page.goto('/cuentas');
    await page.getByRole('link', { name: /Efectivo/ }).click();
    await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);
    await page.getByRole('link', { name: 'Editar cuenta' }).click();

    await expect(page).toHaveURL(/\/cuentas\/acc-cash\/editar$/);
    // The name is already large in the field: the bar says what the screen does (spec §13.5).
    await expect(page.getByRole('heading', { name: 'Editar cuenta', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Efectivo');
    // Editing an existing account: back instead of close, and no cursor in the name.
    await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).not.toBeFocused();

    await page.getByRole('button', { name: /^Cambiar ícono y color/ }).click();
    const picker = overlay(page, isMobile);
    await expect(picker.getByRole('heading', { name: 'Ícono y color' })).toBeVisible();
    await picker.getByRole('tab', { name: 'Color' }).click();
    await picker.getByRole('button', { name: 'Morado', exact: true }).click();
    // The ✓ confirms; on a keyboard, Ctrl/⌘+S does too.
    if (isMobile) {
      await picker.getByRole('button', { name: 'Listo' }).click();
    } else {
      await page.keyboard.press('Control+s');
    }
    await expect(picker).toBeHidden();
    await expect(page.getByRole('button', { name: /^Cambiar ícono y color/ })).toHaveAccessibleName(
      /Morado/,
    );

    await page.getByRole('switch', { name: 'Cuenta predeterminada' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();

    // Saving goes back to the account's detail.
    await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);
    const saved = api.writes().find((write) => write.table === 'accounts');
    expect(saved).toMatchObject({
      method: 'PATCH',
      body: expect.objectContaining({ color: 'purple' }),
    });
    expect(api.rpcCalls('set_default_account')).toEqual([
      { target_space_id: '00000000-0000-4000-8000-00000000005e', target_account_id: 'acc-cash' },
    ]);
    await page.goto('/cuentas');
    await expect(page.getByRole('link', { name: /Efectivo/ })).toContainText('Predeterminada');
  },
);
