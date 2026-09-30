import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('creates an income', async ({ page }) => {
  // The type is chosen by query param (?tipo=ingreso) or a long-press on the FAB.
  // The Expense/Income toggle inside the form no longer exists.
  await page.goto('movimientos?nuevo=1&tipo=ingreso');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });

  await dialog.getByPlaceholder('Ej. Restaurante').fill('Pago freelance');
  await dialog.getByPlaceholder('$ 0').fill('1200000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Pago freelance')).toBeVisible();
  await expect(page.getByText('+ $ 1.200.000').first()).toBeVisible();
});
