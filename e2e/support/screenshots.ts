import { Locator, Page, test } from '@playwright/test';

const SCREENSHOT_DIR = 'e2e/screenshots';

/**
 * Only the content scrolls in the app (spec §13.5), so a full-page screenshot would stop at the
 * screen's height. While it is taken, the shell grows to its content, with the header on top and the
 * navigation at the end; the viewport and its dvh sizes do not change.
 */
const FULL_PAGE_STYLE = `
  cc-app-shell { height: auto !important; min-height: 100dvh; overflow: visible !important; }
  cc-app-shell .scroller { overflow: visible !important; }
`;

/** Saves a full-page screenshot under e2e/screenshots/<project>/<name>.png. */
export async function capture(page: Page, name: string): Promise<void> {
  const style = await page.addStyleTag({ content: FULL_PAGE_STYLE });
  try {
    await page.screenshot({ path: screenshotPath(name), fullPage: true });
  } finally {
    await style.evaluate((element) => element.remove());
  }
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
