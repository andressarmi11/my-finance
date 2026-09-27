import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Voice dictation, with a fake recognizer.
 *
 * Until now it had no test at all: headless browsers don't expose the Web
 * Speech API, so hasDictation() returns false and the microphone button
 * isn't even drawn. Which means the whole state machine —listen, stop,
 * error, try again— never ran in CI.
 *
 * The double is injected before the app loads and lets the test drive the
 * conversation: `window.__voz.hablar(...)`, `.fallar(...)`,
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
        // There is only one microphone: if ANOTHER recognizer is still
        // alive, this one won't start. That's what really happens — it isn't
        // enough for each instance to watch only itself.
        const otro = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (otro && otro !== this && otro.corriendo) throw new Error('InvalidStateError');
        if (this.corriendo) throw new Error('InvalidStateError');
        this.corriendo = true;
        (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva = this;
        (window as unknown as { __vozArranques: number }).__vozArranques += 1;
      }

      stop() {
        // Jammed: it ignores stop() and tells nobody, but still holds the
        // microphone. Only abort() kills it. That's the shape the real
        // failure takes, and the reason dictation was left unusable until
        // a reload.
        if ((window as unknown as { __vozMuda: boolean }).__vozMuda) return;
        if (!this.corriendo) return;
        this.corriendo = false;
        this.onend?.();
      }

      abort() {
        // abort() ALWAYS kills it, even when the mute mode says nothing.
        this.corriendo = false;
      }
    }

    // BOTH names: Chromium ships a native SpeechRecognition and speech.ts
    // prefers it, so overriding only the webkit- one let the real one run
    // —which, with no microphone, stays silent— and the double was never used.
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    (window as unknown as { __vozActiva: unknown }).__vozActiva = null;
    (window as unknown as { __vozArranques: number }).__vozArranques = 0;
    (window as unknown as { __vozMuda: boolean }).__vozMuda = false;

    (window as unknown as { __voz: unknown }).__voz = {
      /** Delivers text the way the real recognizer would. */
      hablar(text: string, final: boolean) {
        const isActive = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (!isActive) throw new Error('no hay dictado activo');
        const results = [{ 0: { transcript: text }, isFinal: final, length: 1 }] as unknown as Res[] & { length: number };
        isActive.onresult?.({ resultIndex: 0, results });
        if (final) isActive.stop();
      },
      fallar(code: string) {
        const isActive = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        if (!isActive) throw new Error('no hay dictado activo');
        isActive.onerror?.({ error: code });
        isActive.stop();
      },
      /** The Safari case: it ends without having heard anything. */
      terminarEnSilencio() {
        const isActive = (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva;
        isActive?.stop();
      },
      /** Safari shutting down without calling onend. */
      enmudecer() {
        (window as unknown as { __vozMuda: boolean }).__vozMuda = true;
      },
      sigueCorriendo() {
        return (window as unknown as { __vozActiva: FakeRecognition | null }).__vozActiva?.corriendo ?? false;
      },
    };
  });
}

/** Opens the "Contale a la app" sheet. */
async function abrirHoja(page: Page) {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await expect(sheet).toBeVisible();
  return sheet;
}

type Voz = {
  hablar(t: string, f: boolean): void;
  fallar(c: string): void;
  terminarEnSilencio(): void;
  enmudecer(): void;
  sigueCorriendo(): boolean;
};

test('dictating an expense saves it', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await expect(sheet.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();

  // Partial while speaking, then the final one.
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('gasté cuarenta', false));
  await expect(sheet.getByLabel('Qué pasó')).toHaveValue('gasté cuarenta');

  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('gasté cuarenta mil en el almuerzo', true));
  await expect(sheet.getByLabel('Qué pasó')).toHaveValue('gasté cuarenta mil en el almuerzo');

  // When it finishes it stops listening on its own.
  await expect(sheet.getByRole('button', { name: 'Dictar' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();
});

test('if it heard nothing, you can try again', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.fallar('no-speech'));
  await expect(sheet.getByText('No escuché nada.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Dictar' })).toBeVisible();

  // The second attempt has to work just like the first.
  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('veinte mil de café', true));
  await expect(sheet.getByLabel('Qué pasó')).toHaveValue('veinte mil de café');
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado/)).toBeVisible();
});

