import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * El dictado por voz, con un reconocedor falso.
 *
 * Hasta ahora no tenía ni una prueba: los navegadores headless no exponen
 * la Web Speech API, así que hayDictado() devuelve false y el botón del
 * micrófono ni se dibuja. O sea que toda la máquina de estados —escuchar,
 * parar, error, volver a intentar— nunca se ejecutó en CI.
 *
 * El doble se inyecta antes de que cargue la app y deja conducir la
 * conversación desde el test: `window.__voz.hablar(...)`, `.fallar(...)`,
 * `.terminarEnSilencio()`.
 */
async function conDictadoFalso(page: Page) {
  await page.addInitScript(() => {
    interface Alt { transcript: string }
    interface Res { 0: Alt; isFinal: boolean; length: number }

    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: { resultIndex: number; results: Res[] & { length: number } }) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      corriendo = false;

      start() {
        // El micrófono es uno solo: si OTRO reconocedor sigue vivo, este no
        // arranca. Es lo que pasa de verdad — no basta con que cada
        // instancia se vigile a sí misma.
        const otro = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (otro && otro !== this && otro.corriendo) throw new Error('InvalidStateError');
        if (this.corriendo) throw new Error('InvalidStateError');
        this.corriendo = true;
        (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva = this;
        (window as unknown as { __vozArranques: number }).__vozArranques += 1;
      }

      stop() {
        // Encasquillado: ignora stop() y no avisa a nadie, pero sigue
        // agarrado al micrófono. Solo abort() lo mata. Es la forma que tiene
        // el fallo de verdad, y la razón de que el dictado quedara
        // inservible hasta recargar.
        if ((window as unknown as { __vozMuda: boolean }).__vozMuda) return;
        if (!this.corriendo) return;
        this.corriendo = false;
        this.onend?.();
      }

      abort() {
        // abort() SIEMPRE mata, aunque el modo mudo no avise.
        this.corriendo = false;
      }
    }

    // Los DOS nombres: Chromium trae SpeechRecognition nativo y speech.ts
    // lo prefiere, así que pisar solo el webkit- dejaba correr el de verdad
    // —que sin micrófono se queda callado— y el doble no se usaba nunca.
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    (window as unknown as { __vozActiva: unknown }).__vozActiva = null;
    (window as unknown as { __vozArranques: number }).__vozArranques = 0;
    (window as unknown as { __vozMuda: boolean }).__vozMuda = false;

    (window as unknown as { __voz: unknown }).__voz = {
      /** Entrega texto como lo haría el reconocedor real. */
      hablar(texto: string, final: boolean) {
        const activa = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (!activa) throw new Error('no hay dictado activo');
        const results = [{ 0: { transcript: texto }, isFinal: final, length: 1 }] as unknown as Res[] & { length: number };
        activa.onresult?.({ resultIndex: 0, results });
        if (final) activa.stop();
      },
      fallar(codigo: string) {
        const activa = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (!activa) throw new Error('no hay dictado activo');
        activa.onerror?.({ error: codigo });
        activa.stop();
      },
      /** El caso de Safari: se acaba sin haber oído nada. */
      terminarEnSilencio() {
        const activa = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        activa?.stop();
      },
      /** Safari que se apaga sin llamar a onend. */
      enmudecer() {
        (window as unknown as { __vozMuda: boolean }).__vozMuda = true;
      },
      sigueCorriendo() {
        return (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva?.corriendo ?? false;
      },
    };
  });
}

/** Abre la hoja de "Contale a la app". */
async function abrirHoja(page: Page) {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Contale a la app' });
  await expect(hoja).toBeVisible();
  return hoja;
}

type Voz = {
  hablar(t: string, f: boolean): void;
  fallar(c: string): void;
  terminarEnSilencio(): void;
  enmudecer(): void;
  sigueCorriendo(): boolean;
};

test('dictar un gasto lo guarda', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await expect(hoja.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();

  // Parcial mientras habla, y luego el definitivo.
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('gasté cuarenta', false));
  await expect(hoja.getByLabel('Qué pasó')).toHaveValue('gasté cuarenta');

  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('gasté cuarenta mil en el almuerzo', true));
  await expect(hoja.getByLabel('Qué pasó')).toHaveValue('gasté cuarenta mil en el almuerzo');

  // Al terminar deja de escuchar solo.
  await expect(hoja.getByRole('button', { name: 'Dictar' })).toBeVisible();

  await hoja.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(hoja.getByText(/Anotado/)).toBeVisible();
});

test('si no escuchó nada, se puede volver a intentar', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.fallar('no-speech'));
  await expect(hoja.getByText('No escuché nada.')).toBeVisible();
  await expect(hoja.getByRole('button', { name: 'Dictar' })).toBeVisible();

  // El segundo intento tiene que funcionar igual que el primero.
  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('veinte mil de café', true));
  await expect(hoja.getByLabel('Qué pasó')).toHaveValue('veinte mil de café');
  await hoja.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(hoja.getByText(/Anotado/)).toBeVisible();
});

