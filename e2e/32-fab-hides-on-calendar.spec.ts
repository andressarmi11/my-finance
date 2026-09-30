import { test, expect } from './fixtures';

/**
 * The + is always visible. It used to hide on scroll down; now it stays,
 * because it's the main action and it sits beside the tab pill, not over the
 * content. It still steps aside while a dialog is open.
 */
test('the + stays visible scrolling down and up, even on a short screen', async ({ page }) => {
  // Short viewport so the page is guaranteed to scroll, whatever the content.
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('movimientos?vista=calendario');
  await page.evaluate(() => window.scrollTo(0, 0));
  const add = page.getByRole('button', { name: 'Agregar movimiento' });
  await expect(add).toHaveCSS('opacity', '1');

  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(max).toBeGreaterThan(120);

  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  await expect(add).toHaveCSS('opacity', '1');
  await expect(add).toBeEnabled();

  await page.evaluate(() => window.scrollTo(0, 100));
  await expect(add).toHaveCSS('opacity', '1');
});

test('the + steps aside while a dialog is open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('movimientos?nuevo=1');
  await expect(page.getByRole('dialog', { name: 'Agregar movimiento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar movimiento' })).toBeHidden();
});
