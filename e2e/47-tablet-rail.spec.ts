import { test, expect } from './fixtures';

/**
 * Redesign §9g — tablet (760–1099px): the tab bar becomes a 72px rail on
 * the left with the + on top, Screen stays a centred 560px column, and
 * every sheet opens as a centred 480px dialog instead of sliding up.
 */
test.use({ viewport: { width: 900, height: 900 } });

test('the tabs are a 72px rail on the left, the + on top of it', async ({ page }) => {
  await page.goto('');
  const rail = page.getByTestId('tab-rail');
  const box = (await rail.boundingBox())!;
  expect(box.x).toBe(0);
  expect(Math.round(box.width)).toBe(72);
  expect(Math.round(box.height)).toBe(900);

  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Análisis', 'Ajustes']);
  const add = (await page.getByRole('button', { name: 'Agregar movimiento' }).boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  // Inside the rail, above the tabs.
  expect(add.x + add.width).toBeLessThanOrEqual(72);
  expect(add.y + add.height).toBeLessThanOrEqual(navBox.y);

  // No sidebar: that's desktop.
  await expect(page.getByRole('complementary', { name: 'Barra lateral' })).toHaveCount(0);

  // The content keeps a phone's column, centred in what the rail leaves.
  await page.goto('ajustes');
  const title = (await page.getByRole('heading', { name: 'Ajustes', level: 1 }).boundingBox())!;
  expect(title.x).toBeGreaterThan(72 + 100);

  await nav.getByRole('link', { name: 'Análisis' }).click();
  await expect(page).toHaveURL(/\/analisis$/);
});

test('sheets open as a centred 480px dialog with 24px corners', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  const menu = page.getByRole('dialog', { name: 'Acción rápida' });
  const panel = menu.locator('> div').first();
  await expect(panel).toBeVisible();
  // Let the open animation (a small scale-in) finish before measuring.
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.width)).toBe(480);
  // Centred both ways, not stuck to the bottom edge.
  expect(Math.abs(box.x + box.width / 2 - 450)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(2);
  await expect(panel).toHaveCSS('border-top-left-radius', '24px');
  await expect(panel).toHaveCSS('border-bottom-left-radius', '24px');

  // The new-transaction form too, and it still saves.
  await menu.getByRole('button', { name: /Nuevo gasto/ }).click();
  const form = page.getByRole('dialog', { name: 'Agregar movimiento' });
  const formPanel = form.locator('> div').first();
  expect(await formPanel.evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(480);
  await form.getByLabel('Valor').fill('12000');
  await form.getByLabel('Concepto').fill('Café tablet');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText('Café tablet')).toBeVisible();
});
