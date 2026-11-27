import { expect, Locator, Page, test } from '@playwright/test';
import { HOUSEHOLD_WITH_BUDGETS } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, RecordedWrite, seedSession } from './support/supabase';

/** Thursday 26 November 2026: the period is November, whose budgets the fixture sets. */
const TODAY = new Date('2026-11-26T12:00:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
  await seedSession(page);
});

/** A category's detail: a sheet on phones, beside the list on wide screens (spec §4.7). */
function detail(page: Page, isMobile: boolean): Locator {
  return isMobile ? page.locator('.mat-bottom-sheet-container') : page.locator('cc-budget-detail');
}

function overlay(page: Page, isMobile: boolean): Locator {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

function budgetWrites(writes: readonly RecordedWrite[]) {
  return writes
    .filter((write) => write.table === 'budgets')
    .map((write) => ({ method: write.method, body: write.body, query: write.query }));
}

test('lists each category with its total and opens its detail', async ({ page, isMobile }) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');

  // Hogar: its General and those of Arriendo and Servicios públicos, against everything spent.
  const home = page.getByRole('button', { name: /^Hogar/ });
  await expect(home).toContainText('$ 150,000.00');
  await expect(home).toContainText('$ 2,250,000.00');
  await expect(page.getByRole('progressbar', { name: 'Avance de Hogar' })).toHaveAttribute(
    'aria-valuenow',
    '93',
  );
  await capture(page, 'presupuesto');

  await home.click();
  const panel = detail(page, isMobile);
  await expect(panel.getByRole('textbox', { name: 'General' })).toHaveValue('200,000');
  await expect(panel.getByRole('textbox', { name: 'Arriendo' })).toHaveValue('1,800,000');
  // Servicios públicos went over by $ 50,000.
  await expect(panel.getByRole('listitem').filter({ hasText: 'Servicios públicos' })).toContainText(
    '$ 50,000.00',
  );
  await captureViewport(page, 'presupuesto-detalle');
});

test('edits only this month by default, keeping the next one as it was', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');
  await expect(page.getByRole('radio', { name: 'Solo noviembre' })).toBeChecked();

  await page.getByRole('button', { name: /^Hogar/ }).click();
  const rent = detail(page, isMobile).getByRole('textbox', { name: 'Arriendo' });
  await rent.fill('1,900,000');
  await rent.press('Enter');

  // December first keeps what was in force, then November changes.
  await expect.poll(() => budgetWrites(api.writes()).length).toBe(2);
  expect(budgetWrites(api.writes())).toEqual([
    expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        category_id: 'cat-rent',
        effective_from: '2026-12-01',
        amount: 180000000,
      }),
    }),
    expect.objectContaining({
      method: 'PATCH',
      body: expect.objectContaining({ amount: 190000000 }),
      query: expect.stringContaining('budget-rent'),
    }),
  ]);
});

test('"y los siguientes" saves from the month on', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');
  await page.getByRole('radio', { name: 'Noviembre y los siguientes' }).click();

  await page.getByRole('button', { name: /^Hogar/ }).click();
  const utilities = detail(page, isMobile).getByRole('textbox', { name: 'Servicios públicos' });
  await utilities.fill('300,000');
  await utilities.press('Enter');

  await expect.poll(() => budgetWrites(api.writes()).length).toBe(1);
  expect(budgetWrites(api.writes())[0]).toMatchObject({
    method: 'PATCH',
    body: expect.objectContaining({ amount: 30000000 }),
  });
});

test('the calculator multiplies the amount and saves the result', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');
  await page.getByRole('button', { name: /^Mercado/ }).click();
  await detail(page, isMobile).getByRole('button', { name: 'Calculadora de General' }).click();

  const calculator = overlay(page, isMobile);
  await expect(calculator.getByRole('heading', { name: 'Mercado › General' })).toBeVisible();
  await expect(calculator.locator('cc-amount-display')).toContainText('$ 1,200,000.00');
  // An operator works on the amount it opened with.
  await calculator.locator('[data-key="times"]').click();
  await calculator.locator('[data-key="2"]').click();
  await expect(calculator.locator('cc-amount-display')).toContainText('$ 2,400,000.00');
  await captureViewport(page, 'presupuesto-calculadora');
  await calculator.locator('[data-key="submit"]').click();

  await expect.poll(() => budgetWrites(api.writes()).length).toBe(2);
  expect(budgetWrites(api.writes()).at(-1)).toMatchObject({
    method: 'PATCH',
    body: expect.objectContaining({ amount: 240000000 }),
  });
});

test('"Ver transacciones" opens Transacciones filtered by the category', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');
  await page.getByRole('button', { name: /^Hogar/ }).click();
  await detail(page, isMobile).getByRole('button', { name: 'Ver transacciones' }).click();

  await expect(page).toHaveURL(/\/transacciones$/);
  await expect(page.getByRole('button', { name: 'Categoría: Hogar' })).toBeVisible();
  expect(api.rpcCalls('search_transactions').at(-1)).toMatchObject({
    filter_category_ids: ['cat-home'],
  });
});

test('"Quitar presupuesto" asks and leaves the category without one', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');
  await page.getByRole('button', { name: /^Hogar/ }).click();
  await detail(page, isMobile).getByRole('button', { name: 'Quitar presupuesto' }).click();

  const confirm = overlay(page, isMobile);
  await expect(
    confirm.getByRole('heading', { name: '¿Quitar el presupuesto de Hogar?' }),
  ).toBeVisible();
  await confirm.getByRole('button', { name: 'Quitar' }).click();

  // General, Arriendo and Servicios públicos, each keeping December as it was.
  await expect
    .poll(
      () =>
        budgetWrites(api.writes()).filter((write) =>
          JSON.stringify(write.body).includes('"amount":0'),
        ).length,
    )
    .toBe(3);
});

test('a year adds up its months without editing', async ({ page, isMobile }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cc-period', JSON.stringify({ kind: 'year' })),
  );
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS });
  await page.goto('/presupuesto');

  await expect(
    page.getByText('Suma los 12 meses. Para cambiar montos, elige un mes.'),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Solo noviembre' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Hogar/ }).click();
  await expect(detail(page, isMobile).getByRole('textbox')).toHaveCount(0);
  await captureViewport(page, 'presupuesto-anual');
});

test('budgets turned off show why, and the owner turns them on', async ({ page }) => {
  const api = await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_BUDGETS,
    space: { budgets_enabled: false },
  });
  await page.goto('/presupuesto');

  await expect(
    page.getByRole('heading', { name: 'Los presupuestos están apagados' }),
  ).toBeVisible();
  await capture(page, 'presupuesto-apagado');
  await page.getByRole('switch', { name: 'Mostrar presupuestos' }).click();

  await expect(page.getByRole('button', { name: /^Hogar/ })).toBeVisible();
  expect(api.settings()['budgets_enabled']).toBe(true);
});
