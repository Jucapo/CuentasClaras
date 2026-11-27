import { expect, Locator, Page, test } from '@playwright/test';
import { HOUSEHOLD_WITH_BUDGETS, HOUSEHOLD_WITH_MOVEMENTS } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

/** Thursday 26 November 2026: the fixture's movements fall in the period of November. */
const TODAY = new Date('2026-11-26T12:00:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
  await seedSession(page);
});

function movements(page: Page): Locator {
  return page.getByRole('region', { name: 'Movimientos' });
}

/** 🔍 in the header shows the search (spec §7). */
async function openSearch(page: Page): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: 'Buscar' }).click();
}

/** The quick entry: a sheet on phones, beside the list on wide screens (spec §7). */
function quickEntry(page: Page, isMobile: boolean): Locator {
  return isMobile ? page.locator('.mat-bottom-sheet-container') : page.locator('cc-quick-entry');
}

/** A confirmation: a sheet on phones, a dialog elsewhere. */
function confirmation(page: Page, isMobile: boolean): Locator {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

test('lists the movements of the period by day with the totals of what is shown', async ({
  page,
}) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');

  const list = movements(page);
  await expect(list.getByRole('heading', { name: 'Ayer' })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Mercado/ })).toContainText('Bancolombia');
  await expect(list.getByRole('button', { name: /^Hogar \(Arriendo\)/ })).toContainText('Fijos');

  const totals = page.getByRole('group', { name: 'Totales de lo que se ve' });
  await expect(totals).toContainText('+$ 6,500,000.00');
  await expect(totals).toContainText('-$ 2,145,500.00');
  await expect(totals).toContainText('+$ 4,354,500.00');
  await expect(totals).not.toContainText('fuera del espacio');
  await capture(page, 'transacciones');
});

test('the totals add up the accounts outside the space and say how much', async ({ page }) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/transacciones');

  // Nequi is private and its movement is not included in the space (spec §7).
  await expect(
    movements(page)
      .getByRole('button', { name: /^Mercado/ })
      .filter({ hasText: 'Nequi' }),
  ).toContainText('$ 45,000.00');
  const totals = page.getByRole('group', { name: 'Totales de lo que se ve' });
  await expect(totals).toContainText('-$ 2,490,500.00');
  await expect(totals).toContainText('Incluye $ 45,000.00 de cuentas fuera del espacio');
  await capture(page, 'transacciones-fuera-del-espacio');

  // Without that account, nothing comes from outside the space.
  await openSearch(page);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('Bancolombia');
  await expect(totals).toContainText('-$ 2,420,500.00');
  await expect(totals).not.toContainText('fuera del espacio');
});

test('each day shows its net, and the balances open and close the period', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);

  // The net of each day, whatever part of the list is loaded (spec §7).
  await expect(list.getByRole('heading', { name: /^Ayer/ })).toContainText('+$ 6,500,000.00');
  await expect(list.getByRole('heading', { name: /^Martes 24 nov/ })).toContainText('-$ 25,000.00');
  // "Categoría (Subcategoría)", the account and the note on its own line.
  const market = list.getByRole('button', { name: /^Mercado/ });
  await expect(market).toContainText('Bancolombia');
  await expect(market).toContainText('Mercado de la semana');

  // At the close of 31 oct and of today, of the accounts of the header total.
  const balances = page.getByRole('group', { name: 'Saldos del periodo' });
  await expect(balances).toContainText('$ 2,941,900.50');
  await expect(balances).toContainText('$ 7,296,400.50');
  expect(api.rpcCalls('accounts_balance')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ on_date: '2026-10-31', account_ids: [] }),
      expect.objectContaining({ on_date: '2026-11-26', account_ids: [] }),
    ]),
  );
  await capture(page, 'transacciones-saldos');

  // With an account filter, those accounts.
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('checkbox', { name: 'Efectivo' }).click();
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(balances).toContainText('$ 325,000.00');
  expect(api.rpcCalls('accounts_balance').at(-1)).toMatchObject({ account_ids: ['acc-cash'] });

  // Another filter says nothing about a balance.
  await page.getByRole('button', { name: 'Tipo' }).click();
  await page.getByRole('checkbox', { name: 'Gasto' }).click();
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByRole('button', { name: 'Tipo: Gasto' })).toBeVisible();
  await expect(balances).toHaveCount(0);
});

