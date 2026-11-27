import { expect, Locator, Page, test } from '@playwright/test';
import { HOUSEHOLD_WITH_MOVEMENTS } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

/** Every test runs on Thursday 26 November 2026, inside the period of the fixture's movements. */
const TODAY = new Date('2026-11-26T12:00:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
  await seedSession(page);
});

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean): Locator {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

/** Types an amount: on the keypad on phones, with the physical keyboard elsewhere (spec §7). */
async function typeAmount(page: Page, sheet: Locator, isMobile: boolean, digits: string) {
  // Dialogs load on demand: wait until the focus is inside before typing.
  await expect(sheet.locator(':focus')).toHaveCount(1);
  if (isMobile) {
    for (const key of digits) {
      await sheet.locator(`[data-key="${key}"]`).click();
    }
  } else {
    await page.keyboard.type(digits);
  }
}

/** The ✓ of the keypad. */
function saveKey(sheet: Locator): Locator {
  return sheet.locator('[data-key="submit"]');
}

test('an expense takes three steps from its bubble and can be undone', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/categorias');

  // What was spent below, what remains of the budget above (spec §7).
  const market = page.getByRole('button', { name: /^Mercado/ });
  await expect(market).toHaveAccessibleName('Mercado, $ 320,500.00, quedan $ 879,500.00');
  await expect(page.locator('cc-donut')).toContainText('$ 2,145,500.00');
  await capture(page, 'inicio-con-montos');

  // 1 · the bubble, 2 · the amount, 3 · ✓.
  await market.click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Mercado' })).toBeVisible();
  await typeAmount(page, sheet, isMobile, '25000');
  await expect(sheet.locator('cc-amount-display')).toContainText('$ 25,000.00');
  await captureViewport(page, 'registro-rapido-gasto');
  await saveKey(sheet).click();

  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({
      entry_type: 'expense',
      entry_amount: 2_500_000,
      entry_category_id: 'cat-market',
      entry_account_id: 'acc-bank',
      entry_date: '2026-11-26',
      entry_installments: 1,
    }),
  ]);
  await expect(market).toHaveAccessibleName(/^Mercado, \$ 345,500\.00/);

  // "Deshacer" in the toast deletes what was just created (spec §4.2).
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect
    .poll(() => api.writes().filter((write) => write.table === 'transactions').length)
    .toBe(1);
  expect(api.writes().find((write) => write.table === 'transactions')).toMatchObject({
    method: 'DELETE',
  });
  await expect(market).toHaveAccessibleName(/^Mercado, \$ 320,500\.00/);
});

test('an expense adds and subtracts on the keypad', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The keypad is tapped on phones; the keyboard test covers wide screens.');
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/categorias');
  await page.getByRole('button', { name: /^Transporte/ }).click();
  const sheet = overlay(page, isMobile);
  for (const key of ['1', '2', '000', 'plus', '3', '5', '0', '0']) {
    await sheet.locator(`[data-key="${key}"]`).click();
  }
  await expect(sheet.locator('cc-amount-display')).toContainText('12,000 + 3,500');
  await expect(sheet.locator('cc-amount-display')).toContainText('$ 15,500.00');
  await saveKey(sheet).click();
  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({ entry_amount: 1_550_000, entry_category_id: 'cat-transport' }),
  ]);
});

test('an income is recorded from the Ingresos tab', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/categorias');
  await page.getByRole('tab', { name: 'Ingresos' }).click();

  const salary = page.getByRole('button', { name: /^Salario/ });
  await expect(salary).toHaveAccessibleName(/^Salario, \$ 6,500,000\.00/);
  await salary.click();
  const sheet = overlay(page, isMobile);
  await typeAmount(page, sheet, isMobile, '1500000');
  if (isMobile) {
    await saveKey(sheet).click();
  } else {
    // Everything with the keyboard: Enter saves.
    await page.keyboard.press('Enter');
  }

  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({
      entry_type: 'income',
      entry_amount: 150_000_000,
      entry_category_id: 'cat-salary',
    }),
  ]);
  await expect(salary).toHaveAccessibleName(/^Salario, \$ 8,000,000\.00/);
  await expect(page.getByText('Ingreso guardado.')).toBeVisible();
});

