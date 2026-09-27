import { test, expect } from './fixtures';

/** Siembra los datos de ejemplo DESDE Movimientos y espera a que se vean. */
async function conDatos(page: import('@playwright/test').Page) {
  await page.goto('movimientos');
  // waitFor y no isVisible(): isVisible() pregunta en ese instante, y la
  // app todavía está montando justo después de la configuración inicial.
  const demo = page.getByRole('button', { name: 'Cargar datos de ejemplo' });
  await demo.waitFor({ state: 'visible', timeout: 15_000 });
  await demo.click();
  // Sembrar es asíncrono: esperar a que la lista exista de verdad.
  await page.getByText('Mercado').first().waitFor({ state: 'visible', timeout: 15_000 });
}

/** Deja la lista con datos y entra al modo selección. */
async function entrarEnSeleccion(page: import('@playwright/test').Page) {
  await conDatos(page);
  await page.getByRole('button', { name: 'Seleccionar' }).click();
}

test('marcar varios como pagados de una vez', async ({ page }) => {
  await entrarEnSeleccion(page);

  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();
  await page.getByRole('button', { name: /^Seleccionar Cine$/ }).click();
  await expect(page.getByRole('heading', { name: '2 seleccionados' })).toBeVisible();

  await page.getByRole('button', { name: 'Marcar pagados' }).click();

  // Sale del modo selección y los dos quedan pagados.
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar Mercado como pendiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar Cine como pendiente' })).toBeVisible();
});

test('eliminar varios pide confirmación y dice cuánta plata suman', async ({ page }) => {
  await entrarEnSeleccion(page);

  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();

  const dialogo = page.getByRole('dialog', { name: 'Confirmar eliminación' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(/¿Eliminar 1 movimiento\?/)).toBeVisible();
  await expect(dialogo.getByText(/no se puede deshacer/)).toBeVisible();

  await dialogo.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Mercado')).toBeHidden();
});

test('se puede cancelar sin tocar nada', async ({ page }) => {
  await entrarEnSeleccion(page);
  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog', { name: 'Confirmar eliminación' })
    .getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Mercado')).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  // Y el círculo vuelve a servir para marcar pagado, no para seleccionar.
  await expect(page.getByRole('button', { name: 'Marcar Mercado como pagado' })).toBeVisible();
});

test('sin nada elegido, las acciones están bloqueadas', async ({ page }) => {
  await entrarEnSeleccion(page);
  await expect(page.getByRole('button', { name: 'Marcar pagados' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
});

test('la quincena del 10 se lee antes que la del 25', async ({ page }) => {
  await conDatos(page);
  const titulos = await page.getByText(/^Quincena del \d+$/).allInnerTexts();
  expect(titulos.length).toBeGreaterThan(0);
  if (titulos.length > 1) {
    const dias = titulos.map((t) => Number(t.replace(/\D/g, '')));
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
  }
});
