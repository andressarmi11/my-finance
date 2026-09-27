import { test, expect } from './fixtures';

async function crearGasto(page: import('@playwright/test').Page, concepto: string, valor: string) {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill(concepto);
  await dialog.getByPlaceholder('$ 0').fill(valor);
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('editar un gasto existente', async ({ page }) => {
  await crearGasto(page, 'Gasto editable', '10000');

  await page.getByText('Gasto editable').click();
  const editDialog = page.getByRole('dialog', { name: 'Editar movimiento' });
  await expect(editDialog).toBeVisible();

  const amountInput = editDialog.getByPlaceholder('$ 0');
  await amountInput.fill('99000');
  await editDialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(editDialog).toBeHidden();
  await expect(page.getByText('$ 99.000').first()).toBeVisible();
  await expect(page.getByText('$ 10.000')).not.toBeVisible();
});
