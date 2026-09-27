import { test, expect } from './fixtures';

test('eliminar un gasto', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Gasto a borrar');
  await dialog.getByPlaceholder('$ 0').fill('20000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Gasto a borrar')).toBeVisible();

  await page.getByText('Gasto a borrar').click();
  const editDialog = page.getByRole('dialog', { name: 'Editar movimiento' });
  await editDialog.getByRole('button', { name: 'Eliminar' }).click();

  await expect(editDialog).toBeHidden();
  await expect(page.getByText('Gasto a borrar')).not.toBeVisible();
});
