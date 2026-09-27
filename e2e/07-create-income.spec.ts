import { test, expect } from './fixtures';

test('crear un ingreso', async ({ page }) => {
  // El tipo se elige por query param (?tipo=ingreso) o long-press del FAB.
  // El toggle Gasto/Ingreso dentro del form ya no existe (Fase 3).
  await page.goto('movimientos?nuevo=1&tipo=ingreso');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });

  await dialog.getByPlaceholder('Ej. Restaurante').fill('Pago freelance');
  await dialog.getByPlaceholder('$ 0').fill('1200000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Pago freelance')).toBeVisible();
  await expect(page.getByText('+ $ 1.200.000').first()).toBeVisible();
});
