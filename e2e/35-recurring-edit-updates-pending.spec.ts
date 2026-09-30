import { test, expect } from './fixtures';

/**
 * Editing a rule's amount reaches the pending copies that are still ahead,
 * and leaves alone the one already paid (that one is history).
 */
test('editing the amount updates upcoming pending payments but not a paid one', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Gym E2E');
  await dialog.getByLabel('Valor', { exact: true }).fill('100000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  // Today's day, so the first copy is dated today (and counts as "paid" once marked).
  await dialog.getByLabel('Cada mes, el día').fill(String(new Date().getDate()));
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  // Pay this month's copy.
  await page.goto('movimientos');
  await page.getByRole('button', { name: 'Marcar Gym E2E como pagado' }).first().click();
  await expect(page.getByRole('button', { name: 'Marcar Gym E2E como pendiente' })).toBeVisible();

  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: /Gym E2E/ }).click();
  const edit = page.getByRole('dialog', { name: 'Editar' });
  await edit.getByLabel('Valor', { exact: true }).fill('150000');
  await expect(edit.getByRole('status')).toContainText(/Se actualizarán los \d+ pendientes desde el/);
  await edit.getByRole('button', { name: /^Guardar y actualizar \d+$/ }).click();
  await expect(page.getByRole('status')).toContainText(/Se actualizaron \d+ pagos futuros/);

  // This month: still 100.000 (paid, history). Next month: 150.000.
  await page.goto('movimientos');
  await expect(page.getByText(/100\.000/).first()).toBeVisible();
  await expect(page.getByText(/150\.000/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText(/150\.000/).first()).toBeVisible();
});
