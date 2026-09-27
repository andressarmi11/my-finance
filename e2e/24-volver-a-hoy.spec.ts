import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Volver al mes actual de un toque, desde cualquier distancia.
 *
 * La funcion existia a medias: el boton era la ETIQUETA del mes, que solo
 * cambiaba de color al alejarte. Nadie podia adivinarlo, y Calendario ni
 * siquiera lo tenia porque duplicaba la navegacion en vez de reusarla.
 */
test.use({ reducedMotion: 'reduce' });

/** Se aleja n meses tocando la flecha, como lo haria una persona. */
async function avanzar(page: Page, meses: number) {
  const siguiente = page.getByRole('button', { name: 'Mes siguiente' });
  for (let i = 0; i < meses; i++) await siguiente.click();
}

test.describe('movimientos', () => {
  test('no ofrece volver si ya estás en el mes actual', async ({ page }) => {
    await page.goto('movimientos');
    await expect(page.getByRole('button', { name: 'Volver al mes actual' })).toBeHidden();
  });

  test('a 14 meses de distancia, un toque devuelve al mes actual', async ({ page }) => {
    await page.goto('movimientos');
    const etiquetaInicial = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    await avanzar(page, 14);
    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).not.toBe(etiquetaInicial);

    await page.getByRole('button', { name: 'Volver al mes actual' }).click();
    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).toBe(etiquetaInicial);

    // Y al volver, el botón desaparece: ya no hay a dónde volver.
    await expect(page.getByRole('button', { name: 'Volver al mes actual' })).toBeHidden();
  });

  test('también funciona yendo hacia atrás', async ({ page }) => {
    await page.goto('movimientos');
    const inicial = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    const anterior = page.getByRole('button', { name: 'Mes anterior' });
    for (let i = 0; i < 8; i++) await anterior.click();

    await page.getByRole('button', { name: 'Volver al mes actual' }).click();
    expect(await anterior.locator('xpath=following-sibling::*[1]').textContent()).toBe(inicial);
  });
});

test.describe('calendario', () => {
  test('a 14 meses, vuelve al mes actual Y deja seleccionado hoy', async ({ page }) => {
    await page.goto('calendario');
    const inicial = await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent();

    await avanzar(page, 14);
    await page.getByRole('button', { name: 'Volver al mes actual' }).click();

    expect(await page.getByRole('button', { name: 'Mes anterior' })
      .locator('xpath=following-sibling::*[1]').textContent()).toBe(inicial);

    // Volver al mes y quedar parado en un día de otro mes seria volver a medias.
    const hoy = new Date();
    const dia = String(hoy.getDate());
    await expect(page.getByRole('heading', { level: 2 })).toContainText(dia);
  });
});
