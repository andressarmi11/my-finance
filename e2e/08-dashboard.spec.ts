import { test, expect } from './fixtures';

test('ver el dashboard con datos de ejemplo', async ({ page }) => {
  await page.goto('');
  await expect(page.getByText('Todavía no hay movimientos')).toBeVisible();

  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();

  await expect(page.getByText('Te queda este mes')).toBeVisible();
  // Los cuatro componentes del mes: ninguno puede leerse como negativo.
  await expect(page.getByText('Ya recibiste')).toBeVisible();
  await expect(page.getByText('Falta pagar', { exact: true })).toBeVisible();
  // Proximos movimientos, acotados al mes y con las dos direcciones.
  await expect(page.getByText('Esperas recibir')).toBeVisible();
  await expect(page.getByText('Esperas gastar')).toBeVisible();
});

test('navegar al mes anterior y volver a hoy', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByText('Te queda este mes')).toBeVisible();

  await page.getByRole('button', { name: 'Mes anterior' }).click();
  // Al salir del mes actual aparece el atajo para volver.
  const volver = page.getByRole('button', { name: 'Volver al mes actual' });
  await expect(volver).toBeVisible();
  await volver.click();
  await expect(volver).toBeHidden();
});
