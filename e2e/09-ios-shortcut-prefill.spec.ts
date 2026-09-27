import { test, expect } from './fixtures';

/**
 * La URL con parametros es la puerta de entrada de los Atajos de iOS
 * (ver docs/ATAJOS_IOS.md). Si esto se rompe, la automatizacion del
 * telefono deja de funcionar sin que nadie se entere.
 */
test('un atajo abre el formulario ya lleno', async ({ page }) => {
  await page.goto('movimientos?nuevo=1&tipo=ingreso&monto=3000000&concepto=Sueldo&pagado=1');

  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nuevo ingreso')).toBeVisible();
  await expect(dialog.getByLabel('Valor')).toHaveValue('$ 3.000.000');
  await expect(dialog.getByPlaceholder('Ej. Restaurante')).toHaveValue('Sueldo');
  await expect(dialog.getByRole('button', { name: 'Ya lo recibiste' })).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Sueldo')).toBeVisible();
});
