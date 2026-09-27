import { test as base, expect } from '@playwright/test';

/**
 * Usa el test crudo de Playwright, no el fixture: lo que se prueba aqui es
 * justamente la pantalla que el fixture se salta.
 */
base('la configuración inicial pregunta nombre, moneda, quincenas y categorías', async ({ page }) => {
  await page.goto('');

  // 1. Nombre — no deja seguir vacío.
  await expect(page.getByText('¿Cómo quieres que te llamemos?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await page.getByLabel('Tu nombre').fill('Andrés');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 2. Moneda.
  await expect(page.getByText('¿En qué moneda manejas tu plata?')).toBeVisible();
  await page.getByRole('button', { name: /Dólar/ }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 3. Cada cuánto le pagan. Por defecto viene quincenal.
  await expect(page.getByText('¿Cada cuánto te entra la plata?')).toBeVisible();
  await expect(page.getByRole('button', { name: /Dos veces al mes/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Primer pago').fill('5');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 4. Categorías — quitar una y terminar.
  await expect(page.getByText('¿Cuáles categorías usas?')).toBeVisible();
  await page.getByRole('button', { name: /Viajes/ }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();

  // Entró a la app, saluda por el nombre y ya usa la moneda elegida.
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByText('Te queda este mes')).toBeVisible();
  await expect(page.getByText('$2,', { exact: false }).first()).toBeVisible();

  // La quincena elegida manda, y la categoría quitada no aparece.
  await expect(page.getByText('Quincena del 5')).toBeVisible();
  await page.goto('movimientos?nuevo=1');
  await expect(page.getByRole('button', { name: /Viajes/ })).toBeHidden();
});

base('no vuelve a preguntar después de configurada', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('¿Cómo quieres que te llamemos?')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();
});

/**
 * La alternativa mensual. La app nació organizando la plata en quincenas y
 * eso estaba cableado en todas partes: los días eran una tupla fija de dos,
 * la pantalla pedía siempre las claves Q1 y Q2, y el inicio dibujaba dos
 * recuadros. A quien le pagan una sola vez al mes eso no le servía.
 */
base('se puede elegir que te paguen una vez al mes', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  await page.getByRole('button', { name: 'Siguiente' }).click(); // moneda
  await page.getByRole('button', { name: 'Siguiente' }).click(); // cada cuánto

  await page.getByRole('button', { name: /Una vez al mes/ }).click();
  await expect(page.getByRole('button', { name: /Una vez al mes/ })).toHaveAttribute('aria-pressed', 'true');

  // Un solo campo de día, no dos.
  await expect(page.getByLabel('Día de pago')).toBeVisible();
  await expect(page.getByLabel('Primer pago')).toBeHidden();
  await expect(page.getByText(/Tu mes va del 1 al último día/)).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  // El inicio muestra UN periodo, con el nombre del mes, no dos quincenas.
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByText('Te queda este mes')).toBeVisible();
  await expect(page.getByText(/Quincena del/)).toBeHidden();
  // Contar los recuadros, no solo mirar que no digan "quincena": el fallo
  // real era que salían DOS, ambos llamados "Septiembre" y el segundo en
  // cero, porque el balance del mes no recibía los días de pago.
  await expect(page.getByText('Septiembre', { exact: true })).toHaveCount(1);

  // Y la lista agrupa por mes, sin hablar de quincenas.
  await page.goto('movimientos');
  await expect(page.getByText(/Quincena del/)).toBeHidden();
});

/**
 * Cambiar de idea después tiene que funcionar igual: es configuración, no
 * una decisión irreversible del primer día.
 */
base('se puede cambiar a mensual después, desde Ajustes', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  await page.goto('ajustes');
  await expect(page.getByRole('heading', { name: 'Cómo te pagan' })).toBeVisible();
  await page.getByRole('button', { name: 'Una vez al mes' }).click();

  await expect(page.getByText('Tu mes empieza el día')).toBeVisible();
  await expect(page.getByText('Segunda empieza el día')).toBeHidden();

  await page.goto('');
  await expect(page.getByText(/Quincena del/)).toBeHidden();
});
