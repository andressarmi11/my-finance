import { test, expect } from './fixtures';

test('shows the payment date of a card purchase on the card screen', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Zapatos');
  await dialog.getByPlaceholder('$ 0').fill('210000');
  await dialog.getByRole('button', { name: 'Tarjeta de crédito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('tarjeta');
  await expect(page.getByText(/Se paga el/)).toBeVisible();
  await expect(page.getByText('Zapatos')).toBeVisible();
  await expect(page.getByText('$ 210.000').first()).toBeVisible();
});
