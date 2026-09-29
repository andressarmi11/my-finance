import { test, expect } from './fixtures';

/**
 * Refresh used to mean closing the app and opening it again — the only
 * way to see what the Shortcuts had just sent in. Now there's a button
 * over the +, and in the home-screen app, pulling down from the top.
 */

test('the refresh button over the + reloads the app', async ({ page }) => {
  await page.goto('');
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await reloaded;
  await expect(page.getByRole('button', { name: 'Agregar movimiento' })).toBeVisible();
});

test('pulling down from the top reloads the home-screen app', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Touch events are synthesised with the Touch constructor, Chromium only');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  });
  await page.goto('');
  await expect(page.locator('main')).toBeVisible();

  const reloaded = page.waitForEvent('load');
  await page.evaluate(async () => {
    const target = document.querySelector('main')!;
    const touch = (y: number) => new Touch({ identifier: 1, target, clientX: 150, clientY: y });
    const fire = (type: string, y: number | null) => target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      touches: y === null ? [] : [touch(y)],
      changedTouches: [touch(y ?? 400)],
    }));
    fire('touchstart', 100);
    for (let y = 120; y <= 400; y += 20) {
      fire('touchmove', y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    fire('touchend', null);
  }).catch((e: unknown) => {
    // The reload can land before evaluate returns: that IS the success.
    if (!String(e).includes('Execution context was destroyed')) throw e;
  });
  await reloaded;
});
