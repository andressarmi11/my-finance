import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/**
 * The URL with parameters is the way iOS Shortcuts get in (see
 * docs/ATAJOS_IOS.md). If this breaks, the automation on the phone stops
 * working and nobody finds out.
 */
test('a Shortcut opens the form already filled in', async ({ page }) => {
  await page.goto('movimientos?nuevo=1&tipo=ingreso&monto=3000000&concepto=Sueldo&pagado=1');

  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nuevo ingreso')).toBeVisible();
  // The symbol sits beside the figure now, grey, outside the field.
  await expect(dialog.getByLabel('Valor')).toHaveValue('3.000.000');
  await expect(dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo')).toHaveValue('Sueldo');
  // The status toggle lives under "Más opciones" (redesign §5).
  await dialog.getByRole('button', { name: 'Más opciones' }).click();
  await expect(dialog.getByRole('button', { name: 'Ya lo recibiste' })).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Sueldo')).toBeVisible();
});
