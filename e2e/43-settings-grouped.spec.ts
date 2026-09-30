import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/**
 * Redesign phase 6 (§7, §9d, §9e, §9f): Settings is an iOS-style grouped
 * list and every row opens its own screen or sheet. These walk each of them
 * in the local build (no account).
 */

/** The rates API, answered here: 1 USD = 4.000 COP. */
async function rates(page: Page) {
  await page.route('https://open.er-api.com/**', (route) => route.fulfill({
    json: { result: 'success', base_code: 'COP', rates: { COP: 1, USD: 0.00025, EUR: 0.000227, MXN: 0.0045 } },
  }));
}

test('the grouped list: groups, values on the right and the version footer', async ({ page }) => {
  await page.goto('ajustes');
  for (const group of ['Preferencias', 'Tu plata', 'Organizar', 'Avanzado']) {
    await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Idioma Español' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moneda COP' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cómo te pagan 10 y 25' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recordatorios 1 día antes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Presupuestos Ninguno' })).toBeVisible();
  await expect(page.getByText(/^Step up v\d+\.\d+\.\d+ · © 2026$/)).toBeVisible();
  // Without an account there is nothing to sign out of.
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);

  // Each row goes to its own screen, with "‹ Ajustes" to come back.
  await page.getByRole('link', { name: /^Tus datos/ }).click();
  await expect(page).toHaveURL(/\/ajustes\/datos$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tus datos' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
});

