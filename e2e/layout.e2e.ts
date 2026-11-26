import { expect, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

/** A width in the medium window class (600–839 px), e.g. a tablet in portrait. */
const MEDIUM_VIEWPORT = { width: 720, height: 960 };

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
});

test('phones use the bottom navigation and flows take the whole screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Compact window class only.');
  await page.goto('/cuentas');
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(navigation).toBeVisible();

  await page.goto('/cuentas/nueva?grupo=cuenta');
  await expect(page.getByRole('heading', { name: 'Nueva cuenta', level: 1 })).toBeVisible();
  await expect(navigation).toBeHidden();
  await expect(page.getByRole('button', { name: 'Configuración' })).toBeHidden();
});

test('wide screens use a rail and show list and detail side by side', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Expanded window class only.');
  await page.goto('/cuentas/acc-cash');

  const rail = page.locator('cc-nav-rail');
  await expect(rail.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  await expect(page.locator('cc-bottom-nav')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Efectivo', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Efectivo/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('medium screens use a rail, one pane at a time and dialogs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones never reach the medium window class.');
  await page.setViewportSize(MEDIUM_VIEWPORT);
  await page.goto('/cuentas');

  await expect(page.locator('cc-nav-rail')).toBeVisible();
  await expect(page.locator('cc-bottom-nav')).toHaveCount(0);
  await capture(page, 'layout-mediano-cuentas');

  await page.getByRole('link', { name: /Efectivo/ }).click();
  await expect(page.getByRole('heading', { name: 'Efectivo', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeHidden();
  await capture(page, 'layout-mediano-cuenta');

  await page.getByRole('button', { name: /^Tipo/ }).click();
  await expect(page.locator('mat-dialog-container')).toBeVisible();
});
