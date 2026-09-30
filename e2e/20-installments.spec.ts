import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/**
 * A purchase split into N instalments: one purchase, N transactions, one
 * per month.
 *
 * What's tested end to end is that the money gets split and that the credit
 * is held IN FULL on the day of the purchase — not instalment by
 * instalment, which is how the bank does it.
 */
test.use({ reducedMotion: 'reduce' });

async function crearTarjeta(page: Page, name: string, cutoff: string, payment: string, cupo?: string) {
  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: '+ Nuevo método de pago' }).click();
  const d = page.getByRole('dialog', { name: 'Nuevo método de pago' });
  await d.getByLabel('Nombre').fill(name);
  await d.getByRole('button', { name: 'Crédito' }).click();
  await d.getByRole('spinbutton', { name: 'Día de corte' }).fill(cutoff);
  await d.getByRole('spinbutton', { name: 'Día de pago' }).fill(payment);
  if (cupo) await d.getByLabel('Cupo (opcional)').fill(cupo);
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

async function buyInInstallments(page: Page, concept: string, amount: string, card: string, installments: string) {
  await page.goto('movimientos?nuevo=1');
  const d = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await d.getByPlaceholder('Ej. Restaurante').fill(concept);
  await d.getByPlaceholder('$ 0').fill(amount);
  // Two cards: Crédito first, then the card. Instalments live under "Más opciones".
  await d.getByRole('button', { name: 'Crédito', exact: true }).click();
  await d.getByRole('button', { name: card }).click();
  await d.getByRole('button', { name: 'Más opciones' }).click();
  await d.getByLabel('Cuotas').fill(installments);
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

test('a purchase in 3 instalments creates 3 labelled transactions', async ({ page }) => {
  await crearTarjeta(page, 'Visa', '15', '2');
  await buyInInstallments(page, 'Nevera', '900000', 'Visa', '3');

  // Instalment 1 lives in the month of the purchase.
  await page.goto('movimientos');
  await expect(page.getByText('Nevera')).toBeVisible();
  await expect(page.getByText(/cuota 1 de 3/)).toBeVisible();
  await expect(page.getByText('$ 300.000').first()).toBeVisible();

  // The other two, in the following months.
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText(/cuota 2 de 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText(/cuota 3 de 3/)).toBeVisible();
});

test('an instalment plan holds the full credit, not one instalment', async ({ page }) => {
  await crearTarjeta(page, 'Visa Cupo', '15', '2', '5000000');
  await buyInInstallments(page, 'Nevera', '1200000', 'Visa Cupo', '12');

  // 1,200,000 used (the total, not the 100,000 of the first instalment).
  await page.goto('ajustes/metodos');
  await expect(page.getByText('Usado $ 1.200.000')).toBeVisible();
});

test('deleting one instalment deletes the whole plan', async ({ page }) => {
  await crearTarjeta(page, 'Visa', '15', '2');
  await buyInInstallments(page, 'Nevera', '900000', 'Visa', '3');

  await page.goto('movimientos');
  await page.getByText('Nevera').click();
  const editar = page.getByRole('dialog', { name: 'Editar movimiento' });
  await editar.getByRole('button', { name: 'Eliminar' }).click();
  await expect(editar).toBeHidden();

  // Neither this one nor the ones in the following months.
  await expect(page.getByText('Nevera')).toBeHidden();
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText('Nevera')).toBeHidden();
});