/**
 * Safari corta el dictado solo tras un silencio, sin error y sin texto.
 * Si el botón se quedara en "Dejar de escuchar", el micrófono parecería
 * colgado y el siguiente intento no arrancaría.
 */
test('si Safari lo corta en silencio, el botón vuelve a su sitio', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.terminarEnSilencio());
  await expect(hoja.getByRole('button', { name: 'Dictar' })).toBeVisible();

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('quince mil de bus', true));
  await expect(hoja.getByLabel('Qué pasó')).toHaveValue('quince mil de bus');
});

test('parar a mano deja el texto que alcanzó a oír', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('treinta mil de mercado', false));
  await hoja.getByRole('button', { name: 'Dejar de escuchar' }).click();

  await expect(hoja.getByRole('button', { name: 'Dictar' })).toBeVisible();
  await expect(hoja.getByLabel('Qué pasó')).toHaveValue('treinta mil de mercado');
});

/**
 * Cerrar la hoja mientras escucha tiene que soltar el micrófono. Si el
 * reconocedor quedara vivo, el siguiente start() lanzaría InvalidStateError
 * y el dictado dejaría de funcionar hasta recargar — que es exactamente la
 * forma que tiene "a veces no funciona".
 */
test('cerrar mientras escucha suelta el micrófono', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();

  const colgado = await page.evaluate(
    () => (window as never as { __vozActiva: { corriendo: boolean } | null }).__vozActiva?.corriendo ?? false,
  );
  expect(colgado, 'el reconocedor quedó corriendo tras cerrar la hoja').toBe(false);

  // Y dictar otra vez funciona.
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const hoja2 = page.getByRole('dialog', { name: 'Contale a la app' });
  await hoja2.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('diez mil de taxi', true));
  await expect(hoja2.getByLabel('Qué pasó')).toHaveValue('diez mil de taxi');
});

/**
 * El caso que rompía el dictado hasta recargar la app.
 *
 * Si un reconocedor queda vivo —Safari lo apaga sin llamar a onend, o la
 * hoja se cerró a mitad—, el siguiente start() lanza InvalidStateError.
 * Antes eso se reportaba como "este navegador no deja dictar", que además
 * de ser mentira dejaba a la persona sin salida. Ahora se suelta el
 * anterior antes de pedir uno nuevo.
 */
test('un reconocedor colgado no deja el dictado inservible', async ({ page }) => {
  await conDictadoFalso(page);
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();

  // El reconocedor se encasquilla: ignora stop() y se queda con el micrófono.
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.enmudecer());

  // Se cierra la hoja. La limpieza llama a stop(), que ya no sirve de nada:
  // el reconocedor sigue vivo y agarrado al micrófono.
  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();
  expect(
    await page.evaluate(() => (window as never as { __voz: Voz }).__voz.sigueCorriendo()),
    'el reconocedor encasquillado debería seguir vivo para que el test signifique algo',
  ).toBe(true);

  // Se vuelve a abrir y se dicta. Acá es donde antes moría todo: el start()
  // del reconocedor nuevo choca con el viejo y la app decía "este navegador
  // no deja dictar" hasta que recargaras.
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const hoja2 = page.getByRole('dialog', { name: 'Contale a la app' });
  await hoja2.getByRole('button', { name: 'Dictar' }).click();

  await expect(hoja2.getByText(/navegador no deja dictar/)).toBeHidden();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('doce mil de pan', true));
  await expect(hoja2.getByLabel('Qué pasó')).toHaveValue('doce mil de pan');
});

/**
 * Si el reconocedor no contesta nada —micrófono ocupado, permiso a medias,
 * errores conocidos de Safari— el botón se quedaba en "Dejar de escuchar"
 * para siempre y no había forma de recuperarlo sin recargar. Parecía que la
 * app se había colgado.
 */
test('si nadie contesta, el dictado se rinde y lo dice', async ({ page }) => {
  await conDictadoFalso(page);
  await page.clock.install();
  const hoja = await abrirHoja(page);

  await hoja.getByRole('button', { name: 'Dictar' }).click();
  await expect(hoja.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();

  // A los 3 segundos todavía está escuchando: el límite son 4, y esta mitad
  // del test es la que lo fija. Sin ella, subir el tiempo a 12 otra vez
  // pasaría desapercibido.
  await page.clock.fastForward(3_000);
  await expect(hoja.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();
  await expect(hoja.getByText(/Se quedó esperando/)).toBeHidden();

  // Pasado el límite, y sin que llegue ni texto, ni error, ni fin, se rinde.
  await page.clock.fastForward(2_000);

  await expect(hoja.getByText(/Se quedó esperando/)).toBeVisible();
  await expect(hoja.getByRole('button', { name: 'Dictar' })).toBeVisible();
  // Y suelta el micrófono, para que el siguiente intento arranque.
  expect(await page.evaluate(() => (window as never as { __voz: Voz }).__voz.sigueCorriendo())).toBe(false);
});
