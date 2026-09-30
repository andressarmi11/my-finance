import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

async function createExpense(page: import('@playwright/test').Page, concept: string, value: string) {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill(concept);
  await dialog.getByLabel('Valor', { exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('edits an existing expense', async ({ page }) => {
  await createExpense(page, 'Gasto editable', '10000');

  await page.getByText('Gasto editable').click();
  const editDialog = page.getByRole('dialog', { name: 'Editar movimiento' });
  await expect(editDialog).toBeVisible();

  const amountInput = editDialog.getByLabel('Valor', { exact: true });
  await amountInput.fill('99000');
  await editDialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(editDialog).toBeHidden();
  await expect(page.getByText('$ 99.000').first()).toBeVisible();
  await expect(page.getByText('$ 10.000')).not.toBeVisible();
});
