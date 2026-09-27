import { test, expect } from './fixtures';

test.use({ reducedMotion: 'reduce' });

async function agregar(page: import('@playwright/test').Page, concepto: string, monto: string, tipo?: 'ingreso') {
  await page.goto(`movimientos?nuevo=1${tipo ? `&tipo=${tipo}` : ''}`);
  const d = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await d.getByPlaceholder('Ej. Restaurante').fill(concepto);
  await d.getByPlaceholder('$ 0').fill(monto);
  await d.getByRole('button', { name: 'Débito' }).click();
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

test.describe('filtros de la lista', () => {
  test('por tipo deja solo ese tipo, y el restante del encabezado NO se mueve', async ({ page }) => {
    await agregar(page, 'Sueldo', '3000000', 'ingreso');
    await agregar(page, 'Mercado', '200000');

    await page.goto('movimientos');
    const restante = page.getByText('Restante').locator('xpath=following-sibling::*[1]');
    const antes = await restante.textContent();

    await page.getByRole('button', { name: 'Ingresos' }).click();
    await expect(page.getByText('Sueldo')).toBeVisible();
    await expect(page.getByText('Mercado')).toBeHidden();

    // El filtro es presentacion: acota lo que se lista, no el balance.
    expect(await restante.textContent()).toBe(antes);
  });

  test('el chip se apaga al volver a tocarlo', async ({ page }) => {
    await agregar(page, 'Sueldo', '3000000', 'ingreso');
    await agregar(page, 'Mercado', '200000');

    await page.goto('movimientos');
    await page.getByRole('button', { name: 'Gastos' }).click();
    await expect(page.getByText('Sueldo')).toBeHidden();
    await page.getByRole('button', { name: 'Gastos' }).click();
    await expect(page.getByText('Sueldo')).toBeVisible();
  });

  test('Análisis tiene quincena, y dice el rango con días', async ({ page }) => {
    await agregar(page, 'Mercado', '200000');
    await page.goto('analisis');
    await page.getByRole('button', { name: 'quincena' }).click();
    // La quincena cruza el cambio de mes, asi que se rotula con dias.
    await expect(page.getByText(/\d+ \w{3} – \d+ \w{3}/)).toBeVisible();
  });
});

test('el botón de Excel dispara la descarga con el nombre correcto', async ({ page }) => {
  await agregar(page, 'Mercado', '200000');

  await page.goto('ajustes');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar Excel/ }).click();
  const archivo = await descarga;

  expect(archivo.suggestedFilename()).toMatch(/^step-up-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(await archivo.failure()).toBeNull();
});
