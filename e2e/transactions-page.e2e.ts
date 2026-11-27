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
  await expect(list.getByRole('button', { name: /^Hogar › Arriendo/ })).toContainText('Fijos');

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
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('Bancolombia');
  await expect(totals).toContainText('-$ 2,420,500.00');
  await expect(totals).not.toContainText('fuera del espacio');
});

test('searches and filters with chips that say what is on', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/transacciones');
  const list = movements(page);
  await expect(list.getByRole('button', { name: /^Salario/ })).toBeVisible();

  // Without accents or case, like the database (spec §7).
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

  // Adds 10,000 and saves.
  if (isMobile) {
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
  await entry.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = confirmation(page, isMobile);
  await expect(confirm.getByRole('heading', { name: '¿Eliminar este movimiento?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Eliminar' }).click();

  await expect(list.getByRole('button', { name: /^Transporte/ })).toHaveCount(0);
  expect(api.writes()).toContainEqual(
    expect.objectContaining({ method: 'DELETE', table: 'transactions' }),
  );
});
