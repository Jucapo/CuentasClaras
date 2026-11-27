import { expect, Page, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
});

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean) {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

/** The browser's or Android's back button. */
function goBack(page: Page): Promise<void> {
  return page.evaluate(() => history.back());
}

test('back closes the open sheet and stays on the page', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The system back button belongs to phones.');
  await page.goto('/configuracion');
  await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
  await expect(page).toHaveURL(/\/cuentas$/);

  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: '¿Qué vas a crear?' })).toBeVisible();
  await goBack(page);

  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/cuentas$/);
  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeVisible();

  // Closing it with ✕ leaves no history entry behind: back leaves the page.
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await expect(sheet).toBeHidden();
  await goBack(page);
  await expect(page).toHaveURL(/\/configuracion$/);
});

test('leaving a flow with unsaved changes asks first', async ({ page, isMobile }) => {
  await page.goto('/cuentas');
  await page.getByRole('link', { name: /Efectivo/ }).click();
  await page.getByRole('link', { name: 'Editar cuenta' }).click();
  await expect(page).toHaveURL(/\/cuentas\/acc-cash\/editar$/);

  // Without changes it leaves right away, back to the account's detail.
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);

  await page.getByRole('link', { name: 'Editar cuenta' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Billetera');
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  const confirm = overlay(page, isMobile);
  await expect(confirm.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/cuentas\/acc-cash\/editar$/);
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Billetera');

  // The system back button asks too, and cancelling keeps the screen and the history.
  await goBack(page);
  await expect(confirm.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/cuentas\/acc-cash\/editar$/);

  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await confirm.getByRole('button', { name: 'Descartar' }).click();
  await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);
  await expect(page.getByRole('heading', { name: 'Efectivo', level: 1 })).toBeVisible();
});
