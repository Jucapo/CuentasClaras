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

test('the icon and color picker opens as a bottom sheet on mobile and as a dialog on desktop', async ({
  page,
  isMobile,
}) => {
  await blockSupabase(page);
  await page.goto('/ui');
  const panel = page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');

  const trigger = page.locator('#moleculas cc-appearance-picker button').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(panel.getByRole('heading', { name: 'Ícono y color' })).toBeVisible();
  await panel.getByLabel('Buscar ícono').fill('mascota');
  await expect(panel.getByRole('button', { name: 'Mascotas' })).toBeVisible();
  // Picking previews it without closing.
  await panel.getByRole('button', { name: 'Conejo' }).click();
  await expect(panel.getByRole('button', { name: 'Conejo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await captureViewport(page, 'ui-icon-picker');

  await panel.getByRole('tab', { name: 'Color' }).click();
  await panel.getByRole('button', { name: 'Morado' }).click();
  await captureViewport(page, 'ui-color-picker');
  await panel.getByRole('button', { name: 'Listo' }).click();

  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAccessibleName(/Conejo, Morado/);
});
