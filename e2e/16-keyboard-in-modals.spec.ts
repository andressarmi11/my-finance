import { test, expect } from './fixtures';

/**
 * Un modal tiene que atrapar el teclado.
 *
 * Ninguna de las once hojas lo hacía: con Tab el foco se iba a los botones
 * de ATRÁS del modal, que siguen ahí y siguen siendo clicables. Para quien
 * navega con teclado o lector de pantalla, el modal no existía: escribía
 * dentro de una ventana y el foco aparecía en la pantalla de abajo.
 */

/** ¿El foco sigue dentro del diálogo? */
function focoDentro(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const activo = document.activeElement;
    if (!activo || activo === document.body) return false;
    return Boolean(activo.closest('[role="dialog"]'));
  });
}

test('el foco no se escapa del modal con Tab', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();

  // Muchas más vueltas que controles tiene el diálogo: si se escapa por
  // algún lado, 30 tabulaciones lo encuentran.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await focoDentro(page), `se escapó en el Tab n.º ${i + 1}`).toBe(true);
  }

  // Y hacia atrás, que es por donde se escapaba primero.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await focoDentro(page), `se escapó con Shift+Tab n.º ${i + 1}`).toBe(true);
  }
});

test('Escape cierra el modal y el foco vuelve al botón que lo abrió', async ({ page }) => {
  await page.goto('');
  const abridor = page.getByRole('button', { name: 'Agregar movimiento' });
  // Se abre con el teclado, no con el ratón, porque es de quien se trata:
  // en Safari un clic no enfoca el botón (convención de iOS), así que al
  // cerrar no habría foco previo que devolver — no hay nada que arreglar
  // ahí. Quien navega con teclado sí llega enfocado, y es a esa persona a
  // la que se le perdía el foco al principio de la página.
  await abridor.focus();
  await page.keyboard.press('Enter');
  const hoja = page.getByRole('dialog', { name: 'Acción rápida' });
  await expect(hoja).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();

  // Sin esto el foco se perdía al principio de la página y había que
  // tabular desde cero para volver a donde uno estaba.
  await expect(abridor).toBeFocused();
});

test('un formulario largo también atrapa el teclado y cierra con Escape', async ({ page }) => {
  await page.goto('ajustes/categorias');
  await page.getByRole('button', { name: /Nueva categoría|\+ Nueva/ }).first().click();

  const dialogo = page.getByRole('dialog', { name: 'Nueva categoría' });
  await expect(dialogo).toBeVisible();

  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await focoDentro(page), `se escapó en el Tab n.º ${i + 1}`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
});

/**
 * El botón principal de la app tenía la acción en onPointerUp, o sea que
 * solo respondía a dedo y ratón. Con teclado no hacía nada — y VoiceOver
 * activa mandando un click, así que quien usa lector de pantalla no podía
 * agregar un movimiento.
 */
test('se puede agregar un movimiento sin tocar la pantalla', async ({ page }) => {
  await page.goto('');
  const fab = page.getByRole('button', { name: 'Agregar movimiento' });
  await fab.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeHidden();

  // Y con la barra espaciadora, que es la otra forma de activar un botón.
  await fab.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();
});
