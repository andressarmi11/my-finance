import { test, expect } from './fixtures';

test('creates a recurring (fixed) expense and shows its instance in transactions', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Gimnasio E2E');
  await dialog.getByLabel('Valor', { exact: true }).fill('100000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Gimnasio E2E').first()).toBeVisible();

  // The rule materializes into a real instance when saved.
  await page.goto('movimientos');
  await expect(page.getByText('Gimnasio E2E').first()).toBeVisible();
});
