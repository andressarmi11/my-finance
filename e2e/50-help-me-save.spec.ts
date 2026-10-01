import { test, expect, switchLanguage } from './fixtures';
import type { Page } from '@playwright/test';
import { seedThreeMonths } from './savingsSeed';

/**
 * "Ayúdame a ahorrar" (PRESUPUESTOS-Y-AHORRO.md, part B): Análisis → plan →
 * Personalizar (Entretenimiento "No tocar", Intenso, a 3M goal) → Crear →
 * Presupuestos shows the limits and the goal → Análisis shows the active
 * plan → deleting it puts the budgets back.
 */

const budgetRow = (page: Page, id: string) => page.getByTestId(`budget-row-${id}`);

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('build a goal plan, see its budgets, then delete it and get the old ones back', async ({ page }) => {
    await page.goto('ajustes/presupuestos');
    await seedThreeMonths(page);
    // A budget the user already had: the plan must put it back on delete.
    await page.getByRole('button', { name: 'Definir presupuesto: Compras' }).click();
    const sheet = page.getByRole('dialog', { name: 'Presupuesto de Compras' });
    await sheet.getByLabel('Presupuesto mensual').fill('500000');
    await sheet.getByRole('button', { name: 'Guardar en 1 mes' }).click();
    await expect(sheet).toBeHidden();

    // The way in from Análisis, right under the balance.
    await page.getByRole('link', { name: 'Análisis' }).click();
    await page.getByRole('button', { name: /Ayúdame a ahorrar/ }).click();
    const plan = page.getByRole('region', { name: 'Ayúdame a ahorrar' });
    await expect(plan.getByRole('heading', { name: 'Ayúdame a ahorrar' })).toBeVisible();
    await expect(plan.getByText('1 · Tu plan')).toBeVisible();
    await expect(plan.getByText('Basado en tus últimos 3 meses.', { exact: false })).toBeVisible();

    // Every cut comes with its why, from the user's own data.
    await expect(plan.getByTestId('cut-cat-alimentacion')).toBeVisible();
    await plan.getByTestId('cut-cat-alimentacion').click();
    await expect(plan.getByText(/Pediste domicilio unas 5 veces al mes/)).toBeVisible();
    // Fixed and "No tocar" are never cut, and say so.
    await expect(plan.getByTestId('cut-cat-hogar')).toHaveCount(0);
    await expect(plan.getByTestId('cut-cat-salud')).toHaveCount(0);
    await expect(plan.getByText(/No se tocan: Hogar \(fijo\), Salud\./)).toBeVisible();

    // Personalizar: a 3M goal, Intenso, Entretenimiento "No tocar".
    await plan.getByRole('button', { name: 'Personalizar', exact: true }).click();
    await expect(plan.getByText('2 · Personalizar')).toBeVisible();
    await plan.getByRole('group', { name: 'Objetivo' }).getByRole('button', { name: 'Llegar a una meta' }).click();
    await plan.getByLabel('Nombre de la meta').fill('Viaje');
    await expect(plan.getByLabel('Cuánto', { exact: true })).toHaveText('3M');
    await plan.getByRole('group', { name: 'Intensidad' }).getByRole('button', { name: 'Intenso' }).click();
    await expect(plan.getByText('Hasta 30 % menos, sin bajar de lo mínimo razonable.')).toBeVisible();
    await plan.getByRole('button', { name: 'Entretenimiento: Se puede ajustar' }).click();
    await expect(plan.getByRole('button', { name: 'Entretenimiento: No tocar' })).toBeVisible();
    await expect(plan.getByRole('button', { name: 'Hogar: Fijo' })).toBeDisabled();
    await expect(plan.getByRole('switch', { name: 'Hasta cumplir la meta' })).toHaveAttribute('aria-checked', 'true');
    await expect(plan.getByText(/la cumples en \d+ meses/)).toBeVisible();
    const monthly = await plan.getByTestId('plan-foot-amount').innerText();

    await plan.getByRole('button', { name: 'Ver plan' }).click();
    await expect(plan.getByText(/Para Viaje puedes apartar/)).toBeVisible();
    await expect(plan.getByTestId('plan-hero-amount')).toHaveText(monthly);
    await expect(plan.getByTestId('cut-cat-entretenimiento')).toHaveCount(0);
    await plan.getByRole('button', { name: 'Crear presupuesto con este plan' }).click();

    // Listo: what was created.
    await expect(plan.getByRole('heading', { name: 'Listo, tu presupuesto está armado' })).toBeVisible();
    await expect(plan.getByText(/Meta: Viaje · \$\s3\.000\.000 · hasta/)).toBeVisible();
    await plan.getByRole('button', { name: 'Ver presupuestos' }).click();

    // Presupuestos: the limits and the goal, marked as such.
    await expect(page.getByRole('heading', { name: 'Presupuestos', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ajustar mi plan de ahorro/ })).toBeVisible();
    await expect(budgetRow(page, 'cat-alimentacion').getByRole('button', { name: 'Tope', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(budgetRow(page, 'cat-ahorro').getByRole('button', { name: 'Meta', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(budgetRow(page, 'cat-entretenimiento')).toContainText('Sin límite');
    await expect(budgetRow(page, 'cat-compras')).not.toContainText('$ 500.000');

    // Análisis: the active plan, with its goal for the period and the pace line.
    await page.getByRole('link', { name: 'Análisis' }).click();
    const card = page.getByTestId('plan-card');
    await expect(card.getByText('Plan de ahorro · Mes')).toBeVisible();
    await expect(card.getByText(/Meta \$\s[\d.]+/)).toBeVisible();
    await expect(card.getByTestId('pace-line')).toBeVisible();
    await expect(card.getByTestId('plan-row-cat-alimentacion')).toBeVisible();
    // Año: the projection to December.
    await page.getByRole('group', { name: 'Periodo' }).getByRole('button', { name: 'Año' }).click();
    await expect(page.getByTestId('plan-card').getByText('Plan de ahorro · Año')).toBeVisible();
    await expect(page.getByTestId('plan-card').getByText(/Proyección a diciembre: \$\s[\d.]+ extra con el plan/)).toBeVisible();

    // Re-opening preloads it; deleting asks first and restores the budgets.
    await page.getByTestId('plan-card').getByRole('button', { name: 'Ajustar' }).click();
    await expect(plan.getByRole('button', { name: 'Actualizar mi presupuesto' })).toBeVisible();
    await plan.getByRole('button', { name: 'Eliminar plan' }).click();
    const confirm = page.getByRole('dialog', { name: '¿Eliminar tu plan de ahorro?' });
    await expect(confirm.getByText('Tus presupuestos vuelven a como estaban antes del plan. Tus movimientos no se tocan.')).toBeVisible();
    await confirm.getByRole('button', { name: 'Eliminar plan' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Plan eliminado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ayúdame a ahorrar/ })).toBeVisible();

    await page.goto('ajustes/presupuestos');
    await expect(budgetRow(page, 'cat-compras')).toContainText(/\$\s500\.000/);
    await expect(budgetRow(page, 'cat-alimentacion')).toContainText('Sin límite');
    await expect(page.getByRole('button', { name: /Armar con Ayúdame a ahorrar/ })).toBeVisible();
  });

  test('asking for more than is sensible warns and is limited', async ({ page }) => {
    await page.goto('analisis');
    await seedThreeMonths(page);
    await page.goto('analisis/ahorrar');
    const plan = page.getByRole('region', { name: 'Ayúdame a ahorrar' });
    await plan.getByRole('button', { name: 'Personalizar', exact: true }).click();
    const target = plan.getByLabel('Quiero ahorrar al mes', { exact: true });
    const max = await target.innerText();
    for (let i = 0; i < 4; i++) await plan.getByRole('button', { name: 'Quiero ahorrar al mes: más' }).click();
    await expect(target).not.toHaveText(max);
    await plan.getByRole('button', { name: 'Ver plan' }).click();
    await expect(plan.getByRole('note')).toContainText(/Más de \$\s[\d.]+ al mes significaría recortar lo esencial/);
  });

  test('without a month of history it says so instead of inventing numbers', async ({ page }) => {
    await page.goto('analisis/ahorrar');
    const plan = page.getByRole('region', { name: 'Ayúdame a ahorrar' });
    await expect(plan.getByText(/Necesito al menos un mes completo de movimientos/)).toBeVisible();
    await expect(plan.getByRole('button', { name: 'Crear presupuesto con este plan' })).toHaveCount(0);
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('the plan is a page inside Análisis, with Personalizar beside it', async ({ page }) => {
    await page.goto('analisis');
    await seedThreeMonths(page);
    await page.getByRole('button', { name: 'Ver mi plan' }).click();
    await expect(page.getByRole('heading', { name: 'Ayúdame a ahorrar', level: 1 })).toBeVisible();
    const panel = page.getByRole('complementary', { name: 'Personalizar' });
    await expect(panel).toBeVisible();
    // The why is always visible on desktop.
    await expect(page.getByText(/Pediste domicilio unas 5 veces al mes/)).toBeVisible();
    await panel.getByRole('button', { name: 'Compras: Se puede ajustar' }).click();
    await expect(page.getByTestId('cut-cat-compras')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Crear presupuesto con este plan' }).click();
    // Back in Análisis, the active plan beside the budgets.
    await expect(page.getByRole('heading', { name: 'Análisis', level: 1 })).toBeVisible();
    const card = page.getByTestId('plan-card');
    await expect(card.getByText('Plan de ahorro · Mes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajustar mi plan de ahorro' })).toBeVisible();
    // Delete from the card.
    await card.getByRole('button', { name: 'Eliminar plan' }).click();
    await page.getByRole('dialog', { name: '¿Eliminar tu plan de ahorro?' }).getByRole('button', { name: 'Eliminar plan' }).click();
    await expect(page.getByRole('button', { name: 'Ver mi plan' })).toBeVisible();
  });
});

test('in English: the plan, its whys and the active card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('analisis');
  await seedThreeMonths(page);
  await switchLanguage(page, 'English');
  await page.goto('analisis/ahorrar');
  const plan = page.getByRole('region', { name: 'Help me save' });
  await expect(plan.getByText('Based on your last 3 months.', { exact: false })).toBeVisible();
  await expect(plan.getByText('Where to cut')).toBeVisible();
  await expect(plan.getByText('How your money would look')).toBeVisible();
  await plan.getByTestId('cut-cat-alimentacion').click();
  await expect(plan.getByText(/You ordered delivery about 5 times a month/)).toBeVisible();
  await expect(plan.getByText(/Average [\d,.]+[KM]? → limit/).first()).toBeVisible();
  const text = await plan.innerText();
  for (const es of ['Dónde recortar', 'Promedio', 'Personalizar', 'Empieza', 'No se tocan', 'Pediste']) expect(text).not.toContain(es);
  await plan.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(plan.getByRole('group', { name: 'When does it start?' }).getByRole('button', { name: 'Next period' })).toBeVisible();
  await plan.getByRole('button', { name: 'See plan' }).click();
  await plan.getByRole('button', { name: 'Create budget from this plan' }).click();
  await expect(plan.getByRole('heading', { name: 'Done, your budget is set' })).toBeVisible();
  await plan.getByRole('button', { name: 'Back to Insights' }).click();
  await expect(page.getByTestId('plan-card').getByText('Savings plan · Month')).toBeVisible();
  await expect(page.getByTestId('plan-card').getByText(/Saved this month|Not started yet this month/)).toBeVisible();
});
