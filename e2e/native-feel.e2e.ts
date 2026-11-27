import { expect, Locator, Page, test } from '@playwright/test';
import { HOUSEHOLD_WITH_MOVEMENTS } from './support/catalog-fixture';
import { captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

/** Thursday 26 November 2026, inside the period of the fixture's movements. */
const TODAY = new Date('2026-11-26T12:00:00');

/** A common Android phone; the quick entry fits on it without scrolling (spec §7). */
const SMALL_PHONE = { width: 360, height: 740 };

/** Surface of the app bars (neutral 94 and 12) and of the page (neutral 98), spec §13.2. */
const BAR_SURFACE = { light: '#ededf3', dark: '#1e2024' } as const;
const PAGE_SURFACE_LIGHT = 'rgb(249, 249, 255)';
/** The bar surface under the 32% scrim of an open overlay. */
const BAR_UNDER_SCRIM = { light: '#a1a1a5', dark: '#141618' } as const;

const TABS = ['/cuentas', '/categorias', '/transacciones', '/presupuesto', '/resumen'];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
  await seedSession(page);
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
});

function scroller(page: Page): Locator {
  return page.locator('cc-app-shell .scroller');
}

function scheme(): 'light' | 'dark' {
  return test.info().project.use.colorScheme === 'dark' ? 'dark' : 'light';
}

/** The color every theme-color meta says. */
async function themeColors(page: Page): Promise<string[]> {
  return page
    .locator('meta[name="theme-color"]')
    .evaluateAll((metas) => metas.map((meta) => (meta as HTMLMetaElement).content));
}

async function expectThemeColor(page: Page, color: string): Promise<void> {
  await expect.poll(() => themeColors(page)).toEqual([color, color]);
}

/**
 * Drags from the middle of an element, down by `distance` pixels. `slow` moves like a finger that
 * takes its time, which is no flick.
 */
async function dragDown(
  page: Page,
  target: Locator,
  distance: number,
  slow = false,
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Nothing to drag');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 8;
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, y + (distance * step) / steps);
    if (slow) {
      await page.waitForTimeout(40);
    }
  }
  await page.mouse.up();
}

test('only the content scrolls: the header and the navigation never move', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Phones only.');
  await page.setViewportSize({ width: SMALL_PHONE.width, height: 560 });
  await page.goto('/transacciones');
  await expect(page.getByRole('region', { name: 'Movimientos' })).toContainText('Salario');

  const header = page.getByRole('banner');
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  const headerBefore = await header.boundingBox();
  const navigationBefore = await navigation.boundingBox();
  await scroller(page).evaluate((element) => element.scrollBy(0, 400));
  await expect
    .poll(() => scroller(page).evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  expect(await header.boundingBox()).toEqual(headerBefore);
  expect(await navigation.boundingBox()).toEqual(navigationBefore);
  // The document itself never scrolls, so there is no bounce or pull-to-refresh of the page.
  const page_ = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
    height: window.innerHeight,
  }));
  expect(page_.scrollHeight).toBeLessThanOrEqual(page_.height);
});

test('nothing overflows sideways on a 360 px phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phones only.');
  await page.setViewportSize(SMALL_PHONE);
  for (const path of TABS) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      scroller: document.querySelector('cc-app-shell .scroller')?.scrollWidth ?? 0,
      viewport: window.innerWidth,
    }));
    expect(widths.document, path).toBeLessThanOrEqual(widths.viewport);
    expect(widths.scroller, path).toBeLessThanOrEqual(widths.viewport);
  }
});

test('the system bars follow the theme of the app and dim under the menu', async ({ page }) => {
  await page.goto('/categorias');
  const current = scheme();
  await expectThemeColor(page, BAR_SURFACE[current]);

  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await expect(menu).toBeVisible();
  await expectThemeColor(page, BAR_UNDER_SCRIM[current]);

  // The theme of the app, not only the system's: the bars change with it right away.
  const other = current === 'light' ? 'dark' : 'light';
  await menu.getByText(other === 'dark' ? 'Oscuro' : 'Claro', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', other);
  await expectThemeColor(page, BAR_UNDER_SCRIM[other]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expectThemeColor(page, BAR_SURFACE[other]);
});

test('the manifest paints the splash and the bars like the app in light', async ({ page }) => {
  test.skip(scheme() !== 'light', 'The manifest has no dark variant (spec §13.2).');
  await page.goto('/categorias');
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
    theme_color: string;
    background_color: string;
  };
  expect(manifest.theme_color).toBe(BAR_SURFACE.light);
  await expectThemeColor(page, manifest.theme_color);
  const pageSurface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(pageSurface).toBe(PAGE_SURFACE_LIGHT);
  expect(manifest.background_color).toBe('#f9f9ff');
});

test('controls are not text, fields are, and no field makes iOS zoom', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch screens only.');
  await page.goto('/categorias');
  const navigationLink = page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Cuentas' });
  expect(await navigationLink.evaluate((element) => getComputedStyle(element).userSelect)).toBe(
    'none',
  );
  expect(await navigationLink.evaluate((element) => getComputedStyle(element).touchAction)).toBe(
    'manipulation',
  );

  await page.getByRole('button', { name: /^Mercado/ }).click();
  const note = page.getByRole('textbox', { name: 'Nota' });
  await expect(note).toBeVisible();
  const style = await note.evaluate((element) => ({
    userSelect: getComputedStyle(element).userSelect,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  expect(style.userSelect).toBe('text');
  expect(style.fontSize).toBeGreaterThanOrEqual(16);
});

test('each screen keeps its scroll; a deeper one starts at the top', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'One pane at a time.');
  await page.setViewportSize({ width: SMALL_PHONE.width, height: 480 });
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  const scrollTop = () => scroller(page).evaluate((element) => element.scrollTop);

  await page.goto('/cuentas');
  await expect(page.getByRole('link', { name: /Efectivo/ })).toBeVisible();
  await scroller(page).evaluate((element) => element.scrollTo(0, 150));
  await expect.poll(scrollTop).toBe(150);

  await navigation.getByRole('link', { name: 'Transacciones' }).click();
  await expect(page).toHaveURL(/\/transacciones$/);
  await expect.poll(scrollTop).toBe(0);
  await navigation.getByRole('link', { name: 'Cuentas' }).click();
  await expect(page).toHaveURL(/\/cuentas$/);
  await expect.poll(scrollTop).toBe(150);

  // Reaching the account scrolls the list: that is the position to come back to.
  const account = page.getByRole('link', { name: /Préstamo a Carlos/ });
  await account.scrollIntoViewIfNeeded();
  const listTop = await scrollTop();
  await account.click();
  await expect(page).toHaveURL(/\/cuentas\/[^/]+$/);
  await expect.poll(scrollTop).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/cuentas$/);
  await expect.poll(scrollTop).toBe(listTop);
});

