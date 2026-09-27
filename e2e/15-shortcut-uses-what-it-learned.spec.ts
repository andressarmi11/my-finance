import { test, expect } from './fixtures';

const FRASE = 'mercado 45 mil';

/**
 * El enlace del Atajo tiene que aprender igual que el resto de la app.
 *
 * Había tres caminos que interpretaban texto libre —la entrada rápida, la
 * bandeja y este enlace— y el enlace usaba SOLO la tabla de palabras clave.
 * Le corregías la categoría a la app, la aprendía, y al entrar por el Atajo
 * volvía a proponer la de siempre. Desde afuera parecía que no aprendía.
 */
test('el enlace del atajo respeta la categoría que le corregiste', async ({ page }) => {
  // 1. La tabla de palabras clave manda "mercado" a Alimentación.
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet.getByLabel('Qué pasó').fill(FRASE);
  await expect(sheet.getByText('Lo puse en Alimentación.')).toBeVisible();

  // 2. El usuario la corrige a Hogar y guarda: ahí aprende.
  await sheet.getByRole('button', { name: /Hogar/ }).click();
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();

  // Esperar la PRUEBA de que el aprendizaje quedó escrito, no un rato.
  // "Anotado" confirma la transacción; el índice de conceptos se escribe
  // aparte, y navegar antes de que termine dejaba el test a merced del
  // reloj: fallaba solo cuando la suite corría en paralelo.
  await sheet.getByLabel('Qué pasó').fill(FRASE);
  await expect(sheet.getByText('Lo puse en Hogar, como la última vez.')).toBeVisible();

  // 3. La misma frase entrando por el enlace del Atajo.
  await page.goto(`movimientos?texto=${encodeURIComponent(FRASE)}`);
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(dialog).toBeVisible();

  // Debe llegar con Hogar, no con lo que dice la tabla de palabras clave.
  await expect(dialog.getByRole('button', { name: /Hogar/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: /Alimentación/ })).toHaveAttribute('aria-pressed', 'false');
});
