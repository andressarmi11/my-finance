import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * A credit-card purchase does NOT take your money the day you make it: it
 * takes it the day you pay the statement, which can land two months later.
 * It used to be deducted right away, so the month of the purchase showed
 * less money than you actually had.
 *
 * The transaction IS still recorded in the month of the purchase — what
 * moves is the deduction, not the record. That's why this test checks both.
 */

// With no animation, the hero's number reads immediately instead of counting up.
test.use({ reducedMotion: 'reduce' });

/** "Te queda este mes", in pesos. */
async function teQueda(page: Page): Promise<number> {
  const value = page.getByText('Te queda este mes').locator('xpath=following-sibling::*[1]');
  const text = (await value.textContent()) ?? '';
  const digitos = text.replace(/[^\d-]/g, '');
  return Number(digitos);
}

// The type is chosen by query param; the Expense/Income toggle no longer exists.
async function agregar(page: Page, concept: string, amount: string, method?: string, type?: 'ingreso') {
  await page.goto(`movimientos?nuevo=1${type ? `&tipo=${type}` : ''}`);
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill(concept);
  await dialog.getByPlaceholder('$ 0').fill(amount);
  if (method) await dialog.getByRole('button', { name: method }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

/** An empty dashboard draws no hero, so something always has to be seeded. */
async function conSueldo(page: Page) {
  await agregar(page, 'Sueldo', '3000000', 'Débito', 'ingreso');
}

test('a card expense is not deducted from the month it was bought in', async ({ page }) => {
  await conSueldo(page);
  await page.goto('');
  const antes = await teQueda(page);

  await agregar(page, 'Compra con TC', '500000', 'Tarjeta de crédito');

  await page.goto('');
  expect(await teQueda(page)).toBe(antes);

  // "Falta pagar" doesn't move either: that money doesn't leave this month.
  const leftToPay = page.getByText('Falta pagar').locator('xpath=following-sibling::*[1]');
  await expect(leftToPay).toHaveText(/\$\s?0/);
});

test('an expense without a card is deducted right away', async ({ page }) => {
  await conSueldo(page);
  await page.goto('');
  const antes = await teQueda(page);

  await agregar(page, 'Mercado', '120000', 'Débito');

  await page.goto('');
  expect(await teQueda(page)).toBe(antes - 120_000);
});

test('the card purchase still appears in the list for the month it was made', async ({ page }) => {
  await agregar(page, 'Compra con TC', '500000', 'Tarjeta de crédito');

  await page.goto('movimientos');
  await expect(page.getByText('Compra con TC')).toBeVisible();
  await expect(page.getByText(/se paga el/)).toBeVisible();
});
