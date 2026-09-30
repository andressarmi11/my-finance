import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('shows the payment date of a card purchase on the card screen', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Zapatos');
  await dialog.getByLabel('Valor', { exact: true }).fill('210000');
  // Redesign §9b: the method is Débito | Crédito | Efectivo; with one card, Crédito picks it.
  await dialog.getByRole('button', { name: 'Crédito', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('tarjeta');
  await expect(page.getByText(/Se paga el/)).toBeVisible();
  await expect(page.getByText('Zapatos')).toBeVisible();
  await expect(page.getByText('$ 210.000').first()).toBeVisible();
});
