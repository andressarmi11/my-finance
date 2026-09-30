import { test, expect, type Page } from '@playwright/test';

/**
 * The sign-in screen (redesign §9f, §9g 2d, §9h). It only exists in a build
 * with Supabase configured, so this runs in the cloud-sync project, against
 * the build that points at the fake `.test` host (playwright.config.ts).
 * Nothing here signs in: the screen itself is what's under test.
 */

const HOST = 'http://fake-supabase.test';

async function stubBackend(page: Page) {
  // Cloudflare Turnstile: hand the widget a token at once, offline.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile = {
      render: (el, o) => { setTimeout(() => o.callback('test-captcha-token-' + Math.random()), 50); return 'w1'; },
      reset: () => {}, remove: () => {},
    };`,
  }));
  const recover: unknown[] = [];
  await page.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (new URL(req.url()).pathname.startsWith('/auth/v1/recover')) recover.push(req.postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{}' });
  });
  return { recover };
}

const password = (page: Page) => page.getByLabel('Contraseña', { exact: true });

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the tabs switch the title, and never share a name with the submit button', async ({ page }) => {
    await stubBackend(page);
    await page.goto('');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola de nuevo');
    const login = page.getByRole('button', { name: 'Ya tengo cuenta' });
    const register = page.getByRole('button', { name: 'Crear cuenta', exact: true });
    await expect(login).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();

    await register.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crea tu cuenta');
    await expect(register).toHaveAttribute('aria-pressed', 'true');
    await expect(login).toHaveAttribute('aria-pressed', 'false');
    // The submit button has its own name: two "Crear cuenta" would be indistinguishable.
    await expect(page.getByRole('button', { name: 'Crear mi cuenta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toHaveCount(1);

    await login.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola de nuevo');

    // Phone: form only, no brand panel.
    await expect(page.getByText('Datos de ejemplo')).toHaveCount(0);
    await expect(page.getByText('Tus datos viven en tu teléfono y se respaldan en tu cuenta.')).toBeVisible();
  });

  test('creating an account waits for email, a long enough password and the terms', async ({ page }) => {
    await stubBackend(page);
    await page.goto('');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

    const submit = page.getByRole('button', { name: 'Crear mi cuenta' });
    const terms = page.getByRole('checkbox', { name: /Acepto los Términos y la Política de privacidad/ });
    const meter = page.getByRole('meter', { name: 'Fuerza de la contraseña' });
    // The captcha row turns ready on its own (the stub hands a token).
    await expect(page.getByText('Verificación de seguridad lista')).toBeVisible();
    await expect(submit).toBeDisabled();

    await page.getByLabel('Correo').fill('nueva@example.test');
    await expect(submit).toBeDisabled();

    await password(page).fill('abc');
    await expect(meter).toHaveAttribute('aria-valuetext', 'Muy corta');
    await terms.check();
    await expect(submit).toBeDisabled();

    await password(page).fill('abcdefgh');
    await expect(meter).toHaveAttribute('aria-valuetext', 'Débil');
    await expect(submit).toBeEnabled();

    await password(page).fill('Abcdef1!');
    await expect(meter).toHaveAttribute('aria-valuetext', 'Fuerte');
    await terms.uncheck();
    await expect(submit).toBeDisabled();
    await terms.check();
    await expect(submit).toBeEnabled();

    await page.getByLabel('Correo').fill('no-es-un-correo');
    await expect(submit).toBeDisabled();

    // The legal links open the documents, readable before having an account.
    await expect(page.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', /\/legal\/terminos$/);
    await expect(page.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', /\/legal\/privacidad$/);
  });

  test('the eye shows and hides the password', async ({ page }) => {
    await stubBackend(page);
    await page.goto('');
    await password(page).fill('secreta-123');
    await expect(password(page)).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(password(page)).toHaveAttribute('type', 'text');
    await expect(password(page)).toHaveValue('secreta-123');

    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await expect(password(page)).toHaveAttribute('type', 'password');
  });

  test('signing in is disabled until there is an email and a password', async ({ page }) => {
    await stubBackend(page);
    await page.goto('');
    const submit = page.getByRole('button', { name: 'Entrar', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Correo').fill('yo@example.test');
    await expect(submit).toBeDisabled();
    await password(page).fill('x');
    await expect(submit).toBeEnabled();
  });

  test('forgot password: its own title, only the email, and the link goes out with the captcha', async ({ page }) => {
    const backend = await stubBackend(page);
    await page.goto('');
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recupera tu contraseña');
    await expect(password(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ya tengo cuenta' })).toHaveCount(0);

    const send = page.getByRole('button', { name: 'Enviar enlace' });
    await expect(send).toBeDisabled();
    await page.getByLabel('Correo').fill('olvido@example.test');
    await send.click();
    await expect(page.getByText('Te enviamos un enlace a olvido@example.test.')).toBeVisible();
    expect(backend.recover).toHaveLength(1);
    expect(JSON.stringify(backend.recover[0])).toContain('test-captcha-token-');

    await page.getByRole('button', { name: /Volver a entrar/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola de nuevo');
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('split screen: brand panel with sample data that rotates, the same form on the right', async ({ page }) => {
    await stubBackend(page);
    await page.goto('');

    const panel = page.getByRole('complementary');
    await expect(panel.getByText('Step up')).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2 })).toContainText('Tu plata,');
    await expect(panel.getByText('Datos de ejemplo')).toBeVisible();
    await expect(panel.getByText('Funciona sin conexión')).toBeVisible();
    await expect(panel.getByText('Solo tú los ves')).toBeVisible();
    await expect(panel.getByText('Sin anuncios ni rastreo.')).toBeVisible();

    // The preview moves on to the next sample month every 3.4 s.
    await expect(panel.getByText('Te queda en Julio')).toBeVisible();
    await expect(panel.getByText('Te queda en Agosto')).toBeVisible({ timeout: 6000 });

    // The typewriter deletes and types: at some point the second phrase shows.
    await expect(page.getByTestId('typewriter')).toHaveText('mes a mes.', { timeout: 8000 });

    // The form is the phone's, at 400 px.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola de nuevo');
    const box = await page.getByLabel('Correo').locator('xpath=ancestor::form').boundingBox();
    expect(Math.round(box!.width)).toBe(400);
    const panelBox = await panel.boundingBox();
    expect(box!.x).toBeGreaterThan(panelBox!.x + panelBox!.width);
  });

  test('with reduced motion: first phrase fixed, no rotation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubBackend(page);
    await page.goto('');
    await expect(page.getByTestId('typewriter')).toHaveText('quincena a quincena.');
    await expect(page.getByText('Te queda en Julio')).toBeVisible();
    await page.waitForTimeout(4000);
    await expect(page.getByText('Te queda en Julio')).toBeVisible();
    await expect(page.getByTestId('typewriter')).toHaveText('quincena a quincena.');
  });

  test('in English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await stubBackend(page);
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
    await expect(page.getByTestId('typewriter')).toHaveText('paycheck by paycheck.');
    await expect(page.getByText('Sample data')).toBeVisible();
    await expect(page.getByText('Left for July')).toBeVisible();
    await expect(page.getByText('Your data lives on your phone and is backed up to your account. No ads, no tracking.')).toBeVisible();
    await context.close();
  });
});