/**
 * Safari cuts dictation off on its own after a silence, with no error and
 * no text. If the button stayed on "Dejar de escuchar", the microphone
 * would look hung and the next attempt wouldn't start.
 */
test('if Safari cuts it off silently, the button returns to normal', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.terminarEnSilencio());
  await expect(sheet.getByRole('button', { name: 'Dictar' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('quince mil de bus', true));
  await expect(sheet.getByLabel('Qué pasó')).toHaveValue('quince mil de bus');
});

test('stopping by hand keeps the text it managed to hear', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('treinta mil de mercado', false));
  await sheet.getByRole('button', { name: 'Dejar de escuchar' }).click();

  await expect(sheet.getByRole('button', { name: 'Dictar' })).toBeVisible();
  await expect(sheet.getByLabel('Qué pasó')).toHaveValue('treinta mil de mercado');
});

/**
 * Closing the sheet while listening has to release the microphone. If the
 * recognizer were left alive, the next start() would throw
 * InvalidStateError and dictation would stop working until a reload — which
 * is exactly what "sometimes it doesn't work" looks like.
 */
test('closing while listening releases the microphone', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  const stalled = await page.evaluate(
    () => (window as never as { __vozActiva: { corriendo: boolean } | null }).__vozActiva?.corriendo ?? false,
  );
  expect(stalled, 'el reconocedor quedó corriendo tras cerrar la hoja').toBe(false);

  // Y dictar otra vez funciona.
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet2 = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet2.getByRole('button', { name: 'Dictar' }).click();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('diez mil de taxi', true));
  await expect(sheet2.getByLabel('Qué pasó')).toHaveValue('diez mil de taxi');
});

/**
 * The case that broke dictation until the app was reloaded.
 *
 * If a recognizer is left alive —Safari shuts it down without calling
 * onend, or the sheet closed halfway— the next start() throws
 * InvalidStateError. That used to be reported as "this browser won't let
 * you dictate", which on top of being a lie left the person with no way
 * out. Now the previous one is released before asking for a new one.
 */
test('a hung recognizer does not leave dictation unusable', async ({ page }) => {
  await conDictadoFalso(page);
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();

  // The recognizer jams: it ignores stop() and keeps the microphone.
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.enmudecer());

  // The sheet closes. Cleanup calls stop(), which is now useless: the
  // recognizer is still alive and still holding the microphone.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(
    await page.evaluate(() => (window as never as { __voz: Voz }).__voz.sigueCorriendo()),
    'el reconocedor encasquillado debería seguir vivo para que el test signifique algo',
  ).toBe(true);

  // Reopen and dictate. This is where everything used to die: the new
  // recognizer's start() collides with the old one and the app said "this
  // browser won't let you dictate" until you reloaded.
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet2 = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet2.getByRole('button', { name: 'Dictar' }).click();

  await expect(sheet2.getByText(/navegador no deja dictar/)).toBeHidden();
  await page.evaluate(() => (window as never as { __voz: Voz }).__voz.hablar('doce mil de pan', true));
  await expect(sheet2.getByLabel('Qué pasó')).toHaveValue('doce mil de pan');
});

/**
 * If the recognizer answers nothing —microphone busy, permission stuck
 * halfway, known Safari bugs— the button stayed on "Dejar de escuchar"
 * forever and there was no way to recover without reloading. It looked like
 * the app had frozen.
 */
test('if nobody answers, dictation gives up and says so', async ({ page }) => {
  await conDictadoFalso(page);
  await page.clock.install();
  const sheet = await abrirHoja(page);

  await sheet.getByRole('button', { name: 'Dictar' }).click();
  await expect(sheet.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();

  // At 3 seconds it's still listening: the limit is 4, and this half of the
  // test is what pins it. Without it, raising the time back to 12 would go
  // unnoticed.
  await page.clock.fastForward(3_000);
  await expect(sheet.getByRole('button', { name: 'Dejar de escuchar' })).toBeVisible();
  await expect(sheet.getByText(/Se quedó esperando/)).toBeHidden();

  // Past the limit, with no text, no error and no end arriving, it gives up.
  await page.clock.fastForward(2_000);

  await expect(sheet.getByText(/Se quedó esperando/)).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Dictar' })).toBeVisible();
  // And it releases the microphone, so the next attempt can start.
  expect(await page.evaluate(() => (window as never as { __voz: Voz }).__voz.sigueCorriendo())).toBe(false);
});
