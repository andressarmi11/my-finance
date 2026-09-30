import { test, expect } from './fixtures';

/**
 * A fixed expense you delete has to stay deleted.
 *
 * Materializing read only the LIVE transactions to know which occurrences
 * already existed. The one you deleted stopped being among the live ones,
 * so on the next start-up —or when navigating between months— it was reborn.
 * From the outside it looked as if the app ignored the deletion.
 */
test('a deleted recurring transaction does not come back on reload', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Gimnasio Zombi');
  await dialog.getByLabel('Valor', { exact: true }).fill('100000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('movimientos');
  await expect(page.getByText('Gimnasio Zombi').first()).toBeVisible();

  // Delete it from multi-select.
  await page.getByRole('button', { name: 'Seleccionar' }).click();
  await page.getByRole('button', { name: /^Seleccionar Gimnasio Zombi$/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirmar = page.getByRole('dialog', { name: 'Confirmar eliminación' });
  await confirmar.getByRole('button', { name: 'Sí, eliminar' }).click();
  // The confirmation lists what it deletes, so wait for it to close first.
  await expect(confirmar).toBeHidden();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();

  // Reloading runs materializeRecurringRules() again: this is where it came back.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();

  // And it doesn't come back when leaving and re-entering the month either (ensureMonthMaterialized).
  await page.getByRole('button', { name: /mes siguiente|siguiente/i }).first().click();
  await page.getByRole('button', { name: /mes anterior|anterior/i }).first().click();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();
});
