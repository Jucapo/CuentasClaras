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

test('a color of the first palette keeps showing as its equivalent of the grid', async ({
  page,
}, testInfo) => {
  // Spec §13.3: "navy" is no longer a palette key; it shows as indigo-dark, never the fallback.
  const catalog = {
    ...HOUSEHOLD,
    categories: HOUSEHOLD.categories.map((category) =>
      category['id'] === 'cat-transport' ? { ...category, color: 'navy' } : category,
    ),
  };
  await mockDataApi(page, { withSpace: true, catalog });
  await page.goto('/categorias');

  const badge = page
    .locator('cc-category-bubble')
    .filter({ hasText: 'Transporte' })
    .locator('cc-icon-badge');
  const dark = testInfo.project.use.colorScheme === 'dark';
  await expect(badge).toHaveCSS('background-color', dark ? 'rgb(40, 53, 147)' : 'rgb(26, 35, 126)');
});

test('the categories tab shows the grid and the pencil opens the edit mode', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/categorias');

  const grid = page.getByRole('list', { name: 'Categorías de gasto' });
  await expect(grid.getByRole('listitem')).toHaveText([/Hogar/, /Mercado/, /Transporte/]);
  await capture(page, 'categorias');

  await page.getByRole('tab', { name: 'Ingresos' }).click();
  await expect(page.getByRole('list', { name: 'Categorías de ingreso' })).toContainText('Salario');
  await page.getByRole('tab', { name: 'Gastos' }).click();

  await page.getByRole('button', { name: 'Editar categorías' }).click();
  await expect(page).toHaveURL(/\/categorias\/editar\?clase=gasto$/);
  await expect(page.getByRole('heading', { name: 'Editar categorías' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva', exact: true })).toBeVisible();
  await capture(page, 'categorias-editar');

  await page.getByRole('button', { name: 'Hogar', exact: true }).click();
  await expect(page).toHaveURL(/\/categorias\/editar\/cat-home/);
  await expect(page.getByRole('heading', { name: 'Hogar', level: 1 })).toBeVisible();
  const subcategories = page.getByRole('list', { name: 'Subcategorías', exact: true });
  await expect(subcategories.getByRole('listitem')).toHaveText([/Arriendo/, /Servicios públicos/]);
  await expect(subcategories.getByRole('listitem').first()).toContainText('Fijos');
  await expect(page.getByRole('button', { name: /^Etiquetas por defecto/ })).toContainText(
    'Ninguna',
  );
  await capture(page, 'categoria');

  await subcategories.getByRole('button', { name: /^Arriendo/ }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Subcategoría' })).toBeVisible();
  await expect(sheet.getByLabel('Nombre')).toHaveValue('Arriendo');
  await captureViewport(page, 'subcategoria');
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = overlay(page, isMobile);
  await expect(confirm.getByRole('heading', { name: '¿Eliminar Hogar?' })).toBeVisible();
  await expect(confirm).toContainText('También se eliminarán sus 2 subcategorías:');
  await expect(confirm.getByRole('listitem')).toHaveText(['Arriendo', 'Servicios públicos']);
  await captureViewport(page, 'categoria-eliminar');
  await confirm.getByRole('button', { name: 'Eliminar' }).click();

  await expect(page).toHaveURL(/\/categorias\/editar\?clase=gasto$/);
  expect(api.writes()).toContainEqual(
    expect.objectContaining({
      method: 'DELETE',
      table: 'categories',
      query: expect.stringContaining('id=eq.cat-home'),
    }),
  );
});

test('Configuración → Categorías opens the same edit mode and back returns there', async ({
  page,
}) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion');

  await page.getByRole('link', { name: /^Categorías De gasto/ }).click();
  await expect(page).toHaveURL(/\/categorias\/editar$/);
  await expect(page.getByRole('heading', { name: 'Editar categorías' })).toBeVisible();

  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/configuracion$/);
});

test('a new subcategory inherits the color of its category', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/categorias/editar/cat-home?clase=gasto');

  await page.getByRole('button', { name: 'Añadir subcategoría' }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Nueva subcategoría' })).toBeVisible();
  await expect(sheet.getByLabel('Nombre')).toBeFocused();
  await sheet.getByLabel('Nombre').fill('Aseo');
  await sheet.getByRole('tab', { name: 'Color' }).click();
  await expect(sheet.getByRole('button', { name: 'Igual que la categoría' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sheet.getByRole('button', { name: 'Listo' }).click();

  await expect(sheet).toBeHidden();
  const created = api.writes().find((write) => write.table === 'categories');
  expect(created?.body).toMatchObject({
    name: 'Aseo',
    kind: 'expense',
    parent_id: 'cat-home',
    color: null,
  });
  await expect(page.getByRole('list', { name: 'Subcategorías', exact: true })).toContainText(
    'Aseo',
  );
});

test('a new category is saved first when a subcategory is added', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/categorias/editar?clase=gasto');

  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await expect(page).toHaveURL(/\/categorias\/editar\/nueva\?clase=gasto$/);
  await expect(page.getByRole('heading', { name: 'Nueva categoría', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible();
  await page.getByLabel('Nombre', { exact: true }).fill('Mascotas');
  await page.getByRole('button', { name: 'Añadir subcategoría' }).click();

  await expect(page.getByText('Categoría guardada.')).toBeVisible();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Nueva subcategoría' })).toBeVisible();
  const parent = api.writes().find((write) => write.table === 'categories');
  expect(parent?.body).toMatchObject({ name: 'Mascotas', kind: 'expense', parent_id: null });
  await expect(page).toHaveURL(/\/categorias\/editar\/categories-\d+\?clase=gasto$/);

  await sheet.getByLabel('Nombre').fill('Veterinario');
  await sheet.getByRole('button', { name: 'Listo' }).click();
  await expect(sheet).toBeHidden();
  const parentId = page.url().match(/categories-\d+/)?.[0];
  const child = api.writes().filter((write) => write.table === 'categories')[1];
  expect(child?.body).toMatchObject({ name: 'Veterinario', parent_id: parentId });
  // The category exists now: the screen is in edit mode, with back instead of close.
  await expect(page.getByRole('heading', { name: 'Mascotas', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeHidden();
});

test('a subcategory moves to another category', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/categorias/editar/cat-home?clase=gasto');

  await page.getByRole('button', { name: /^Servicios públicos/ }).click();
  const sheet = overlay(page, isMobile);
  await sheet.getByRole('button', { name: 'Más opciones' }).click();
  await sheet.getByRole('combobox', { name: 'Categoría' }).click();
  await page.getByRole('option', { name: 'Mercado' }).click();
  await sheet.getByRole('button', { name: 'Listo' }).click();

  await expect(sheet).toBeHidden();
  await expect
    .poll(() => api.writes().find((write) => write.table === 'categories'))
    .toMatchObject({
      method: 'PATCH',
      query: expect.stringContaining('id=eq.cat-utilities'),
      body: expect.objectContaining({ parent_id: 'cat-market' }),
    });
});

test('categories move with Alt and the arrows in the edit mode', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/categorias/editar?clase=gasto');

  await page.getByRole('button', { name: 'Mercado', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowLeft');

  await expect
    .poll(() => api.rpcCalls('reorder_categories'))
    .toEqual([{ category_ids: ['cat-market', 'cat-home', 'cat-transport'] }]);
  await expect(page.getByRole('button', { name: 'Mercado', exact: true })).toBeFocused();
});
