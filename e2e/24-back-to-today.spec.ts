import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Getting back to the current month in one tap, from any distance.
 *
 * The feature half-existed: the button was the month's LABEL, which only
 * changed colour once you drifted away. Nobody could guess it, and Calendar
 * didn't even have it because it duplicated the navigator instead of
 * reusing it.
 */
test.use({ reducedMotion: 'reduce' });

/** Moves n months away by tapping the arrow, the way a person would. */
async function avanzar(page: Page, meses: number) {
  const next = page.getByRole('button', { name: 'Mes siguiente' });
  for (let i = 0; i < meses; i++) await next.click();
}

test.describe('transactions', () => {
  test('does not offer to go back if you are already on the current month', async ({ page }) => {
    await page.goto('movimientos');
    await expect(page.getByRole('button', { name: 'Volver al mes actual' })).toBeHidden();
  });

  test('14 months away, one tap returns to the current month', async ({ page }) => {
    await page.goto('movimientos');
    const initialLabel = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    await avanzar(page, 14);
    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).not.toBe(initialLabel);

    await page.getByRole('button', { name: 'Volver al mes actual' }).click();
    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).toBe(initialLabel);

    // And once back, the button disappears: there's nowhere left to go back to.
    await expect(page.getByRole('button', { name: 'Volver al mes actual' })).toBeHidden();
  });

  test('it also works going backwards', async ({ page }) => {
    await page.goto('movimientos');
    const inicial = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    const previous = page.getByRole('button', { name: 'Mes anterior' });
    for (let i = 0; i < 8; i++) await previous.click();

    await page.getByRole('button', { name: 'Volver al mes actual' }).click();
    expect(await previous.locator('xpath=following-sibling::*[1]').textContent()).toBe(inicial);
  });
});

test.describe('calendar', () => {
  test('the old /calendario path opens the Calendar view of Movimientos', async ({ page }) => {
    await page.goto('calendario');
    await expect(page).toHaveURL(/\/movimientos\?vista=calendario$/);
    await expect(page.getByRole('button', { name: 'Calendario', pressed: true })).toBeVisible();
  });

  test('14 months away, it returns to the current month AND leaves today selected', async ({ page }) => {
    await page.goto('movimientos?vista=calendario');
    const inicial = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    await avanzar(page, 14);
    await page.getByRole('button', { name: 'Volver al mes actual' }).click();

    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).toBe(inicial);

    // Returning to the month but landing on another month's day would be only half a return.
    const today = new Date();
    const day = String(today.getDate());
    await expect(page.getByRole('heading', { level: 2 })).toContainText(day);
  });
});
