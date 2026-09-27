import { test, expect } from './fixtures';

test('crear un gasto recurrente (fijo) y ver su instancia en movimientos', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Ej. Arriendo').fill('Gimnasio E2E');
  await dialog.getByPlaceholder('$ 0').fill('100000');
  await dialog.getByRole('button', { name: 'Mensual' }).click();
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Gimnasio E2E').first()).toBeVisible();

  // La regla se materializa en una instancia real al guardarla.
  await page.goto('movimientos');
  await expect(page.getByText('Gimnasio E2E').first()).toBeVisible();
});
