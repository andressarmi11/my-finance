import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Redesign phase 6, signed in (§9f, §11 items 4 and 5): change the password
 * from Perfil, and sign out with or without "Borrar también de este
 * teléfono".
 *
 * Runs in the cloud-sync project: a build pointed at a fake `.test`
 * Supabase that this spec answers with route() (see playwright.config.ts
 * and 28-cloud-sync-two-browsers), so the real login, the real session and
 * the real IndexedDB all run and nothing leaves the machine.
 */

const HOST = 'http://fake-supabase.test';
const USER_ID = '00000000-0000-4000-8000-000000000044';
const EMAIL = 'logout-test@example.test';

interface Calls {
  passwordSignIns: string[];
  passwordUpdates: string[];
  logouts: number;
}

async function fakeBackend(context: BrowserContext): Promise<Calls> {
  const calls: Calls = { passwordSignIns: [], passwordUpdates: [], logouts: 0 };
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp })}.sig`;
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const now = new Date().toISOString();
  const settingsRow = {
    user_id: USER_ID, display_name: 'Tester', currency: 'COP', locale: 'es-CO', quincena_start_days: [10, 25],
    default_payment_method_id: null, reminder_default_days_before: 1, theme: 'system',
    onboarded_at: now, updated_at: now,
  };

  // Stand-in for Cloudflare Turnstile (the build carries the captcha).
  await context.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile = {
      render: (el, o) => { setTimeout(() => o.callback('test-captcha-token-' + Math.random()), 50); return 'w1'; },
      reset: () => {}, remove: () => {},
    };`,
  }));
  await context.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range',
    };
    const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { ...cors, ...extra }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    if (url.pathname.startsWith('/auth/v1/token')) {
      if (url.searchParams.get('grant_type') === 'password') {
        calls.passwordSignIns.push((req.postDataJSON() as { password: string }).password);
      }
      return json(200, { access_token: accessToken, token_type: 'bearer', expires_in: 3600 * 24, expires_at: exp, refresh_token: 'refresh', user });
    }
    if (url.pathname.startsWith('/auth/v1/user')) {
      if (req.method() === 'PUT') calls.passwordUpdates.push((req.postDataJSON() as { password: string }).password);
      return json(200, user);
    }
    if (url.pathname.startsWith('/auth/v1/logout')) {
      calls.logouts += 1;
      return route.fulfill({ status: 204, headers: cors });
    }
    if (url.pathname.startsWith('/auth/v1/')) return json(200, {});

    const table = url.pathname.replace('/rest/v1/', '');
    if (req.method() === 'GET' || req.method() === 'HEAD') {
      const rows = table === 'settings' ? [settingsRow] : [];
      return json(200, req.method() === 'HEAD' ? '' : rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    if (req.method() === 'POST') return route.fulfill({ status: 201, headers: cors, body: '' });
    if (req.method() === 'DELETE') return route.fulfill({ status: 204, headers: cors, body: '' });
    return json(405, {});
  });
  return calls;
}

async function signIn(page: Page) {
  await page.goto('');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-actual-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Correo')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });
}

/** Rows in a store of the app's IndexedDB, read without going through the app. */
function count(page: Page, store: string) {
  return page.evaluate((name) => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const req = open.result.transaction(name).objectStore(name).count();
      req.onsuccess = () => { open.result.close(); resolve(req.result); };
      req.onerror = () => reject(req.error);
    };
    open.onerror = () => reject(open.error);
  }), store);
}

async function addExpense(page: Page, concept: string) {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill(concept);
  await dialog.getByLabel('Valor', { exact: true }).fill('25000');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('change the password: re-authenticates with the current one, then updates', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  const calls = await fakeBackend(context);
  const page = await context.newPage();
  await signIn(page);

  await page.goto('ajustes');
  await page.getByRole('link', { name: /^Perfil/ }).click();
  await expect(page.getByText(EMAIL).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeVisible();
  await page.getByRole('link', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cambiar contraseña' })).toBeVisible();

  const save = page.getByRole('button', { name: 'Guardar contraseña' });
  await page.getByLabel('Contraseña actual').fill('clave-actual-123');
  await page.getByLabel('Contraseña nueva').fill('corta');
  await expect(page.getByText('Muy corta')).toBeVisible();
  await page.getByLabel('Contraseña nueva').fill('Nueva-Clave-2026');
  await expect(page.getByText('Fuerte')).toBeVisible();
  await page.getByLabel('Repite la nueva').fill('Nueva-Clave-2025');
  await expect(page.getByText('No coinciden')).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel('Repite la nueva').fill('Nueva-Clave-2026');
  await expect(page.getByText('Coinciden', { exact: true })).toBeVisible();

  // The captcha widget hands its token a moment later.
  await expect(save).toBeEnabled();
  const before = calls.passwordSignIns.length;
  await save.click();
  await expect(page.getByText('Listo, tu contraseña cambió.')).toBeVisible();
  expect(calls.passwordSignIns.slice(before)).toEqual(['clave-actual-123']);
  expect(calls.passwordUpdates).toEqual(['Nueva-Clave-2026']);
  await context.close();
});

test('sign out keeps this phone\'s data unless "erase it from this phone" is ticked', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  const calls = await fakeBackend(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. Plain sign out: back to the login, the data stays on the device.
  await signIn(page);
  await addExpense(page, 'Almuerzo privado');
  await page.goto('ajustes');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  let sheet = page.getByRole('dialog', { name: '¿Cerrar sesión?' });
  await expect(sheet.getByText(new RegExp(`Entra otra vez con ${EMAIL}`))).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: /Borrar también de este teléfono/ })).not.toBeChecked();
  await sheet.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Correo')).toBeVisible();
  // §9f: back on the login with the email typed and a green notice.
  await expect(page.getByLabel('Correo')).toHaveValue(EMAIL);
  await expect(page.getByText('Cerraste sesión. Tus datos siguen en tu cuenta.')).toBeVisible();
  expect(calls.logouts).toBe(1);
  expect(await count(page, 'transactions')).toBeGreaterThan(0);

  // 2. Sign in again and sign out wiping the phone.
  await signIn(page);
  await page.evaluate(() => localStorage.setItem('movimientos.collapsed', '["2026-09-Q1"]'));
  await page.goto('ajustes/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  sheet = page.getByRole('dialog', { name: '¿Cerrar sesión?' });
  await sheet.getByText('Borrar también de este teléfono').click();
  await expect(sheet.getByRole('checkbox', { name: /Borrar también de este teléfono/ })).toBeChecked();
  // Wiping ends in a reload, so nothing of the account stays in memory either.
  const reloaded = page.waitForEvent('load');
  await sheet.getByRole('button', { name: 'Cerrar sesión' }).click();
  await reloaded;

  await expect(page.getByLabel('Correo')).toBeVisible({ timeout: 15_000 });
  // The email survives the wipe's reload too (sessionStorage, not localStorage).
  await expect(page.getByLabel('Correo')).toHaveValue(EMAIL);
  expect(calls.logouts).toBe(2);
  // Nothing of the account is left: no transactions, no owner marker, no preferences.
  await expect.poll(() => count(page, 'transactions')).toBe(0);
  expect(await count(page, 'meta')).toBe(0);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('sb-')));
  expect(keys).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
