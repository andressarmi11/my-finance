import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/**
 * Redesign §2: three tabs (Inicio, Análisis, Ajustes) in a floating pill,
 * with the + beside it. Movimientos hangs from Inicio, so Inicio stays lit
 * there, and the calendar is a view of Movimientos, not a tab.
 */
test('three tabs, and Inicio stays active on Movimientos', async ({ page }) => {
  await page.goto('');
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Análisis', 'Ajustes']);

  const inicio = nav.getByRole('link', { name: 'Inicio' });
  const bg = () => inicio.evaluate((el) => getComputedStyle(el).backgroundColor);
  // Polled: the background fades in and out (a short transition).
  await expect.poll(bg).not.toBe('rgba(0, 0, 0, 0)');
  const activeBg = await bg();

  await page.goto('movimientos');
  await expect.poll(bg).toBe(activeBg);

  await nav.getByRole('link', { name: 'Análisis' }).click();
  await expect(page).toHaveURL(/\/analisis$/);
  await expect.poll(bg).toBe('rgba(0, 0, 0, 0)');
});

test('the + sits beside the pill, not over the content', async ({ page }) => {
  await page.goto('');
  const nav = await page.getByRole('navigation', { name: 'Navegación principal' }).boundingBox();
  const add = await page.getByRole('button', { name: 'Agregar movimiento' }).boundingBox();
  expect(add!.x).toBeGreaterThan(nav!.x + nav!.width);
  // Same row: the vertical centres line up.
  expect(Math.abs((add!.y + add!.height / 2) - (nav!.y + nav!.height / 2))).toBeLessThan(2);
});
