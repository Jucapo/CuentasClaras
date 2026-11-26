import { Locator, Page, test } from '@playwright/test';

const SCREENSHOT_DIR = 'e2e/screenshots';

/** Saves a full-page screenshot under e2e/screenshots/<project>/<name>.png. */
export async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: screenshotPath(name), fullPage: true });
}

/** Saves what is on screen (e.g. an open dialog or sheet) under e2e/screenshots/<project>/<name>.png. */
export async function captureViewport(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: screenshotPath(name) });
}

/** Saves a screenshot of one element under e2e/screenshots/<project>/<name>.png. */
export async function captureElement(locator: Locator, name: string): Promise<void> {
  await locator.screenshot({ path: screenshotPath(name) });
}

function screenshotPath(name: string): string {
  return `${SCREENSHOT_DIR}/${test.info().project.name}/${name}.png`;
}
