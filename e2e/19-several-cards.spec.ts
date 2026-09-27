import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Varias tarjetas, cada una con SU corte y SU pago.
 *
 * El modelo siempre lo soporto; lo que no existia era forma de crear una
 * segunda. Este test cubre justo eso de punta a punta: crearla, gastar en
 * ella, y comprobar que su ciclo sale de sus dias y no de los de la
 * primera.
 */
test.use({ reducedMotion: 'reduce' });

async function crearTarjeta(page: Page, nombre: string, corte: string, pago: string, cupo?: string) {
  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: '+ Nuevo método de pago' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo método de pago' });
  await dialog.getByLabel('Nombre').fill(nombre);
  await dialog.getByRole('button', { name: 'Crédito' }).click();
  await dialog.getByLabel('Día de corte').fill(corte);
  await dialog.getByLabel('Día de pago').fill(pago);
  if (cupo) await dialog.getByLabel('Cupo (opcional)').fill(cupo);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('se puede crear una segunda tarjeta y aparece en la lista', async ({ page }) => {
  await crearTarjeta(page, 'Amex Oro', '5', '20');
  await expect(page.getByText('Amex Oro')).toBeVisible();
  await expect(page.getByText(/corte 5, paga 20/)).toBeVisible();
});

test('cada tarjeta calcula su fecha de pago con SUS días', async ({ page }) => {
  await crearTarjeta(page, 'Amex Oro', '5', '20');

  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Compra Amex');
  await dialog.getByPlaceholder('$ 0').fill('250000');
  await dialog.getByRole('button', { name: 'Amex Oro' }).click();

  // El preview sale del corte 5 / pago 20 de ESTA tarjeta, no del 15/2
  // de la que trae la app por defecto.
  await expect(dialog.getByText(/Se paga el 20/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
});

test('el cupo muestra el disponible y lo descuenta', async ({ page }) => {
  await crearTarjeta(page, 'Visa Cupo', '15', '2', '2000000');

  await page.goto('ajustes/metodos');
  await expect(page.getByText('$ 2.000.000')).toBeVisible();

  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Mercado');
  await dialog.getByPlaceholder('$ 0').fill('300000');
  await dialog.getByRole('button', { name: 'Visa Cupo' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('ajustes/metodos');
  await expect(page.getByText('$ 1.700.000')).toBeVisible();
});

test('borrar una tarjeta deja sus movimientos sin método, no los borra', async ({ page }) => {
  await crearTarjeta(page, 'Temporal', '10', '25');

  await page.goto('movimientos?nuevo=1');
  const nuevo = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await nuevo.getByPlaceholder('Ej. Restaurante').fill('Gasto huérfano');
  await nuevo.getByPlaceholder('$ 0').fill('90000');
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

  // El movimiento sigue vivo: la plata se gastó igual.
  await page.goto('movimientos');
  await expect(page.getByText('Gasto huérfano')).toBeVisible();
});
