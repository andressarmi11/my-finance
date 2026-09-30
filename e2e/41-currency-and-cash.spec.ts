import { test, expect } from './fixtures';

/**
 * Redesign §9b: a transaction in another currency is stored converted (the
 * domain only ever sees the main currency) and remembers its original; the
 * method is Débito | Crédito | Efectivo.
 */
test('an expense in dollars, paid in cash, is stored converted and shows its original', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Libro de viaje');

  const currencies = dialog.getByRole('group', { name: 'Moneda' });
  await expect(currencies.getByRole('button', { name: /COP/ })).toHaveAttribute('aria-pressed', 'true');
  await currencies.getByRole('button', { name: /USD/ }).click();

  await dialog.getByLabel('Valor').fill('20');
  const rate = dialog.getByLabel(/Tasa de cambio/);
  await rate.fill('4000');
  await expect(dialog.getByText('≈ $ 80.000 COP')).toBeVisible();

  await dialog.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Libro de viaje')).toBeVisible();
  await expect(page.getByText('$ 80.000').first()).toBeVisible();
  await expect(page.getByText(/20 USD · tasa 4\.000/)).toBeVisible();
});

test('"Más" reveals the other currencies, and the one picked stays as a chip', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  const currencies = dialog.getByRole('group', { name: 'Moneda' });
  await expect(currencies.getByRole('button', { name: /MXN/ })).toHaveCount(0);
  await currencies.getByRole('button', { name: 'Más' }).click();
  await currencies.getByRole('button', { name: /MXN/ }).click();
  await expect(currencies.getByRole('button', { name: /MXN/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(currencies.getByRole('button', { name: 'Más' })).toBeVisible();
});

test('telling the app "20 dólares en efectivo" understands both', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet.getByLabel('Qué pasó').fill('gasté 20 dólares en efectivo en un taxi');

  await expect(sheet.getByText('Entendí')).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'Moneda' }).getByRole('button', { name: /USD/ }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('button', { name: 'Efectivo', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await sheet.getByLabel(/Tasa de cambio/).fill('4000');
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado: \$ 80\.000/)).toBeVisible();
});
