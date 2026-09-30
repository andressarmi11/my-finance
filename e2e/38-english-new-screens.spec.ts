import { test, expect } from './fixtures';

/** The screens added for budgets-by-month and custom recurrence, in English. */
const SPANISH_ONLY = [
  'Guardar', 'Cancelar', 'Eliminar', 'Quitar', 'Más opciones', 'Presupuesto',
  'Cada ', 'meses', 'semanas', 'Próximas', 'Elegir', 'Este mes', 'Todo el año',
  'Recurrentes', 'Elige al menos', 'Según frecuencia', 'Cómo se repite', 'Lo define',
];

test('budget months picker and custom recurrence have no Spanish in English', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('ajustes');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

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

  // Recurring: every 2 months.
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ New recurring' }).click();
  const form = page.getByRole('dialog', { name: 'New recurring' });
  await form.getByPlaceholder('e.g. Rent').fill('Insurance E2E');
  await form.getByPlaceholder('$ 0').fill('90000');
  await form.getByRole('button', { name: 'Débito' }).click();
  await form.getByRole('button', { name: 'More options' }).click();
  await form.getByRole('button', { name: 'Every so often' }).click();
  await expect(form.getByText(/^Next: /)).toBeVisible();
  await scan('recurring form');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/^Every 2 months/)).toBeVisible();
  await scan('recurring list');

  expect(found, `Spanish left:\n${found.join('\n')}`).toEqual([]);
});
