import { expect, test } from '@playwright/test';
import { captureElement } from './support/screenshots';
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
