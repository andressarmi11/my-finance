import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Several cards, each with ITS OWN cutoff and payment day.
 *
 * The model always supported it; what didn't exist was a way to create a
 * second one. This test covers exactly that end to end: create it, spend on
 * it, and check that its cycle comes from its own days and not the first
 * card's.
 */
test.use({ reducedMotion: 'reduce' });

async function crearTarjeta(page: Page, name: string, cutoff: string, payment: string, cupo?: string) {
  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: '+ Nuevo método de pago' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo método de pago' });
  await dialog.getByLabel('Nombre').fill(name);
  await dialog.getByRole('button', { name: 'Crédito' }).click();
  // Steppers now (redesign §9f): the middle is still a number field.
  await dialog.getByRole('spinbutton', { name: 'Día de corte' }).fill(cutoff);
  await dialog.getByRole('spinbutton', { name: 'Día de pago' }).fill(payment);
  if (cupo) await dialog.getByLabel('Cupo (opcional)').fill(cupo);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('a second card can be created and shows up in the list', async ({ page }) => {
  await crearTarjeta(page, 'Amex Oro', '5', '20');
  await expect(page.getByText('Amex Oro')).toBeVisible();
  await expect(page.getByText(/corte 5, paga 20/)).toBeVisible();
});

test('each card works out its payment date from ITS OWN days', async ({ page }) => {
  await crearTarjeta(page, 'Amex Oro', '5', '20');

  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Compra Amex');
  await dialog.getByPlaceholder('$ 0').fill('250000');
  // Two cards now: Crédito shows their names to pick one.
  await dialog.getByRole('button', { name: 'Crédito', exact: true }).click();
  await dialog.getByRole('button', { name: 'Amex Oro' }).click();

  // The preview comes from THIS card's cutoff 5 / payment 20, not the 15/2
  // of the one the app ships with.
  await expect(dialog.getByText(/Corte 5 · se paga el 20/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
});

test('the credit limit shows the available amount and deducts from it', async ({ page }) => {
  await crearTarjeta(page, 'Visa Cupo', '15', '2', '2000000');

  await page.goto('ajustes/metodos');
  // The card's row shows a usage bar: used on the left, the limit on the right.
  await expect(page.getByText('Cupo $ 2.000.000')).toBeVisible();
  await expect(page.getByText('Usado $ 0')).toBeVisible();

  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Mercado');
  await dialog.getByPlaceholder('$ 0').fill('300000');
  // Two cards now: Crédito shows their names to pick one.
  await dialog.getByRole('button', { name: 'Crédito', exact: true }).click();
  await dialog.getByRole('button', { name: 'Visa Cupo' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('ajustes/metodos');
  await expect(page.getByText('Usado $ 300.000')).toBeVisible();
});

test('deleting a card leaves its transactions without a method, it does not delete them', async ({ page }) => {
  await crearTarjeta(page, 'Temporal', '10', '25');

  await page.goto('movimientos?nuevo=1');
  const nuevo = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await nuevo.getByPlaceholder('Ej. Restaurante').fill('Gasto huérfano');
  await nuevo.getByPlaceholder('$ 0').fill('90000');
  // Two cards now: Crédito shows their names to pick one.
  await nuevo.getByRole('button', { name: 'Crédito', exact: true }).click();
  await nuevo.getByRole('button', { name: 'Temporal' }).click();
  await nuevo.getByRole('button', { name: 'Guardar' }).click();
  await expect(nuevo).toBeHidden();

  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: /Temporal/ }).click();
  const editar = page.getByRole('dialog', { name: 'Editar método de pago' });
  await expect(editar.getByText(/quedará sin\s+método de pago/)).toBeVisible();
  await editar.getByRole('button', { name: 'Eliminar' }).click();
  await expect(editar).toBeHidden();

  await expect(page.getByText('Temporal')).toBeHidden();

  // The transaction is still alive: the money was spent either way.
  await page.goto('movimientos');
  await expect(page.getByText('Gasto huérfano')).toBeVisible();
});
