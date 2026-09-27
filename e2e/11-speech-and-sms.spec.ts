import { test, expect } from './fixtures';

test('contarle a la app en español guarda el movimiento', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await expect(sheet).toBeVisible();

  await sheet.getByLabel('Qué pasó').fill('gasté 45 mil en el almuerzo');

  // Devuelve en español lo que entendió, antes de guardar nada.
  await expect(sheet.getByText('Gasto de $ 45.000, en Almuerzo, hoy,', { exact: false })).toBeVisible();
  await expect(sheet.getByText('Lo puse en Alimentación.')).toBeVisible();

  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText('Anotado: $ 45.000 en Almuerzo.')).toBeVisible();

  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await page.goto('movimientos');
  await expect(page.getByText('Almuerzo').first()).toBeVisible();
  await expect(page.getByText('$ 45.000').first()).toBeVisible();
});

test('pide lo que falta en vez de inventarlo', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet.getByLabel('Qué pasó').fill('gasté en el almuerzo');
  await expect(sheet.getByText('¿Cuánto fue?')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
});

test('aprende: la categoría corregida se repite la próxima vez', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });

  // "peluquería" no está en la tabla de palabras clave: no sabe.
  await sheet.getByLabel('Qué pasó').fill('gasté 30 mil en peluqueria');
  await expect(sheet.getByText(/No le encontré categoría/)).toBeVisible();

  // El usuario la corrige y guarda: ahí es donde aprende.
  await sheet.getByRole('button', { name: /Salud/ }).click();
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();

  // Misma frase otra vez: ahora sí sabe, y lo dice.
  await sheet.getByLabel('Qué pasó').fill('gasté 30 mil en peluqueria');
  await expect(sheet.getByText('Lo puse en Salud, como la última vez.')).toBeVisible();
});

/**
 * Esta URL es la que arma el Atajo de iOS con el SMS del banco.
 * Si se rompe, la automatización del teléfono deja de funcionar en silencio.
 */
test('un SMS de banco entra por URL y queda interpretado', async ({ page }) => {
  const sms = 'Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32';
  await page.goto(`movimientos?texto=${encodeURIComponent(sms)}`);

  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Valor')).toHaveValue('$ 145.000');
  await expect(dialog.getByPlaceholder('Ej. Restaurante')).toHaveValue(/exito/i);
  await expect(dialog.getByText('Nuevo gasto')).toBeVisible();
});

test('la URL sin monto abre el formulario listo para escribirlo', async ({ page }) => {
  await page.goto('movimientos?nuevo=1&tipo=ingreso');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nuevo ingreso')).toBeVisible();
  await expect(dialog.getByLabel('Valor')).toHaveValue('');
});
