import { test, expect, type Page } from './fixtures';

/**
 * La compra con tarjeta de credito NO te quita la plata el dia que la haces:
 * te la quita el dia que pagas el extracto, que puede caer dos meses
 * despues. Antes se descontaba de una, asi que el mes de la compra mostraba
 * menos plata de la que en realidad tenias.
 *
 * El movimiento SI queda registrado en el mes de la compra — lo que se mueve
 * es el descuento, no el registro. Por eso el test mira las dos cosas.
 */

// Sin animacion, el numero del hero se lee de una en vez de estar contando.
test.use({ reducedMotion: 'reduce' });

/** "Te queda este mes", en pesos. */
async function teQueda(page: Page): Promise<number> {
  const valor = page.getByText('Te queda este mes').locator('xpath=following-sibling::*[1]');
  const texto = (await valor.textContent()) ?? '';
  const digitos = texto.replace(/[^\d-]/g, '');
  return Number(digitos);
}

// El tipo se elige por query param; el toggle Gasto/Ingreso ya no existe.
async function agregar(page: Page, concepto: string, monto: string, metodo?: string, tipo?: 'ingreso') {
  await page.goto(`movimientos?nuevo=1${tipo ? `&tipo=${tipo}` : ''}`);
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill(concepto);
  await dialog.getByPlaceholder('$ 0').fill(monto);
  if (metodo) await dialog.getByRole('button', { name: metodo }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

/** El dashboard vacio no dibuja el hero, asi que siempre hay que sembrar algo. */
async function conSueldo(page: Page) {
  await agregar(page, 'Sueldo', '3000000', 'Débito', 'ingreso');
}

test('un gasto con tarjeta no se descuenta del mes en que se compró', async ({ page }) => {
  await conSueldo(page);
  await page.goto('');
  const antes = await teQueda(page);

  await agregar(page, 'Compra con TC', '500000', 'Tarjeta de crédito');

  await page.goto('');
  expect(await teQueda(page)).toBe(antes);

  // "Falta pagar" tampoco se mueve: esa plata no sale este mes.
  const faltaPagar = page.getByText('Falta pagar').locator('xpath=following-sibling::*[1]');
  await expect(faltaPagar).toHaveText(/\$\s?0/);
});

test('un gasto sin tarjeta sí se descuenta de una', async ({ page }) => {
  await conSueldo(page);
  await page.goto('');
  const antes = await teQueda(page);

  await agregar(page, 'Mercado', '120000', 'Débito');

  await page.goto('');
  expect(await teQueda(page)).toBe(antes - 120_000);
});

test('la compra con tarjeta sigue apareciendo en la lista del mes en que se hizo', async ({ page }) => {
  await agregar(page, 'Compra con TC', '500000', 'Tarjeta de crédito');

  await page.goto('movimientos');
  await expect(page.getByText('Compra con TC')).toBeVisible();
  await expect(page.getByText(/se paga el/)).toBeVisible();
});
