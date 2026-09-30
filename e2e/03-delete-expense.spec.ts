import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('deletes an expense', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Gasto a borrar');
  await dialog.getByLabel('Valor', { exact: true }).fill('20000');
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
