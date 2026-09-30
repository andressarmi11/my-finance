import { test, expect } from './fixtures';

/** Budgets are per category and month: set for 3 months, edit, remove with confirmation. */
test('sets a budget for 3 months, edits it and removes it after confirming', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('ajustes/presupuestos');

  await page.getByRole('button', { name: /Definir presupuesto/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /^Presupuesto de / });
  const category = (await sheet.getAttribute('aria-label'))!.replace('Presupuesto de ', '');
  await expect(sheet.getByText(/^Solo para /)).toBeVisible();

  await sheet.getByLabel('Presupuesto mensual').fill('200000');
  // The months picker hides behind "More options".
  await expect(sheet.getByRole('group', { name: '¿Para qué meses?' })).toBeHidden();
  await sheet.getByRole('button', { name: 'Más opciones' }).click();
  await sheet.getByRole('button', { name: '3 meses' }).click();
  await sheet.getByRole('button', { name: 'Guardar en 3 meses' }).click();
  await expect(sheet).toBeHidden();

  // Each budgeted row has a stepper; its amount opens the sheet and is
  // named "Presupuesto de {category}: $ 200.000" (redesign §9d).
  const amountButton = (amount: string) =>
    page.getByRole('button', { name: new RegExp(`^Presupuesto de ${category}: \\$\\s${amount.replace('.', '\\.')}$`) });
  const row = () => amountButton('200.000');
  await expect(row()).toBeVisible();
  // It is there in the next two months, and not in the fourth.
  const next = page.getByRole('button', { name: 'Mes siguiente' });
  await next.click();
  await expect(row()).toBeVisible();
  await next.click();
  await expect(row()).toBeVisible();
  await next.click();
  await expect(row()).toBeHidden();
  await page.getByRole('button', { name: 'Volver al mes actual' }).click();

  // Edit: opens prefilled.
  await row().click();
  const edit = page.getByRole('dialog', { name: 'Editar presupuesto' });
  await expect(edit.getByLabel('Presupuesto mensual')).toHaveValue('200000');
  await edit.getByLabel('Presupuesto mensual').fill('300000');
  await edit.getByRole('button', { name: 'Guardar en 1 mes' }).click();
  await expect(amountButton('300.000')).toBeVisible();

  // Saving 0 on an existing budget is "remove": same confirmation, nothing saved yet.
  await amountButton('300.000').click();
  const zero = page.getByRole('dialog', { name: 'Editar presupuesto' });
  await zero.getByLabel('Presupuesto mensual').fill('0');
  await zero.getByRole('button', { name: 'Guardar en 1 mes' }).click();
  await page.getByRole('dialog', { name: new RegExp(`^¿Quitar el presupuesto de ${category} en `) }).getByRole('button', { name: 'Cancelar' }).click();

  // Remove: asks first, and cancel leaves it alone.
  await page.getByRole('dialog', { name: 'Editar presupuesto' }).getByRole('button', { name: 'Quitar presupuesto' }).click();
  const confirm = page.getByRole('dialog', { name: new RegExp(`^¿Quitar el presupuesto de ${category} en `) });
  await expect(confirm.getByText(/Los demás meses no cambian/)).toBeVisible();
  await expect(confirm.getByText('Tus gastos no se borran; solo deja de haber un tope.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole('dialog', { name: 'Editar presupuesto' }).getByRole('button', { name: 'Quitar presupuesto' }).click();
  await page.getByRole('dialog', { name: new RegExp(`^¿Quitar el presupuesto de ${category} en `) }).getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(amountButton('300.000')).toBeHidden();
  // Only the viewed month went: next month keeps its 200.000.
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(row()).toBeVisible();
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(row()).toBeVisible();
});

test('the stepper moves a budget by 50.000 and the columns show it', async ({ page }) => {
  await page.goto('ajustes/presupuestos');
  await page.getByRole('button', { name: /Definir presupuesto/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /^Presupuesto de / });
  const category = (await sheet.getAttribute('aria-label'))!.replace('Presupuesto de ', '');
  await sheet.getByLabel('Presupuesto mensual').fill('500000');
  await sheet.getByRole('button', { name: 'Guardar en 1 mes' }).click();
  await expect(sheet).toBeHidden();

  // The §9c columns sit on top, one per budgeted category.
  await expect(page.getByRole('button', { name: new RegExp(`^${category}: `) })).toBeVisible();

  const label = `Presupuesto de ${category}: $`;
  await page.getByRole('button', { name: new RegExp(`^${label.replace('$', '\\$')}.*: más$`) }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Presupuesto de ${category}: \\$\\s550\\.000$`) })).toHaveText('550K');
  await page.getByRole('button', { name: new RegExp(`^Presupuesto de ${category}: \\$\\s550\\.000: menos$`) }).click();
  await page.getByRole('button', { name: new RegExp(`^Presupuesto de ${category}: \\$\\s500\\.000: menos$`) }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Presupuesto de ${category}: \\$\\s450\\.000$`) })).toBeVisible();
});
