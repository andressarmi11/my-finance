import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/**
 * Redesign §9b / pending 8: the date is a chip ("Hoy") that opens a month
 * grid inside the sheet. A future date stays pending (and says so); a past
 * one counts as already paid.
 */
test('picking tomorrow leaves the expense pending; yesterday marks it paid', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Cena del viernes');
  await dialog.getByLabel('Valor', { exact: true }).fill('60000');

  const chip = dialog.getByRole('button', { name: /^Elegir fecha/ });
  await expect(chip).toHaveText(/Hoy/);
  await chip.click();
  await dialog.getByRole('button', { name: 'Mañana', exact: true }).click();
  await expect(chip).toHaveText(/Mañana/);
  await expect(dialog.getByText('Queda pendiente y te avisamos')).toBeVisible();

  await dialog.getByRole('button', { name: 'Ayer', exact: true }).click();
  await expect(chip).toHaveText(/Ayer/);
  await expect(dialog.getByText('Queda pendiente y te avisamos')).toBeHidden();

  await dialog.getByRole('button', { name: 'Mañana', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Marcar Cena del viernes como pagado' })).toBeVisible();
});
