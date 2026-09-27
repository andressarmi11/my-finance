import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Compra diferida a N cuotas: una compra, N movimientos, uno por mes.
 *
 * Lo que se prueba de punta a punta es que la plata se reparta y que el
 * cupo se bloquee ENTERO el dia de la compra — no cuota a cuota, que es
 * como lo hace el banco.
 */
test.use({ reducedMotion: 'reduce' });

async function crearTarjeta(page: Page, nombre: string, corte: string, pago: string, cupo?: string) {
  await page.goto('ajustes/metodos');
  await page.getByRole('button', { name: '+ Nuevo método de pago' }).click();
  const d = page.getByRole('dialog', { name: 'Nuevo método de pago' });
  await d.getByLabel('Nombre').fill(nombre);
  await d.getByRole('button', { name: 'Crédito' }).click();
  await d.getByLabel('Día de corte').fill(corte);
  await d.getByLabel('Día de pago').fill(pago);
  if (cupo) await d.getByLabel('Cupo (opcional)').fill(cupo);
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

async function comprarDiferido(page: Page, concepto: string, monto: string, tarjeta: string, cuotas: string) {
  await page.goto('movimientos?nuevo=1');
  const d = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await d.getByPlaceholder('Ej. Restaurante').fill(concepto);
  await d.getByPlaceholder('$ 0').fill(monto);
  await d.getByRole('button', { name: tarjeta }).click();
  await d.getByLabel('Cuotas').fill(cuotas);
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d).toBeHidden();
}

test('una compra a 3 cuotas crea 3 movimientos rotulados', async ({ page }) => {
  await crearTarjeta(page, 'Visa', '15', '2');
  await comprarDiferido(page, 'Nevera', '900000', 'Visa', '3');

  // La cuota 1 vive en el mes de la compra.
  await page.goto('movimientos');
  await expect(page.getByText('Nevera')).toBeVisible();
  await expect(page.getByText(/cuota 1 de 3/)).toBeVisible();
  await expect(page.getByText('$ 300.000').first()).toBeVisible();

  // Las otras dos, en los meses siguientes.
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText(/cuota 2 de 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText(/cuota 3 de 3/)).toBeVisible();
});

test('el diferido bloquea el cupo completo, no una cuota', async ({ page }) => {
  await crearTarjeta(page, 'Visa Cupo', '15', '2', '5000000');
  await comprarDiferido(page, 'Nevera', '1200000', 'Visa Cupo', '12');

  // 5.000.000 - 1.200.000 (el total, no los 100.000 de la primera cuota).
  await page.goto('ajustes/metodos');
  await expect(page.getByText('$ 3.800.000')).toBeVisible();
});

test('borrar una cuota borra el diferido entero', async ({ page }) => {
  await crearTarjeta(page, 'Visa', '15', '2');
  await comprarDiferido(page, 'Nevera', '900000', 'Visa', '3');

  await page.goto('movimientos');
  await page.getByText('Nevera').click();
  const editar = page.getByRole('dialog', { name: 'Editar movimiento' });
  await editar.getByRole('button', { name: 'Eliminar' }).click();
  await expect(editar).toBeHidden();

  // Ni esta ni las de los meses siguientes.
  await expect(page.getByText('Nevera')).toBeHidden();
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.getByText('Nevera')).toBeHidden();
});
