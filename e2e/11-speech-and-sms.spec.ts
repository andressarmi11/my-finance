import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('telling the app in Spanish saves the transaction', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Contarle a la app' });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel('Qué pasó').fill('gasté 45 mil en el almuerzo');

  // It echoes back in Spanish what it understood, before saving anything.
  const understood = sheet.getByRole('region', { name: 'Entendí' });
  await expect(understood).toContainText('Almuerzo');
  await expect(understood).toContainText('$ 45.000');
  await expect(understood).toContainText('hoy');
  await expect(sheet.getByText('Lo puse en Alimentación.')).toBeVisible();

  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText('Anotado: $ 45.000 en Almuerzo.')).toBeVisible();

  await sheet.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('movimientos');
  await expect(page.getByText('Almuerzo').first()).toBeVisible();
  await expect(page.getByText('$ 45.000').first()).toBeVisible();
});

test('asks for the missing part instead of making it up', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Contarle a la app' });
  await sheet.getByLabel('Qué pasó').fill('gasté en el almuerzo');
  await expect(sheet.getByText('¿Cuánto fue?')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
});

test('it learns: a corrected category repeats next time', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contarle a la app' });

  // "peluquería" isn't in the keyword table: it doesn't know.
  await sheet.getByLabel('Qué pasó').fill('gasté 30 mil en peluqueria');
  await expect(sheet.getByText(/No le encontré categoría/)).toBeVisible();

  // The user corrects it and saves: that's where it learns.
  await sheet.getByRole('button', { name: /Salud/ }).click();
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();

  // The same phrase again: now it does know, and says so.
  await sheet.getByLabel('Qué pasó').fill('gasté 30 mil en peluqueria');
  await expect(sheet.getByText('Lo puse en Salud, como la última vez.')).toBeVisible();
});

/**
 * This URL is the one the iOS Shortcut builds from the bank's SMS.
 * If it breaks, the phone's automation silently stops working.
 */
test('a bank SMS comes in through a URL and ends up interpreted', async ({ page }) => {
  const sms = 'Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32';
  await page.goto(`movimientos?texto=${encodeURIComponent(sms)}`);

  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Valor')).toHaveValue('145.000');
  await expect(dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo')).toHaveValue(/exito/i);
  await expect(dialog.getByText('Nuevo gasto')).toBeVisible();
});

test('a URL with no amount opens the form ready to type it', async ({ page }) => {
  await page.goto('movimientos?nuevo=1&tipo=ingreso');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nuevo ingreso')).toBeVisible();
  await expect(dialog.getByLabel('Valor')).toHaveValue('');
});
