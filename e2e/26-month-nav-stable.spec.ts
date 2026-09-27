import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * The arrows must not move as the month name changes length.
 *
 * Reported symptom: paging through months shifted the arrows sideways
 * ("Mayo" vs "Septiembre"), so the next arrow kept escaping from under the
 * thumb — and landed on Today by accident.
 */
test.use({ reducedMotion: 'reduce', locale: 'es-CO' });

/** The accessible name changes with the language, so either one is accepted. */
async function nextArrowX(page: Page): Promise<number> {
  const box = await page.getByRole('button', { name: /Mes siguiente|Next month/ }).boundingBox();
  return Math.round(box!.x);
}

test.describe('calendar', () => {
  test('the arrows do not move when changing month', async ({ page }) => {
    await page.goto('calendario');

    const posiciones: number[] = [];
    // Twelve months in a row cover the shortest name (Mayo) and the
    // longest (Septiembre) in Spanish.
    for (let i = 0; i < 12; i++) {
      posiciones.push(await nextArrowX(page));
      await page.getByRole('button', { name: 'Mes siguiente' }).click();
    }

    expect(new Set(posiciones).size).toBe(1);
  });

  test('nor do they move when changing language', async ({ page }) => {
    await page.goto('calendario');
    const enEspanol = await nextArrowX(page);

    await page.goto('ajustes');
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto('calendario');

    expect(await nextArrowX(page)).toBe(enEspanol);
  });
});

test.describe('the Today arrow points to where today is', () => {
  test('backwards when you paged into the future', async ({ page }) => {
    await page.goto('calendario');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Mes siguiente' }).click();

    const hoy = page.getByRole('button', { name: 'Volver al mes actual' });
    await expect(hoy).toBeVisible();
    await expect(hoy.locator('svg.tabler-icon-arrow-back-up')).toBeVisible();
  });

  test('forwards when you paged into the past', async ({ page }) => {
    await page.goto('calendario');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Mes anterior' }).click();

    const hoy = page.getByRole('button', { name: 'Volver al mes actual' });
    await expect(hoy).toBeVisible();
    await expect(hoy.locator('svg.tabler-icon-arrow-forward-up')).toBeVisible();
  });
});
