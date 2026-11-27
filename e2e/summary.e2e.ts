import { expect, test } from '@playwright/test';
import { HOUSEHOLD_FOR_SUMMARY } from './support/catalog-fixture';
import { capture } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

/** Thursday 26 November 2026: November is in progress, so it compares with 1 oct – 26 oct. */
const TODAY = new Date('2026-11-26T12:00:00');

test.beforeEach(async ({ page }) => {
  // The chart draws without animation, so screenshots show it whole.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
  await seedSession(page);
});

test('sums up the period with the savings rate and the comparison up to the same day', async ({
  page,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_FOR_SUMMARY });
  await page.goto('/resumen');

  // $ 6,500,000 in, $ 2,575,500 out: $ 3,924,500 saved, 60 % of the incomes.
  await expect(page.getByText('+$ 3,924,500.00')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Tasa de ahorro: 60 %' })).toBeVisible();

  const cards = page.getByRole('radiogroup', { name: 'Qué mostrar' });
  const expenses = cards.getByRole('radio', { name: /^Gastos/ });
  await expect(expenses).toBeChecked();
  await expect(expenses).toContainText('$ 2,575,500.00');
  // October up to the 26th: $ 2,300,000, without what came on the 29th.
  await expect(expenses).toContainText('▲ 12 % vs. 1 oct – 26 oct');
  await expect(cards.getByRole('radio', { name: /^Ingresos/ })).toContainText(
    '▲ 8 % vs. 1 oct – 26 oct',
  );
  expect(api.rpcCalls('category_totals')).toContainEqual(
    expect.objectContaining({ from_date: '2026-10-01', to_date: '2026-10-26' }),
  );

  const chart = page.getByRole('img', {
    name: /^Gastos de Noviembre: \$ 2,575,500\.00; la mayor es Hogar/,
  });
  await expect(chart.locator('canvas')).toBeVisible();
  const averages = page.getByRole('group', { name: 'Promedios' });
  await expect(averages).toContainText('Día (prom.)');
  await expect(averages).toContainText('Mes');
  await capture(page, 'resumen');

  await cards.getByRole('radio', { name: /^Ingresos/ }).click();
  await expect(cards.getByRole('radio', { name: /^Ingresos/ })).toBeChecked();
  await expect(page.getByRole('list', { name: 'Ingresos por categoría' })).toContainText('Salario');
  await capture(page, 'resumen-ingresos');
});

test('lists the three largest categories, unfolds the rest and opens a subcategory', async ({
  page,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_FOR_SUMMARY });
  await page.goto('/resumen');

  const list = page.getByRole('list', { name: 'Gastos por categoría' });
  const rows = list.locator(':scope > li');
  await expect(rows.nth(0)).toContainText('Hogar');
  await expect(rows.nth(1)).toContainText('Mercado');
  await expect(rows.nth(2)).toContainText('Salud');
  // Ocio and Transporte go together under "Más…".
  const more = list.getByRole('button', { name: /^Más…/ });
  await expect(more).toContainText('$ 75,000.00');
  await expect(list.getByText('Ocio')).toHaveCount(0);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(list.getByText('Ocio')).toBeVisible();

  const home = list.getByRole('button', { name: /^Hogar/ });
  await home.click();
  await expect(home).toHaveAttribute('aria-expanded', 'true');
  await capture(page, 'resumen-categorias');
  await list.getByRole('button', { name: /^Arriendo/ }).click();

  await expect(page).toHaveURL(/\/transacciones$/);
  await expect(page.getByRole('button', { name: 'Categoría: Hogar › Arriendo' })).toBeVisible();
  expect(api.rpcCalls('search_transactions').at(-1)).toMatchObject({
    filter_category_ids: ['cat-rent'],
  });
});

test('shows the budget of the month and opens Presupuesto from it', async ({ page }) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_FOR_SUMMARY });
  await page.goto('/resumen');

  const budget = page.getByRole('region', { name: 'Presupuesto' });
  await expect(budget.getByRole('button', { name: /^Gastos/ })).toContainText('$ 3,450,000.00');
  await expect(budget.getByRole('button', { name: /^Ingresos/ })).toContainText('$ 6,000,000.00');
  await budget.getByRole('button', { name: /^Gastos/ }).click();
  await expect(page).toHaveURL(/\/presupuesto$/);
});

test('splits the movements by tag and by account', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_FOR_SUMMARY });
  await page.goto('/resumen');

  const byTag = page.getByRole('list', { name: 'Gastos por etiqueta' });
  await expect(byTag.getByRole('listitem').filter({ hasText: 'Fijos' })).toContainText(
    '$ 1,800,000.00',
  );
  await expect(byTag.getByRole('listitem').filter({ hasText: 'Sin etiqueta' })).toContainText(
    '$ 775,500.00',
  );
  // One member: no "Persona" tab.
  await expect(page.getByRole('tab', { name: 'Persona' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Cuenta' }).click();
  const byAccount = page.getByRole('list', { name: 'Gastos por cuenta' });
  await expect(byAccount.getByRole('listitem').filter({ hasText: 'Bancolombia' })).toContainText(
    '$ 2,500,500.00',
  );
  expect(api.rpcCalls('breakdown_totals').at(-1)).toMatchObject({ dimension: 'account' });
  await capture(page, 'resumen-desglose');
});
