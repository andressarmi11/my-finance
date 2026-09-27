import { test as base, expect, type Page } from '@playwright/test';

/**
 * Cada test de Playwright ya corre en su propio contexto de navegador
 * aislado (storage/IndexedDB separados), asi que no hace falta limpiar
 * la base de datos a mano entre tests — cada uno arranca de cero.
 *
 * Pero "de cero" ahora incluye la configuracion inicial, que aparece la
 * primera vez. El fixture la completa con valores por defecto para que
 * cada test siga empezando en la pantalla que le importa. El flujo en si
 * se prueba aparte, en 10-configuracion-inicial.spec.ts.
 */
export async function completarOnboarding(page: Page): Promise<void> {
  // waitFor, no isVisible(): isVisible() pregunta en ese instante, y en
  // WebKit la app tarda mas en montar que lo que tarda goto() en resolver,
  // asi que daba false y el fixture se saltaba la configuracion entera.
  const nombre = page.getByLabel('Tu nombre');
  await nombre.waitFor({ state: 'visible', timeout: 15_000 });

  await nombre.fill('Tester');

  // Se avanza HASTA que aparezca "Empezar", en vez de disparar tres clics
  // seguidos a ciegas. Aquello era una carrera: entre un clic y el
  // siguiente React puede re-renderizar el paso, y el clic caia sobre un
  // boton que ya no estaba montado. Con pocos tests casi nunca se veia;
  // con un archivo de diez, en paralelo, fallaba ~1 de cada 8.
  //
  // De paso deja de depender de que los pasos sean exactamente cuatro.
  const empezar = page.getByRole('button', { name: 'Empezar' });
  for (let i = 0; i < 8 && !(await empezar.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  await empezar.click();
  await expect(nombre).toBeHidden();
}

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    const gotoOriginal = page.goto.bind(page);
    let primeraNavegacion = true;
    page.goto = async (url, opciones) => {
      const respuesta = await gotoOriginal(url, opciones);
      if (primeraNavegacion) {
        primeraNavegacion = false;
        await completarOnboarding(page);
      }
      return respuesta;
    };
    await use(page);
  },
});

export { expect };
