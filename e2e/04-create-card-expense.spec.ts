import { test, expect } from './fixtures';

test('crear un gasto con tarjeta de crédito', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });

  await dialog.getByPlaceholder('Ej. Restaurante').fill('Compra con TC');
  await dialog.getByPlaceholder('$ 0').fill('150000');
  await dialog.getByRole('button', { name: 'Tarjeta de crédito' }).click();

  // El preview de "Se paga el ..." debe aparecer ANTES de guardar.
  await expect(dialog.getByText(/Se paga el/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Compra con TC')).toBeVisible();
  await expect(page.getByText(/se paga el/)).toBeVisible();
});
