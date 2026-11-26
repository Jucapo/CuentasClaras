import { expect, test } from '@playwright/test';
import { captureElement, captureViewport } from './support/screenshots';
import { blockSupabase } from './support/supabase';

const LEVELS = [
  { id: 'atomos', title: 'Átomos' },
  { id: 'moleculas', title: 'Moléculas' },
  { id: 'organismos', title: 'Organismos' },
  { id: 'plantillas', title: 'Plantillas' },
] as const;

test('the /ui catalog shows every design system level in light and dark', async ({ page }) => {
  await blockSupabase(page);
  await page.goto('/ui');

  await expect(page.getByRole('heading', { name: 'Catálogo UI' })).toBeVisible();
  for (const level of LEVELS) {
    const section = page.locator(`#${level.id}`);
    await expect(section.getByRole('heading', { name: level.title, exact: true })).toBeVisible();
    await expect(section.getByText('Claro', { exact: true }).first()).toBeVisible();
    await expect(section.getByText('Oscuro', { exact: true }).first()).toBeVisible();
    await captureElement(section, `ui-${level.id}`);
  }
});

test('pickers open as a bottom sheet on mobile and as a dialog on desktop', async ({
  page,
  isMobile,
}) => {
  await blockSupabase(page);
  await page.goto('/ui');
  const container = isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container';

  const iconTrigger = page.locator('#moleculas cc-icon-picker button').first();
  await iconTrigger.scrollIntoViewIfNeeded();
  await iconTrigger.click();
  const iconPanel = page.locator(container);
  await expect(iconPanel.getByRole('heading', { name: 'Ícono' })).toBeVisible();
  await iconPanel.getByLabel('Buscar ícono').fill('mascota');
  await expect(iconPanel.getByRole('button', { name: 'Mascotas' })).toBeVisible();
  await captureViewport(page, 'ui-icon-picker');
  await iconPanel.getByRole('button', { name: 'Conejo' }).click();
  await expect(iconPanel).toBeHidden();
  await expect(iconTrigger).toContainText('Conejo');

  const colorTrigger = page.locator('#moleculas cc-color-picker button').nth(1);
  await colorTrigger.click();
  const colorPanel = page.locator(container);
  await expect(colorPanel.getByRole('button', { name: 'Igual que la categoría' })).toBeVisible();
  await captureViewport(page, 'ui-color-picker');
  await colorPanel.getByRole('button', { name: 'Morado' }).click();
  await expect(colorPanel).toBeHidden();
  await expect(colorTrigger).toContainText('Morado');
});