test('a transfer to another currency records both amounts', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/cuentas/acc-bank');

  await expect(page.getByRole('heading', { name: 'Bancolombia', level: 1 })).toBeVisible();
  await expect(page.getByRole('list').getByText('Hogar › Arriendo')).toBeVisible();
  await capture(page, 'cuenta-detalle');

  await page.getByRole('button', { name: 'Transferir' }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Transferencia' })).toBeVisible();
  await sheet.getByRole('combobox', { name: 'Hacia' }).click();
  await page.getByRole('option', { name: 'DollarApp' }).click();

  // Two amounts: what leaves in pesos and what arrives in dollars (spec §4.6).
  await sheet.getByRole('button', { name: /^Sale/ }).click();
  await typeAmount(page, sheet, isMobile, '410000');
  await sheet.getByRole('button', { name: /^Llega/ }).click();
  await typeAmount(page, sheet, isMobile, '100');
  await expect(sheet.getByRole('button', { name: /^Llega/ })).toContainText('US$ 100.00');
  await captureViewport(page, 'registro-rapido-transferencia');
  await saveKey(sheet).click();

  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({
      entry_type: 'transfer',
      entry_account_id: 'acc-bank',
      entry_to_account_id: 'acc-usd',
      entry_amount: 41_000_000,
      entry_to_amount: 10_000,
    }),
  ]);
  await expect(page.getByText('Transferencia a DollarApp')).toBeVisible();
});

test('a credit card purchase in installments stores them with their rate', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/categorias');
  await page.getByRole('button', { name: /^Hogar/ }).click();
  const sheet = overlay(page, isMobile);

  // Installments show only for credit cards (spec §5.1 c).
  await expect(sheet.getByRole('combobox', { name: 'Cuotas' })).toHaveCount(0);
  await sheet.getByRole('combobox', { name: 'Cuenta' }).click();
  await page.getByRole('option', { name: 'Tarjeta Visa' }).click();
  await sheet.getByRole('combobox', { name: 'Cuotas' }).click();
  await page.getByRole('option', { name: '3 cuotas', exact: true }).click();
  await expect(sheet.getByRole('textbox', { name: 'Tasa mensual' })).toHaveValue('0');
  await sheet.getByRole('option', { name: 'Arriendo' }).click();
  await sheet.locator('cc-amount-display').first().click();
  await typeAmount(page, sheet, isMobile, '900000');
  await captureViewport(page, 'registro-rapido-cuotas');
  await saveKey(sheet).click();

  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({
      entry_account_id: 'acc-card',
      entry_category_id: 'cat-rent',
      entry_amount: 90_000_000,
      entry_installments: 3,
      entry_monthly_rate: 0,
      // Arriendo brings its default tag.
      entry_tag_ids: ['tag-fixed'],
    }),
  ]);
});

test('an account is adjusted to its real balance', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/cuentas/acc-cash');
  // 350,000 at the start minus a 25,000 taxi.
  await expect(page.getByRole('region', { name: 'Saldo' })).toContainText('$ 325,000.00');

  await page.getByRole('button', { name: 'Ajustar al saldo real' }).click();
  const sheet = overlay(page, isMobile);
  const balance = sheet.getByRole('textbox', { name: 'Saldo según el banco' });
  await balance.fill('');
  await balance.pressSequentially('330000');
  // The amount is grouped while it is typed (spec §4.6).
  await expect(balance).toHaveValue('330,000');
  await sheet.getByRole('button', { name: 'Listo' }).click();

  await expect(sheet).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({
      entry_type: 'adjustment',
      entry_account_id: 'acc-cash',
      entry_adjustment_direction: 'increase',
      entry_amount: 500_000,
    }),
  ]);
  await expect(page.getByRole('region', { name: 'Saldo' })).toContainText('$ 330,000.00');
  await expect(page.getByText('Ajuste de saldo')).toBeVisible();
});

test('the period moves with the arrows and changes kind in its panel', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/categorias');
  const chip = page.getByRole('button', { name: /^Elegir periodo/ });
  await expect(chip).toContainText('Noviembre');
  await expect(chip).toContainText('1 nov – 30 nov');
  await expect(page.getByRole('button', { name: /^Mercado/ })).toHaveAccessibleName(
    /\$ 320,500\.00/,
  );

  await page.getByRole('button', { name: 'Periodo anterior' }).click();
  await expect(chip).toContainText('Octubre');
  await expect(page.getByRole('button', { name: /^Mercado/ })).toHaveAccessibleName(
    /^Mercado, \$ 0\.00/,
  );
  expect(api.rpcCalls('category_totals').at(-1)).toMatchObject({
    from_date: '2026-10-01',
    to_date: '2026-10-31',
    budget_months: ['2026-10-01'],
  });

  await chip.click();
  const panel = overlay(page, isMobile);
  await expect(panel.getByRole('heading', { name: 'Periodo' })).toBeVisible();
  await captureViewport(page, 'periodo-opciones');
  await panel.getByRole('button', { name: /^Año/ }).click();
  await expect(panel).toBeHidden();
  await expect(chip).toContainText('2026');
  expect(api.rpcCalls('category_totals').at(-1)).toMatchObject({
    from_date: '2026-01-01',
    to_date: '2026-12-31',
  });

  // The device remembers the kind, and the year comes back as the current one.
  await page.reload();
  await expect(chip).toContainText('2026');
});
