import { test, expect } from './fixtures';

/**
 * Un gasto fijo que borras tiene que quedarse borrado.
 *
 * Materializar leía solo las transacciones VIVAS para saber qué ocurrencias
 * ya existían. La que borrabas dejaba de estar entre las vivas, así que en
 * el siguiente arranque —o al navegar de mes— volvía a nacer. Desde fuera
 * se veía como si la app ignorara el borrado.
 */
test('un movimiento recurrente borrado no vuelve al recargar', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('Ej. Arriendo').fill('Gimnasio Zombi');
  await dialog.getByPlaceholder('$ 0').fill('100000');
  await dialog.getByRole('button', { name: 'Mensual' }).click();
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('movimientos');
  await expect(page.getByText('Gimnasio Zombi').first()).toBeVisible();

  // Borrarlo desde la selección múltiple.
  await page.getByRole('button', { name: 'Seleccionar' }).click();
  await page.getByRole('button', { name: /^Seleccionar Gimnasio Zombi$/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const confirmar = page.getByRole('dialog', { name: 'Confirmar eliminación' });
  await confirmar.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();

  // Recargar corre materializeRecurringRules() otra vez: acá resucitaba.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();

  // Y tampoco revive al salir y volver al mes (ensureMonthMaterialized).
  await page.getByRole('button', { name: /mes siguiente|siguiente/i }).first().click();
  await page.getByRole('button', { name: /mes anterior|anterior/i }).first().click();
  await expect(page.getByText('Gimnasio Zombi')).toBeHidden();
});
