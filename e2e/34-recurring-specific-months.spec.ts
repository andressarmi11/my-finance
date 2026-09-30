import { test, expect } from './fixtures';

test('specific months: chips fit a 320px phone, show a preview and save', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('Ej. Arriendo').fill('Impuesto E2E');
  await dialog.getByPlaceholder('$ 0').fill('500000');
  await dialog.getByRole('button', { name: 'Débito' }).click();

  // Default form is unchanged: nothing advanced until asked for.
  await expect(dialog.getByRole('button', { name: 'Meses específicos' })).toBeHidden();
  await dialog.getByRole('button', { name: 'Más opciones' }).click();
  await dialog.getByRole('button', { name: 'Meses específicos' }).click();
  await expect(dialog.getByText('Lo define «Cómo se repite»')).toBeVisible();

  const jun = dialog.getByRole('button', { name: 'Junio', exact: true });
  const dic = dialog.getByRole('button', { name: 'Diciembre', exact: true });
  for (const m of ['Enero', 'Diciembre']) {
    const box = (await dialog.getByRole('button', { name: m, exact: true }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(dialog.getByText('Elige al menos un mes.')).toBeVisible();
  await jun.click();
  await dic.click();
  await expect(jun).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText(/^Próximas: .+ · .+/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Jun, Dic · día 1')).toBeVisible();

  // Reopening shows the advanced settings already on: nothing non-default is hidden.
  await page.getByRole('button', { name: /Impuesto E2E/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Junio', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('every N weeks/months stepper and delete asks for confirmation', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: '+ Nuevo recurrente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await dialog.getByPlaceholder('Ej. Arriendo').fill('Seguro E2E');
  await dialog.getByPlaceholder('$ 0').fill('90000');
  await dialog.getByRole('button', { name: 'Débito' }).click();
  await dialog.getByRole('button', { name: 'Más opciones' }).click();
  await dialog.getByRole('button', { name: 'Cada cierto tiempo' }).click();
  await dialog.getByRole('button', { name: 'Sumar uno' }).click(); // 2 -> 3
  await dialog.getByRole('button', { name: 'Restar uno' }).click(); // 3 -> 2
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Cada 2 meses · día 1')).toBeVisible();

  await page.getByRole('button', { name: /Seguro E2E/ }).click();
  await page.getByRole('button', { name: 'Eliminar recurrente' }).click();
  const confirm = page.getByRole('dialog', { name: '¿Eliminar Seguro E2E?' });
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole('dialog', { name: 'Editar' }).getByRole('button', { name: 'Eliminar recurrente' }).click();
  await page.getByRole('dialog', { name: '¿Eliminar Seguro E2E?' }).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByRole('button', { name: /Seguro E2E/ })).toBeHidden();
});
