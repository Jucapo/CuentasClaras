import { expect, test } from '@playwright/test';
import { contrastRatio } from '../src/app/domain/color/contrast';
import { blockSupabase } from './support/supabase';

/** WCAG 1.4.3 AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;

/** Text roles of the Material 3 theme over the surfaces they are used on (spec §13.2). */
const TEXT_PAIRS = [
  ['on-surface', 'surface'],
  ['on-surface', 'surface-container'],
  ['on-surface-variant', 'surface'],
  ['on-surface-variant', 'surface-container'],
  ['primary', 'surface'],
  ['primary', 'surface-container-low'],
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ['error', 'surface'],
] as const;

test('the brand theme keeps AA contrast on its text roles', async ({ page }) => {
  await blockSupabase(page);
  await page.goto('/iniciar-sesion');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  const tokens = [...new Set(TEXT_PAIRS.flat())];
  // Resolves each system token (a light-dark() value) to the color of the active scheme.
  const colors = await page.evaluate((names) => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const resolved: Record<string, string> = {};
    for (const name of names) {
      probe.style.color = `var(--mat-sys-${name})`;
      const channels = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) ?? [];
      resolved[name] =
        '#' +
        channels
          .slice(0, 3)
          .map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0'))
          .join('');
    }
    probe.remove();
    return resolved;
  }, tokens);

  const failing = TEXT_PAIRS.map(([text, surface]) => ({
    pair: `${text} / ${surface}`,
    ratio: contrastRatio(colors[text], colors[surface]),
  })).filter(({ ratio }) => ratio < MIN_TEXT_CONTRAST);
  expect(failing).toEqual([]);
});
