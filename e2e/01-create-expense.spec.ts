import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('creates an expense', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');

  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();

  await dialog.getByPlaceholder('Ej. Restaurante').fill('Mercado de prueba');
  await dialog.getByPlaceholder('$ 0').fill('85000');
  await dialog.getByRole('button', { name: /Alimentación/ }).click();
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Mercado de prueba')).toBeVisible();
  await expect(page.getByText('$ 85.000').first()).toBeVisible();
});
