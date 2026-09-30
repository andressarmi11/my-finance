import { test, expect } from './fixtures';

test('creates an expense on a credit card', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });

  await dialog.getByPlaceholder('Ej. Restaurante').fill('Compra con TC');
  await dialog.getByPlaceholder('$ 0').fill('150000');
  // Redesign §9b: the method is Débito | Crédito | Efectivo; with one card, Crédito picks it.
  await dialog.getByRole('button', { name: 'Crédito', exact: true }).click();

  // The "Corte … · se paga el …" preview has to appear BEFORE saving.
  await expect(dialog.getByText(/Corte 15 · se paga el/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Compra con TC')).toBeVisible();
  await expect(page.getByText(/se paga el/)).toBeVisible();
});
