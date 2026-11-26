import { expect, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

test('categories show their subcategories and deleting one names what goes with it', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion');
  await page.getByRole('link', { name: /^Categorías De gasto/ }).click();

  await expect(page.getByRole('heading', { name: 'Categorías', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Subcategorías de Hogar' })).toContainText(
    'Arriendo',
  );
  await expect(page.getByRole('link', { name: /Arriendo/ })).toContainText('Fijos');
  await capture(page, 'categorias-configuracion');

  await page.getByRole('radio', { name: 'Ingresos' }).click();
  await expect(page.getByRole('link', { name: /Salario/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Mercado/ })).toBeHidden();
  await page.getByRole('radio', { name: 'Gastos' }).click();

  await page.getByRole('link', { name: /^Hogar/ }).click();
  await expect(page.getByRole('heading', { name: 'Hogar' })).toBeVisible();
  await capture(page, 'categoria-editar');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
  await expect(confirm.getByRole('heading', { name: '¿Eliminar Hogar?' })).toBeVisible();
  await expect(confirm).toContainText('También se eliminarán sus 2 subcategorías:');
  await expect(confirm.getByRole('listitem')).toHaveText(['Arriendo', 'Servicios públicos']);
  await captureViewport(page, 'categoria-eliminar');
  await confirm.getByRole('button', { name: 'Eliminar' }).click();

  await expect(page).toHaveURL(/\/configuracion\/categorias\?clase=gasto$/);
  expect(api.writes()).toContainEqual(
    expect.objectContaining({
      method: 'DELETE',
      table: 'categories',
      query: expect.stringContaining('id=eq.cat-home'),
    }),
  );
});

test('a subcategory inherits the color of its parent', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion/categorias');

  await page.getByRole('link', { name: 'Agregar subcategoría' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nueva subcategoría' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Color/ })).toContainText(
    'Igual que la categoría (Naranja)',
  );
  await page.getByLabel('Nombre').fill('Aseo');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/configuracion\/categorias/);
  const created = api.writes().find((write) => write.table === 'categories');
  expect(created?.body).toMatchObject({
    name: 'Aseo',
    kind: 'expense',
    parent_id: 'cat-home',
    color: null,
  });
});

test('tags are listed with their use and a new one is created', async ({ page }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion/etiquetas');

  await expect(page.getByRole('heading', { name: 'Etiquetas', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fijos/ })).toContainText(
    'Por defecto en 1 categoría',
  );
  await capture(page, 'etiquetas');

  await page.getByRole('link', { name: 'Nueva' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva etiqueta' })).toBeVisible();
  await page.getByLabel('Nombre').fill('Viajes');
  await expect(page.getByLabel('Nombre')).toHaveValue('Viajes');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/configuracion\/etiquetas$/);
  expect(api.writes().find((write) => write.table === 'tags')?.body).toMatchObject({
    name: 'Viajes',
    color: 'indigo',
  });
  await expect(page.getByRole('link', { name: /Viajes/ })).toBeVisible();
});
