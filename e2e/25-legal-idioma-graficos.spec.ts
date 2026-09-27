import { test as sinCuenta } from '@playwright/test';
import { test, expect } from './fixtures';

/* locale explicito: la app elige idioma segun navigator.language, y el
   navegador de Playwright viene en ingles. Sin fijarlo, estos tests
   comprobarian el español contra una app que arranco en ingles. */
test.use({ reducedMotion: 'reduce', locale: 'es-CO' });
sinCuenta.use({ locale: 'es-CO' });

/* Sin el fixture de onboarding A PROPOSITO: estas paginas tienen que
   funcionar sin cuenta y sin configuracion inicial. Si algun dia vuelven a
   quedar detras de esa puerta, estos tests caen. */
sinCuenta.describe('legal', () => {
  sinCuenta('los cinco documentos existen y se abren', async ({ page }) => {
    await page.goto('legal');
    for (const titulo of ['Aviso legal', 'Política de privacidad', 'Términos y condiciones', 'Política de cookies', 'Copyright y propiedad intelectual']) {
      await expect(page.getByRole('button', { name: new RegExp(titulo) })).toBeVisible();
    }

    await page.getByRole('button', { name: /Política de privacidad/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad');
    // Lo que el documento promete tiene que ser lo que el codigo hace.
    await expect(page.getByText(/no tiene analítica/i)).toBeVisible();
  });

  sinCuenta('un documento inventado no revienta la pantalla', async ({ page }) => {
    await page.goto('legal/inventado');
    await expect(page.getByText(/Ese documento no existe/)).toBeVisible();
  });

});

/*
 * Reintentos SOLO en los bloques que pasan por la configuracion inicial.
 *
 * Que se sabe: estos tests pasan 60/60 corriendo el archivo solo, y fallan
 * ~2 de cada 130 bajo la carga de la suite completa. El sintoma siempre es
 * el mismo —la configuracion inicial no termina de cerrarse— y vive en el
 * fixture compartido, no en lo que estos tests comprueban.
 *
 * Persiguiendolo SI salio un bug real, que ya esta arreglado:
 * OnboardingGate desmontaba la pantalla y te devolvia al primer paso (ver
 * features/onboarding/OnboardingGate.tsx). Lo que queda es fragilidad de
 * la maquina bajo carga.
 *
 * Esto NO es licencia para reintentar un test que falla de verdad: si
 * alguno empieza a fallar por su propia asercion —el idioma, el documento,
 * el enlace— el reintento no lo va a salvar y hay que arreglarlo.
 */
test.describe.configure({ retries: 2 });

test.describe('legal desde la app', () => {
  test('se llega desde Ajustes', async ({ page }) => {
    await page.goto('ajustes');
    await page.getByRole('link', { name: 'Legal' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legal');
  });
});

test.describe('idioma', () => {
  test('cambiar a inglés traduce la interfaz y los documentos', async ({ page }) => {
    await page.goto('ajustes');
    await page.getByRole('button', { name: 'English' }).click();

    // La navegación cambia...
    await expect(page.getByRole('link', { name: 'Legal' })).toBeVisible();
    await page.goto('legal');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legal');
    await expect(page.getByRole('button', { name: /Privacy policy/ })).toBeVisible();

    // ...y el contenido del documento también.
    await page.getByRole('button', { name: /Privacy policy/ }).click();
    await expect(page.getByText(/no analytics, no trackers/i)).toBeVisible();
  });

  test('el idioma sobrevive a recargar', async ({ page }) => {
    await page.goto('ajustes');
    await page.getByRole('button', { name: 'English' }).click();
    await page.reload();
    await page.goto('legal');
    await expect(page.getByRole('button', { name: /Cookie policy/ })).toBeVisible();
  });

  test('el atributo lang del documento acompaña al idioma', async ({ page }) => {
    await page.goto('ajustes');
    // Lo necesita el lector de pantalla para elegir voz: en español leeria
    // el ingles con fonetica española.
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: 'Español' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
  });


});

test.describe('organizar gráficos', () => {
  /* Análisis sin datos muestra el estado vacío, no los gráficos. */
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /Cargar datos de ejemplo/ }).click();
    await page.waitForTimeout(800);
  });

  test('ocultar un gráfico lo quita, y sobrevive a recargar', async ({ page }) => {
    await page.goto('analisis');
    await expect(page.getByText('DISTRIBUCIÓN DE GASTOS')).toBeVisible();

    await page.getByRole('button', { name: /Organizar gráficos/ }).click();
    const hoja = page.getByRole('dialog', { name: 'Organizar gráficos' });
    await hoja.getByRole('button', { name: 'Ocultar Distribución de gastos' }).click();
    // Acotado a la hoja: el banner de instalación, que solo sale en Safari
    // móvil, tiene otro botón con el mismo nombre accesible.
    await hoja.getByRole('button', { name: 'Cerrar' }).click();

    await expect(page.getByText('DISTRIBUCIÓN DE GASTOS')).toBeHidden();
    await page.reload();
    await expect(page.getByText('DISTRIBUCIÓN DE GASTOS')).toBeHidden();
  });

  test('"volver al orden original" devuelve todo', async ({ page }) => {
    await page.goto('analisis');
    await page.getByRole('button', { name: /Organizar gráficos/ }).click();
    const hoja = page.getByRole('dialog', { name: 'Organizar gráficos' });
    await hoja.getByRole('button', { name: 'Ocultar Fijos vs. variables' }).click();
    await hoja.getByRole('button', { name: 'Volver al orden original' }).click();
    await hoja.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByText('FIJOS VS. VARIABLES')).toBeVisible();
  });
});

test('el recurrente se puede cerrar sin guardar', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: /Nueva regla|Nuevo recurrente|\+/ }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await expect(dialogo).toBeVisible();
  // El caso reportado: abrirlo por error y no encontrar salida.
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
});

/* El idioma sale del navegador cuando no hay preferencia guardada: este
   contexto arranca en ingles y la app debe seguirlo sin que nadie toque
   nada. */
sinCuenta.describe('navegador en inglés', () => {
  sinCuenta.use({ locale: 'en-US' });

  sinCuenta('la app abre en inglés sola', async ({ page }) => {
    await page.goto('legal');
    await expect(page.getByRole('button', { name: /Privacy policy/ })).toBeVisible();
  });
});
