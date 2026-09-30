import { test, expect } from './fixtures';

/**
 * The + used to hide only on pages that scroll more than 320px, so the
 * Calendar (shorter than that) never got it out of the way. Rule: hide on
 * scroll down whenever the page scrolls more than the area the button
 * covers, and come back on ANY scroll up. The Calendar is now the
 * ?vista=calendario view of Movimientos.
 */
test('the + button hides scrolling down on the Calendar and comes back scrolling up', async ({ page }) => {
  // Short viewport so the page is guaranteed to scroll, whatever the content.
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('movimientos?vista=calendario');
  // The onboarding leaves the short viewport scrolled; start from the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  const add = page.getByRole('button', { name: 'Agregar movimiento' });
  await expect(add).toHaveCSS('opacity', '1');

  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(max).toBeGreaterThan(120);

  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(add).toHaveCSS('opacity', '0');

  await page.evaluate(() => window.scrollTo(0, 100));
  await expect(add).toHaveCSS('opacity', '1');
});

test('on a page too short to scroll past the buttons, they never hide', async ({ page }) => {
  // Tall viewport: the Calendar barely scrolls (or not at all), so hiding
  // would only remove the main action.
  await page.setViewportSize({ width: 390, height: 1400 });
  await page.goto('movimientos?vista=calendario');
  await page.evaluate(() => window.scrollTo(0, 0));
  const add = page.getByRole('button', { name: 'Agregar movimiento' });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(max).toBeLessThanOrEqual(120);

  await page.evaluate((m) => window.scrollTo(0, m), Math.max(max, 0));
  await page.waitForTimeout(300);
  await expect(add).toHaveCSS('opacity', '1');
  await expect(add).toBeEnabled();
});
