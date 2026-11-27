import { expect, test } from '@playwright/test';
import { blockSupabase } from './support/supabase';

const LEVELS = [
  { id: 'atomos', title: 'Átomos' },
  { id: 'moleculas', title: 'Moléculas' },
  { id: 'organismos', title: 'Organismos' },
  { id: 'plantillas', title: 'Plantillas' },
] as const;

/** Icon color the palette uses where white does not reach 3:1 (#1a1c20). */
const DARK_ICON = 'rgb(26, 28, 32)';

test('the /ui catalog shows every design system level in light and dark', async ({ page }) => {
  await blockSupabase(page);
  await page.goto('/ui');

  await expect(page.getByRole('heading', { name: 'Catálogo UI' })).toBeVisible();
  for (const level of LEVELS) {
    const section = page.locator(`#${level.id}`);
    await expect(section.getByRole('heading', { name: level.title, exact: true })).toBeVisible();
    await expect(section.getByText('Claro', { exact: true }).first()).toBeVisible();
    await expect(section.getByText('Oscuro', { exact: true }).first()).toBeVisible();
  }
});

test(
  'the icon and color picker opens as a bottom sheet on mobile and as a dialog on desktop',
  { tag: '@desktop' },
  async ({ page, isMobile }) => {
    await blockSupabase(page);
    await page.goto('/ui');
    const panel = page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');

    const trigger = page.locator('#moleculas cc-appearance-picker button').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    // Spec §13.5: no visible bar, but the overlay keeps its name and its two floating buttons.
    await expect(page.getByRole('dialog', { name: 'Ícono y color' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Cerrar' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Listo' })).toBeVisible();

    // Any group is one jump away: a menu on phones, the list beside the grid on wide screens.
    if (isMobile) {
      await panel.getByRole('button', { name: /^Ir a un grupo/ }).click();
      await page.getByRole('menuitem', { name: 'Mascotas' }).click();
      await expect(panel.getByRole('button', { name: 'Ir a un grupo: Mascotas' })).toBeVisible();
    } else {
      const groups = panel.getByRole('navigation', { name: 'Grupos de íconos' });
      await groups.getByRole('button', { name: 'Mascotas' }).click();
      await expect(groups.getByRole('button', { name: 'Mascotas' })).toHaveAttribute(
        'aria-current',
        'true',
      );
    }
    const rabbit = panel.getByRole('button', { name: 'Conejo' });
    await expect(rabbit).toBeInViewport();
    // No sideways scrolling anywhere in the picker.
    const overflow = await panel
      .locator('cc-overlay-panel .body')
      .evaluate((body) => body.scrollWidth - body.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Picking previews it without closing.
    await rabbit.click();
    await expect(rabbit).toHaveAttribute('aria-pressed', 'true');
    await panel.getByLabel('Buscar ícono').fill('mascota');
    await expect(panel.getByRole('button', { name: 'Mascotas', exact: true })).toBeVisible();

    // A light color gets a dark icon so it stays readable.
    await panel.getByRole('tab', { name: 'Color' }).click();
    await panel.getByRole('button', { name: 'Amarillo pálido' }).click();
    await expect(panel.locator('.preview cc-icon-badge')).toHaveCSS('color', DARK_ICON);
    await panel.getByRole('button', { name: 'Morado', exact: true }).click();
    await panel.getByRole('button', { name: 'Listo' }).click();

    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAccessibleName(/Conejo, Morado/);
  },
);
