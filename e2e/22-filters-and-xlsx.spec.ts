import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test.use({ reducedMotion: 'reduce' });

async function agregar(page: import('@playwright/test').Page, concept: string, amount: string, type?: 'ingreso') {
  await page.goto(`movimientos?nuevo=1${type ? `&tipo=${type}` : ''}`);
  const d = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await d.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill(concept);
  await d.getByLabel('Valor', { exact: true }).fill(amount);
  await d.getByRole('button', { name: 'Débito' }).click();
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

test.describe('list filters', () => {
  test('filtering by type leaves only that type, and the header remainder does NOT move', async ({ page }) => {
    await agregar(page, 'Sueldo', '3000000', 'ingreso');
    await agregar(page, 'Mercado', '200000');

    await page.goto('movimientos');
    const remainder = page.getByText('Restante').locator('xpath=following-sibling::*[1]');
    const antes = await remainder.textContent();

    await page.getByRole('button', { name: 'Ingresos' }).click();
    await expect(page.getByText('Sueldo')).toBeVisible();
    await expect(page.getByText('Mercado')).toBeHidden();

    // The filter is presentation: it narrows what gets listed, not the balance.
    expect(await remainder.textContent()).toBe(antes);
  });

  test('the chip switches off when tapped again', async ({ page }) => {
    await agregar(page, 'Sueldo', '3000000', 'ingreso');
    await agregar(page, 'Mercado', '200000');

    await page.goto('movimientos');
    await page.getByRole('button', { name: 'Gastos' }).click();
    await expect(page.getByText('Sueldo')).toBeHidden();
    await page.getByRole('button', { name: 'Gastos' }).click();
    await expect(page.getByText('Sueldo')).toBeVisible();
  });

  test('Analytics has a pay-period range, and states it in days', async ({ page }) => {
    await agregar(page, 'Mercado', '200000');
    await page.goto('analisis');
    await page.getByRole('button', { name: 'quincena' }).click();
    // The pay period crosses the month boundary, so it is labelled with days.
    // Visible only: the navigator also lays out a hidden width sample in the
    // same shape ("00 Mmm – 00 Mmm") so its arrows never move.
    // The hero repeats it ("Balance de 25 sep – 9 oct"), so match the label exactly.
    await expect(page.getByText(/^\d+ \w{3} – \d+ \w{3}$/).filter({ visible: true })).toBeVisible();
  });
});

test('the Excel button triggers the download with the right name', async ({ page }) => {
  await agregar(page, 'Mercado', '200000');

  // Exports live in Ajustes → Tus datos (redesign §9e).
  await page.goto('ajustes/datos');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Excel \(\.xlsx\)/ }).click();
  const file = await descarga;

  expect(file.suggestedFilename()).toMatch(/^step-up-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(await file.failure()).toBeNull();
});
