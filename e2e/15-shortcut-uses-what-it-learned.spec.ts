import { test, expect } from './fixtures';

const FRASE = 'mercado 45 mil';

/**
 * The Shortcut's link has to learn just like the rest of the app.
 *
 * There were three paths interpreting free text —quick entry, the inbox and
 * this link— and the link used ONLY the keyword table. You corrected the
 * category in the app, it learned, and coming in through the Shortcut it
 * proposed the same old one again. From the outside it looked like it never
 * learned.
 */
test('the Shortcut link respects the category you corrected', async ({ page }) => {
  // 1. The keyword table sends "mercado" to Alimentación.
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet.getByLabel('Qué pasó').fill(FRASE);
  await expect(sheet.getByText('Lo puse en Alimentación.')).toBeVisible();

  // 2. The user corrects it to Hogar and saves: that's where it learns.
  await sheet.getByRole('button', { name: /Hogar/ }).click();
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();

  // Wait for PROOF that the learning was written, not for a while.
  // "Anotado" confirms the transaction; the concept index is written
  // separately, and navigating before it finished left the test at the
  // mercy of the clock: it only failed when the suite ran in parallel.
  await sheet.getByLabel('Qué pasó').fill(FRASE);
  await expect(sheet.getByText('Lo puse en Hogar, como la última vez.')).toBeVisible();

  // 3. The same phrase coming in through the Shortcut's link.
  await page.goto(`movimientos?texto=${encodeURIComponent(FRASE)}`);
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();

  // It has to arrive with Hogar, not with what the keyword table says.
  await expect(dialog.getByRole('button', { name: /Hogar/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: /Alimentación/ })).toHaveAttribute('aria-pressed', 'false');
});