test('the quick entry fits on a 360 × 740 phone without scrolling', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The sheet of phones.');
  await page.setViewportSize(SMALL_PHONE);
  await page.goto('/categorias');
  await page.getByRole('button', { name: /^Mercado/ }).click();
  const sheet = page.locator('.mat-bottom-sheet-container');
  await expect(sheet.locator('[data-key="submit"]')).toBeVisible();

  const fits = await sheet.locator('cc-overlay-panel.entry .body').evaluate((body) => ({
    scrolls: body.scrollHeight > body.clientHeight + 1,
    sheetFits: body.closest('.mat-bottom-sheet-container')!.scrollHeight <= window.innerHeight,
  }));
  expect(fits).toEqual({ scrolls: false, sheetFits: true });
  await captureViewport(page, 'registro-rapido-360');
});

test('the menu opens from the avatar and closes with back and Esc', async ({
  page,
  browserName,
}) => {
  await page.goto('/categorias');
  const avatar = page.getByRole('button', { name: 'Abrir el menú' });
  const menu = page.getByRole('dialog', { name: 'Menú' });

  await avatar.click();
  await expect(menu.getByRole('button', { name: /^Configuración/ })).toBeVisible();
  await expect(menu).toContainText('e2e@example.com');
  await expect(menu).toContainText('Versión 0.10.0');
  await captureViewport(page, 'menu');

  // The system back button closes it without leaving the screen.
  await page.goBack();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/categorias$/);

  await avatar.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Safari does not focus a tapped button, so there is no focus to give back there.
  if (browserName !== 'webkit') {
    await expect(avatar).toBeFocused();
  }

  // Configuración opens from the menu, and one back press returns to where it was opened.
  await avatar.click();
  await menu.getByRole('button', { name: /^Configuración/ }).click();
  await expect(page).toHaveURL(/\/configuracion$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/categorias$/);
});

test('dragging the handle closes a sheet, and asks first when something changed', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Sheets are for phones.');
  await page.goto('/categorias');
  const sheet = page.locator('.mat-bottom-sheet-container');
  const handle = sheet.getByRole('button', { name: 'Cerrar' });

  await page.getByRole('button', { name: /^Mercado/ }).click();
  await expect(handle).toBeVisible();
  // A short, slow drag slides back.
  await dragDown(page, handle, 24, true);
  await expect(sheet.locator('[data-key="submit"]')).toBeVisible();
  // Far enough, it closes.
  await dragDown(page, handle, 320);
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: /^Mercado/ }).click();
  await sheet.locator('[data-key="5"]').click();
  await dragDown(page, handle, 320);
  await expect(sheet.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeVisible();
  await captureViewport(page, 'registro-rapido-arrastrar');
});

test.describe('with motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('screens fade between tabs and slide into a deeper one', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Checked where the transitions are counted.');
    await page.goto('/cuentas');
    await expect(page.getByRole('link', { name: /Efectivo/ })).toBeVisible();
    await page.evaluate(() => {
      const counted = window as unknown as { transitions: number };
      counted.transitions = 0;
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = ((update: () => Promise<void>) => {
        counted.transitions++;
        return start(update);
      }) as typeof document.startViewTransition;
    });
    const transitions = () =>
      page.evaluate(() => (window as unknown as { transitions: number }).transitions);

    await page.getByRole('link', { name: 'Categorías', exact: true }).click();
    await expect(page).toHaveURL(/\/categorias$/);
    await expect.poll(transitions).toBeGreaterThan(0);
    await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
    await page.getByRole('link', { name: /Efectivo/ }).click();
    await expect(page).toHaveURL(/\/cuentas\/acc-cash$/);
    await expect(page.getByRole('heading', { name: 'Efectivo', level: 1 })).toBeVisible();
    // The marks of a finished transition are cleared.
    await expect(page.locator('html')).not.toHaveAttribute('data-cc-transition', /.+/);
  });
});
