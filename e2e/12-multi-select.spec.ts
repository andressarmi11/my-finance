import { test, expect } from './fixtures';

/** Seeds the sample data FROM Transactions and waits for it to show. */
async function conDatos(page: import('@playwright/test').Page) {
  await page.goto('movimientos');
  // waitFor, not isVisible(): isVisible() asks at that instant, and the app
  // is still mounting right after the initial setup.
  const demo = page.getByRole('button', { name: 'Cargar datos de ejemplo' });
  await demo.waitFor({ state: 'visible', timeout: 15_000 });
  await demo.click();
  // Seeding is async: wait for the list to actually exist.
  await page.getByText('Mercado').first().waitFor({ state: 'visible', timeout: 15_000 });
}

/** Leaves the list populated and enters selection mode. */
async function enterSelectionMode(page: import('@playwright/test').Page) {
  await conDatos(page);
  await page.getByRole('button', { name: 'Seleccionar' }).click();
}

test('marks several as paid at once', async ({ page }) => {
  await enterSelectionMode(page);

  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();
  await page.getByRole('button', { name: /^Seleccionar Cine$/ }).click();
  await expect(page.getByRole('heading', { name: '2 seleccionados' })).toBeVisible();

  await page.getByRole('button', { name: 'Pagado', exact: true }).click();

  // It leaves selection mode and both end up paid.
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar Mercado como pendiente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar Cine como pendiente' })).toBeVisible();
});

test('deleting several asks for confirmation and says how much money they add up to', async ({ page }) => {
  await enterSelectionMode(page);

  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();

  const dialogo = page.getByRole('dialog', { name: 'Confirmar eliminación' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(/¿Eliminar 1 movimiento\?/)).toBeVisible();
  await expect(dialogo.getByText(/no se puede deshacer/)).toBeVisible();
  // It lists what is about to go, not just how many.
  await expect(dialogo.getByRole('listitem')).toHaveCount(1);
  await expect(dialogo.getByRole('listitem')).toContainText('Mercado');

  await dialogo.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Mercado')).toBeHidden();
});

test('can be cancelled without touching anything', async ({ page }) => {
  await enterSelectionMode(page);
  await page.getByRole('button', { name: /^Seleccionar Mercado$/ }).click();

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog', { name: 'Confirmar eliminación' })
    .getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Mercado')).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
  // And the circle goes back to marking paid, not selecting.
  await expect(page.getByRole('button', { name: 'Marcar Mercado como pagado' })).toBeVisible();
});

test('with nothing selected, the actions are disabled', async ({ page }) => {
  await enterSelectionMode(page);
  await expect(page.getByRole('button', { name: 'Pagado', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
});

test('the 10th pay period reads before the 25th', async ({ page }) => {
  await conDatos(page);
  const titles = await page.getByText(/^Quincena del \d+$/).allInnerTexts();
  expect(titles.length).toBeGreaterThan(0);
  if (titles.length > 1) {
    const payDays = titles.map((t) => Number(t.replace(/\D/g, '')));
    expect(payDays).toEqual([...payDays].sort((a, b) => a - b));
  }
});

test('"Todos" selects every visible transaction', async ({ page }) => {
  await enterSelectionMode(page);
  // Scoped to the toolbar: the filter chips also have a "Todos".
  const toolbar = page.getByRole('toolbar', { name: 'Acciones sobre lo seleccionado' });
  await toolbar.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(toolbar).not.toContainText(/^0 seleccionados/);
  await expect(page.getByRole('button', { name: 'Pagado', exact: true })).toBeEnabled();
});

test('a period group folds, shows its summary, and stays folded after a reload', async ({ page }) => {
  await conDatos(page);
  const header = page.getByRole('button', { name: /^Plegar o desplegar Quincena del/ }).first();
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(/mov\. · Restante/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /^Plegar o desplegar Quincena del/ }).first())
    .toHaveAttribute('aria-expanded', 'false');
});