test('searches and filters with chips that say what is on', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);
  await expect(list.getByRole('button', { name: /^Salario/ })).toBeVisible();

  // Without accents or case, like the database (spec §7). The search opens from the header.
  await openSearch(page);
  await expect(page.getByRole('searchbox', { name: 'Buscar' })).toBeFocused();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('SEMANA');
  await expect(list.getByRole('button')).toHaveCount(1);
  await expect(list.getByRole('button', { name: /^Mercado/ })).toBeVisible();
  expect(api.rpcCalls('search_transactions').at(-1)).toMatchObject({ search_terms: ['semana'] });
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('');

  await page.getByRole('button', { name: 'Tipo' }).click();
  await page.getByRole('checkbox', { name: 'Ingreso' }).click();
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByRole('button', { name: 'Tipo: Ingreso' })).toBeVisible();
  await expect(list.getByRole('button')).toHaveCount(1);
  expect(api.rpcCalls('transaction_totals').at(-1)).toMatchObject({ filter_types: ['income'] });
  await expect(page.getByRole('group', { name: 'Totales de lo que se ve' })).toContainText(
    '+$ 6,500,000.00',
  );
  await capture(page, 'transacciones-filtros');

  await page.getByRole('button', { name: 'Quitar filtro Tipo' }).click();
  await expect(list.getByRole('button', { name: /^Mercado/ })).toBeVisible();
});

test('a movement opens in the quick entry, beside the list on wide screens', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);

  await list.getByRole('button', { name: /^Mercado/ }).click();
  const entry = quickEntry(page, isMobile);
  await expect(entry.getByRole('heading', { name: 'Mercado' })).toBeVisible();
  await expect(entry.locator('cc-amount-display')).toContainText('$ 320,500.00');
  await captureViewport(page, 'transacciones-editar');

  // Adds 10,000 and saves. In a sheet the keypad shows once the amount is touched (spec §7).
  if (isMobile) {
    await expect(entry.locator('[data-key="submit"]')).toHaveCount(0);
    await expect(entry.getByRole('group', { name: 'Acciones del movimiento' })).toBeVisible();
    await captureViewport(page, 'registro-rapido-editar');
    await entry.getByRole('button', { name: /^Gasto/ }).click();
    for (const key of ['plus', '1', '0', '000']) {
      await entry.locator(`[data-key="${key}"]`).click();
    }
    await entry.locator('[data-key="submit"]').click();
  } else {
    await expect(entry.locator(':focus')).toHaveCount(1);
    await page.keyboard.type('+10000');
    await page.keyboard.press('Enter');
  }
  await expect(entry).toBeHidden();
  expect(api.rpcCalls('save_transaction')).toEqual([
    expect.objectContaining({ target_id: 'tx-market', entry_amount: 33_050_000 }),
  ]);
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
});

test('leaving a movement with unsaved changes in the pane asks first', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The pane only exists in the expanded window class.');
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);

  await list.getByRole('button', { name: /^Mercado/ }).click();
  const entry = quickEntry(page, isMobile);
  await expect(entry.locator(':focus')).toHaveCount(1);
  await page.keyboard.type('+1');

  await list.getByRole('button', { name: /^Salario/ }).click();
  const confirm = confirmation(page, isMobile);
  await expect(confirm.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Descartar' }).click();
  await expect(entry.getByRole('heading', { name: 'Salario' })).toBeVisible();

  // Without changes, Esc closes it at once.
  await expect(entry.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(entry).toBeHidden();
  await expect(
    page.getByText('Elige un movimiento para editarlo, o registra uno nuevo.'),
  ).toBeVisible();
});

test('a movement is deleted after confirming', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);

  await list.getByRole('button', { name: /^Transporte/ }).click();
  const entry = quickEntry(page, isMobile);
  // The question is a view of the same entry (spec §13.5).
  await entry.getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(entry.getByRole('heading', { name: '¿Eliminar este movimiento?' })).toBeVisible();
  await entry.getByRole('button', { name: 'Eliminar' }).click();

  await expect(list.getByRole('button', { name: /^Transporte/ })).toHaveCount(0);
  expect(api.writes()).toContainEqual(
    expect.objectContaining({ method: 'DELETE', table: 'transactions' }),
  );
});
