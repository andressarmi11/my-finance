import { test, expect, switchLanguage } from './fixtures';

/** The screens added for budgets-by-month and custom recurrence, in English. */
const SPANISH_ONLY = [
  'Guardar', 'Cancelar', 'Eliminar', 'Quitar', 'Más opciones', 'Presupuesto',
  'Cada ', 'meses', 'semanas', 'Próximas', 'Elegir', 'Este mes', 'Todo el año',
  'Recurrentes', 'Elige al menos', 'Según frecuencia', 'Cómo se repite', 'Lo define',
];

test('budget months picker and custom recurrence have no Spanish in English', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await switchLanguage(page, 'English');

  const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const found: string[] = [];
  const scan = async (where: string) => {
    const text = await body();
    for (const w of SPANISH_ONLY) if (text.includes(w)) found.push(`${where}: "${w}"`);
  };

  // Budgets: sheet with the months picker open.
  await page.goto('ajustes/presupuestos');
  await page.getByRole('button', { name: /Set a budget/ }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Monthly budget').fill('100000');
  await sheet.getByRole('button', { name: 'More options' }).click();
  await sheet.getByRole('button', { name: 'Whole year' }).click();
  await expect(sheet.getByRole('button', { name: 'Save for 12 months' })).toBeVisible();
  await scan('budget sheet');
  await sheet.getByRole('button', { name: 'Save for 12 months' }).click();
  await scan('budget list with columns');

  // Recurring: every 2 months.
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ New recurring' }).click();
  const form = page.getByRole('dialog', { name: 'New recurring' });
  await form.getByPlaceholder('What was it? e.g. Lunch').fill('Insurance E2E');
  await form.getByLabel('Amount', { exact: true }).fill('90000');
  await form.getByRole('button', { name: 'Debit' }).click();
  await form.getByRole('button', { name: 'More options' }).click();
  await form.getByRole('button', { name: 'Every so often' }).click();
  await expect(form.getByText(/^Next: /)).toBeVisible();
  await scan('recurring form');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/^Every 2 months/)).toBeVisible();
  await scan('recurring list');

  expect(found, `Spanish left:\n${found.join('\n')}`).toEqual([]);
});

/**
 * Redesign phase 6: the grouped Settings, every sub-screen and the sheets
 * that open from them, in English. Words that only a Spanish screen shows.
 */
const SETTINGS_SPANISH = [
  'Preferencias', 'Tu plata', 'Avanzado', 'Idioma', 'Tema', 'Moneda', 'Principal',
  'Monedas rápidas', 'Cómo te pagan', 'Primer pago', 'Segundo pago', 'Vista previa',
  'Del mes', 'del mes siguiente', 'Recordatorios', 'Avisarme', 'Cuándo', 'Días de aviso',
  'Así te llega', 'vence', 'Exportar', 'Restaurar', 'Importar', 'Copia completa',
  'Cómo armarlo', 'Guía completa', 'Perfil', 'Tu nombre', 'Contraseña', 'Coinciden',
  'Muy corta', 'Débil', 'Nueva categoría', 'Más íconos', 'Nuevo método', 'Usar por defecto',
  'Día de corte', 'Día de pago', 'Compras del', 'Cupo', 'Entran al mes', 'Salen al mes',
  'Listo', 'Sistema', 'Claro', 'Oscuro', 'Se aplica', 'Guardar', 'Cancelar', 'Ninguno',
  'Solo en este', 'Por defecto', 'Total histórico', 'Gasto', 'Ingreso',
];

test('the grouped Settings, its sub-screens and sheets have no Spanish in English', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await switchLanguage(page, 'English');

  const found: string[] = [];
  const scan = async (where: string) => {
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const w of SETTINGS_SPANISH) if (text.includes(w)) found.push(`${where}: "${w}"`);
  };

  await page.goto('ajustes');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await scan('settings');

  await page.getByRole('link', { name: /^Theme & bar/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Theme & bar' })).toBeVisible();
  await scan('theme & bar screen');
  await page.goto('ajustes');

  await page.getByRole('button', { name: /^Language/ }).click();
  await scan('language sheet');
  await page.keyboard.press('Escape');

  for (const path of ['ajustes/cuenta', 'ajustes/moneda', 'ajustes/pagos', 'ajustes/recordatorios', 'ajustes/datos', 'ajustes/atajos']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible();
    await scan(path);
  }

  await page.goto('ajustes/cuenta/contrasena');
  await page.getByLabel('New password', { exact: true }).fill('abc');
  await page.getByLabel('Repeat new password').fill('abd');
  await expect(page.getByText('They don’t match')).toBeVisible();
  await expect(page.getByText('Too short')).toBeVisible();
  await scan('change password');

  await page.goto('ajustes/categorias');
  await page.getByRole('button', { name: '+ New category' }).click();
  await expect(page.getByRole('dialog', { name: 'New category' })).toBeVisible();
  await scan('new category sheet');
  await page.keyboard.press('Escape');

  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: /New payment method/ }).click();
  const method = page.getByRole('dialog', { name: 'New method' });
  await method.getByRole('button', { name: 'Credit', exact: true }).click();
  await expect(method.getByText(/^Purchases from day 1 to day 15 are due on/)).toBeVisible();
  await scan('new method sheet');
  await page.keyboard.press('Escape');

  expect(found, `Spanish left:\n${found.join('\n')}`).toEqual([]);
});
