import { test as signedOut } from '@playwright/test';
import { test, expect, switchLanguage } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/* Explicit locale: the app picks its language from navigator.language, and
   Playwright's browser comes in English. Without pinning it, these tests
   would check Spanish against an app that started in English. */
test.use({ reducedMotion: 'reduce', locale: 'es-CO' });
signedOut.use({ locale: 'es-CO' });

/* No onboarding fixture, ON PURPOSE: these pages have to work with no
   account and no initial setup. If they ever end up behind that door again,
   these tests fail. */
signedOut.describe('legal', () => {
  signedOut('the five documents exist and open', async ({ page }) => {
    await page.goto('legal');
    for (const title of ['Aviso legal', 'Política de privacidad', 'Términos y condiciones', 'Política de cookies', 'Copyright y propiedad intelectual']) {
      await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
    }

    await page.getByRole('button', { name: /Política de privacidad/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad');
    // What the document promises has to be what the code does.
    await expect(page.getByText(/no tiene analítica/i)).toBeVisible();
  });

  signedOut('a made-up document does not blow up the screen', async ({ page }) => {
    await page.goto('legal/inventado');
    await expect(page.getByText(/Ese documento no existe/)).toBeVisible();
  });

});

/*
 * Retries ONLY in the blocks that go through the initial setup.
 *
 * What's known: these tests pass 60/60 running the file on its own, and
 * fail ~2 in 130 under the load of the full suite. The symptom is always
 * the same —the initial setup doesn't finish closing— and it lives in the
 * shared fixture, not in what these tests check.
 *
 * Chasing it DID turn up a real bug, already fixed: OnboardingGate
 * unmounted the screen and sent you back to the first step (see
 * features/onboarding/OnboardingGate.tsx). What's left is machine
 * flakiness under load.
 *
 * This is NOT a licence to retry a test that genuinely fails: if one starts
 * failing on its own assertion —the language, the document, the link— a
 * retry won't save it and it has to be fixed.
 */
test.describe.configure({ retries: 2 });

test.describe('legal from inside the app', () => {
  test('reachable from Settings', async ({ page }) => {
    await page.goto('ajustes');
    // exact: the legal footer (now only in the legal pages, not under every
    // screen) has an "Aviso legal" link that a loose search would match.
    await page.getByRole('link', { name: 'Legal', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legal');
  });
});

test.describe('language', () => {
  test('switching to English translates the interface and the documents', async ({ page }) => {
    await switchLanguage(page, 'English');

    // The navigation changes...
    await expect(page.getByRole('link', { name: 'Legal', exact: true })).toBeVisible();
    await page.goto('legal');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legal');
    await expect(page.getByRole('button', { name: /Privacy policy/ })).toBeVisible();

    // ...and so does the document's content.
    await page.getByRole('button', { name: /Privacy policy/ }).click();
    await expect(page.getByText(/no analytics, no trackers/i)).toBeVisible();
  });

  test('the language survives a reload', async ({ page }) => {
    await switchLanguage(page, 'English');
    await page.reload();
    await page.goto('legal');
    await expect(page.getByRole('button', { name: /Cookie policy/ })).toBeVisible();
  });

  test('the document lang attribute follows the language', async ({ page }) => {
    await page.goto('ajustes');
    // The screen reader needs it to pick a voice: in Spanish it would read
    // the English with Spanish phonetics.
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
    // Ajustes → Idioma is a sheet that stays open: switch both ways in it.
    await page.getByRole('button', { name: /^Idioma/ }).click();
    const sheet = page.getByRole('dialog', { name: /^(Idioma|Language)$/ });
    await sheet.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await sheet.getByRole('button', { name: 'Español', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
  });


});

test.describe('organizing charts', () => {
  /* Analytics with no data shows the empty state, not the charts. */
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /Cargar datos de ejemplo/ }).click();
    await page.waitForTimeout(800);
  });

  test('hiding a chart removes it, and it survives a reload', async ({ page }) => {
    await page.goto('analisis');
    // Redesign §6: the donut and the balance bar are one "Gastos por categoría" card.
    const card = page.getByRole('heading', { name: /Gastos por categoría/ });
    await expect(card).toBeVisible();

    await page.getByRole('button', { name: /Organizar gráficos/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Organizar gráficos' });
    await sheet.getByRole('button', { name: 'Ocultar Gastos por categoría' }).click();
    // Scoped to the sheet: the install banner, which only shows on mobile
    // Safari, has another button with the same accessible name.
    await sheet.getByRole('button', { name: 'Cerrar' }).click();

    await expect(card).toBeHidden();
    await expect(page.getByRole('button', { name: /Organizar gráficos · 1 oculto/ })).toBeVisible();
    await page.reload();
    await expect(card).toBeHidden();
  });

  test('"back to the original order" brings everything back', async ({ page }) => {
    await page.goto('analisis');
    await page.getByRole('button', { name: /Organizar gráficos/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Organizar gráficos' });
    await sheet.getByRole('button', { name: 'Ocultar Fijos vs. variables' }).click();
    await sheet.getByRole('button', { name: 'Volver al orden original' }).click();
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByRole('heading', { name: /Fijos vs\. variables/ })).toBeVisible();
  });
});

test('the recurring form can be closed without saving', async ({ page }) => {
  await page.goto('ajustes/recurrentes');
  await page.getByRole('button', { name: /Nueva regla|Nuevo recurrente|\+/ }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo recurrente' });
  await expect(dialogo).toBeVisible();
  // The reported case: opening it by mistake and finding no way out.
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
});

/* The language comes from the browser when no preference is stored: this
   context starts in English and the app must follow it without anyone
   touching anything. */
signedOut.describe('browser in English', () => {
  signedOut.use({ locale: 'en-US' });

  signedOut('the app opens in English on its own', async ({ page }) => {
    await page.goto('legal');
    await expect(page.getByRole('button', { name: /Privacy policy/ })).toBeVisible();
  });
});