test('the theme applies at once, from Tema y barra', async ({ page }) => {
  await page.goto('ajustes');
  await page.getByRole('link', { name: /^Tema y barra/ }).click();
  await expect(page).toHaveURL(/\/ajustes\/tema$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tema y barra' })).toBeVisible();
  const themes = page.getByRole('group', { name: 'Tema' });
  const html = page.locator('html');

  await themes.getByRole('button', { name: 'Claro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(242, 244, 247)');

  await themes.getByRole('button', { name: 'Oscuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(11, 13, 18)');

  await themes.getByRole('button', { name: 'Sistema' }).click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await page.getByRole('link', { name: 'Ajustes' }).first().click();
  await expect(page.getByRole('link', { name: /Tema y barra.*Sistema · Translúcida/ })).toBeVisible();
});

test('the name in Perfil is the greeting on Inicio', async ({ page }) => {
  await page.goto('ajustes');
  await page.getByRole('link', { name: /^Perfil/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
  await page.getByLabel('Tu nombre').fill('Andrea');
  await page.getByLabel('Tu nombre').blur();
  await page.goto('');
  await expect(page.getByText(/Hola, Andrea/)).toBeVisible();
});

test('pay days: steppers keep two days apart and the preview follows', async ({ page }) => {
  await page.goto('ajustes/pagos');
  const first = page.getByRole('spinbutton', { name: 'Primer pago, día' });
  await expect(first).toHaveValue('10');
  await expect(page.getByText('Del 10 al 24', { exact: true })).toBeVisible();
  await expect(page.getByText('Del 25 al 9 del mes siguiente')).toBeVisible();

  // pago1 + 2 ≤ pago2: 24 is clamped to 23.
  await first.fill('24');
  await first.blur();
  await expect(first).toHaveValue('23');
  await expect(page.getByText('Quincena del 23')).toBeVisible();

  await page.getByRole('button', { name: 'Segundo pago, día: más' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Segundo pago, día' })).toHaveValue('26');
  await page.goto('ajustes');
  await expect(page.getByRole('link', { name: 'Cómo te pagan 23 y 26' })).toBeVisible();
});

test('quick currencies: at most three, and the new-transaction sheet shows them', async ({ page }) => {
  await rates(page);
  await page.goto('ajustes/moneda');
  const quick = page.getByRole('group', { name: 'Monedas rápidas' });
  await expect(page.getByText('3 de 3')).toBeVisible();
  await expect(quick.getByRole('button', { name: /MXN/ })).toHaveAttribute('aria-disabled', 'true');
  await quick.getByRole('button', { name: /EUR/ }).click();
  await expect(page.getByText('2 de 3')).toBeVisible();
  await quick.getByRole('button', { name: /MXN/ }).click();
  await expect(quick.getByRole('button', { name: /MXN/ })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('movimientos?nuevo=1');
  const chips = page.getByRole('dialog', { name: 'Agregar movimiento' }).getByRole('group', { name: 'Moneda' });
  await expect(chips.getByRole('button', { name: /MXN/ })).toBeVisible();
  await expect(chips.getByRole('button', { name: /EUR/ })).toHaveCount(0);
});

test('reminders: days before or the same day, with a live preview', async ({ page }) => {
  await page.goto('ajustes/recordatorios');
  await expect(page.getByText('GYM vence mañana')).toBeVisible();
  await page.getByRole('button', { name: 'Un día más' }).click();
  await page.getByRole('button', { name: 'Un día más' }).click();
  await expect(page.getByText('GYM vence en 3 días')).toBeVisible();
  await expect(page.getByText('9:00 a. m.').first()).toBeVisible();
  // Push needs an account: the switch is there, off, and says why.
  await expect(page.getByRole('switch', { name: 'Avisarme en este dispositivo' })).toBeDisabled();
  await page.goto('ajustes');
  await expect(page.getByRole('link', { name: 'Recordatorios 3 días antes' })).toBeVisible();

  // Same day, one hour before (§9f "Recordatorios v2").
  await page.goto('ajustes/recordatorios');
  await page.getByRole('button', { name: 'El mismo día' }).click();
  await page.getByRole('radio', { name: '1 hora antes' }).check();
  await expect(page.getByText('GYM vence en 1 hora')).toBeVisible();
  await page.goto('ajustes');
  await expect(page.getByRole('link', { name: /^Recordatorios El mismo día/ })).toBeVisible();
});

test('your data: three exports with what each is for, and the restore', async ({ page }) => {
  await page.goto('ajustes/datos');
  await expect(page.getByRole('button', { name: /^JSON Copia completa/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^CSV Una fila por movimiento/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Importar backup/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^JSON/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test('new category sheet: preview, kind, colour and icon', async ({ page }) => {
  await page.goto('ajustes/categorias');
  await page.getByRole('button', { name: '+ Nueva categoría' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nueva categoría' });
  await expect(sheet.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  await sheet.getByLabel('Nombre').fill('Mascotas E2E');
  await sheet.getByRole('button', { name: 'Ingreso' }).click();
  await expect(sheet.getByRole('group', { name: 'Color' }).getByRole('button')).toHaveCount(12);
  await sheet.getByRole('button', { name: 'Color 3' }).click();
  await expect(sheet.getByRole('group', { name: 'Ícono' }).getByRole('button')).toHaveCount(10);
  await sheet.getByRole('button', { name: 'pets' }).click();
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /Mascotas E2E/ })).toBeVisible();
});

test('new payment method: card steppers, the amber cycle line and "use as default"', async ({ page }) => {
  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: '+ Nuevo método de pago' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nuevo método' });
  await sheet.getByLabel('Nombre').fill('Visa E2E');
  await sheet.getByRole('button', { name: 'Crédito', exact: true }).click();
  await sheet.getByRole('spinbutton', { name: 'Día de corte' }).fill('10');
  await sheet.getByRole('spinbutton', { name: 'Día de corte' }).blur();
  await sheet.getByRole('button', { name: 'Día de pago: más' }).click();
  await expect(sheet.getByRole('spinbutton', { name: 'Día de pago' })).toHaveValue('3');
  await expect(sheet.getByText(/^Compras del 1 al 10 se pagan el 3 de .+\. Del 11 en adelante, el 3 de .+\.$/)).toBeVisible();
  await sheet.getByRole('switch', { name: 'Usar por defecto' }).click();
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toBeHidden();

  const row = page.getByRole('button', { name: /Visa E2E/ });
  await expect(row.getByText('Por defecto')).toBeVisible();
  await expect(row.getByText(/Crédito · corte 10, paga el 3/)).toBeVisible();
  await expect(page.getByText('Por defecto')).toHaveCount(1);
});

test('recurring: monthly summary, groups by type, and a rule in dollars', async ({ page }) => {
  await rates(page);
  await page.goto('ajustes/recurrentes');

  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();
  let dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByRole('button', { name: 'Ingreso', exact: true }).click();
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Sueldo E2E');
  await dialog.getByLabel('Valor', { exact: true }).fill('1000000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();
  dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill('Netflix E2E');
  await dialog.getByLabel('Valor', { exact: true }).fill('10');
  await dialog.getByRole('group', { name: 'Moneda' }).getByRole('button', { name: /USD/ }).click();
  await expect(dialog.getByText('≈ $ 40.000 COP · tasa de hoy 4.000')).toBeVisible();
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Entran al mes')).toBeVisible();
  await expect(page.getByText('$ 1.000.000').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ingresos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible();
  const netflix = page.getByRole('button', { name: /Netflix E2E/ });
  await expect(netflix).toContainText('$ 40.000');
  await expect(netflix).toContainText('USD');

  // Editing it keeps the dollars and the rate it was saved with.
  await netflix.click();
  const edit = page.getByRole('dialog', { name: 'Editar' });
  await expect(edit.getByLabel('Valor', { exact: true })).toHaveValue('10');
  await expect(edit.getByRole('group', { name: 'Moneda' }).getByRole('button', { name: /USD/ })).toHaveAttribute('aria-pressed', 'true');
});
