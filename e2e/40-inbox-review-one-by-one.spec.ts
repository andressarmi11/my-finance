import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Bandeja v2 (BANDEJA.md): what arrives on its own is reviewed one at a
 * time. A missing amount keeps "Anotar" off until it's typed; recording
 * leaves a 5 s "Deshacer" that puts the entry back and removes what was
 * recorded. And a notification's /?revisar=<id> opens the review on it.
 *
 * Runs in the cloud-sync project (see playwright.config.ts): a build pointed
 * at a fake Supabase that this spec answers, inbox included.
 */

const HOST = 'http://fake-supabase.test';
const USER_ID = '00000000-0000-4000-8000-000000000040';
const EMAIL = 'inbox-test@example.test';

interface Entry { id: string; texto: string; origen: string; created_at: string; status: string }

async function fakeBackend(context: BrowserContext, entries: Entry[]) {
  const patches: Array<{ id: string; status: string }> = [];
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
      return json(200, { access_token: accessToken, token_type: 'bearer', expires_in: 3600 * 24, expires_at: exp, refresh_token: 'refresh', user });
    }
    if (url.pathname.startsWith('/auth/v1/user')) return json(200, user);
    if (url.pathname.startsWith('/auth/v1/')) return json(200, {});

    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'inbox' && req.method() === 'PATCH') {
      const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
      const { status } = req.postDataJSON() as { status: string };
      patches.push({ id, status });
      const row = entries.find((e) => e.id === id);
      if (row) row.status = status;
      return route.fulfill({ status: 204, headers: cors, body: '' });
    }
    if (req.method() === 'GET' || req.method() === 'HEAD') {
      const rows = table === 'settings' ? [settingsRow]
        : table === 'inbox' ? entries.filter((e) => e.status === 'pending')
        : [];
      return json(200, req.method() === 'HEAD' ? '' : rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    if (req.method() === 'POST') return route.fulfill({ status: 201, headers: cors, body: '' });
    if (req.method() === 'DELETE') return route.fulfill({ status: 204, headers: cors, body: '' });
    return json(405, {});
  });
  return { patches };
}

function inbox(): Entry[] {
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  return [
    { id: 'e-cielo', texto: 'Bancolombia: Compraste $500.000,00 en RESTAURANTE EL CIELO con tu T.Deb', origen: 'sms', created_at: at(1), status: 'pending' },
    { id: 'e-uber', texto: 'Bancolombia: Compra aprobada en UBER.', origen: 'sms', created_at: at(60), status: 'pending' },
  ];
}

async function signIn(page: Page) {
  await page.goto('');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-actual-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Correo')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });
}

/** Transactions saved in the app's IndexedDB, read without going through the app. */
function saved(page: Page) {
  return page.evaluate(() => new Promise<Array<{ concept: string; amount: number; source?: string; sourceLabel?: string }>>((resolve, reject) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const req = open.result.transaction('transactions').objectStore('transactions').getAll();
      req.onsuccess = () => { open.result.close(); resolve(req.result); };
      req.onerror = () => reject(req.error);
    };
    open.onerror = () => reject(open.error);
  }));
}

test('review one by one: type the missing amount, record, undo', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  const { patches } = await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signIn(page);

  // No banner: the header button with its count, and the card on Inicio.
  await expect(page.getByRole('button', { name: 'Por revisar: 2' })).toBeVisible();
  const card = page.getByRole('region', { name: 'Por revisar' });
  await expect(card.getByRole('heading', { name: '2 por revisar' })).toBeVisible();
  await expect(card).toContainText('Falta el monto');

  // Straight to Uber, the one without an amount.
  await card.getByRole('button', { name: /Uber/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Por revisar' });
  await expect(sheet).toContainText('2 de 2');
  await expect(sheet).toContainText('No pude leer el monto');
  const record = sheet.getByRole('button', { name: 'Anotar', exact: true });
  await expect(record).toBeDisabled();

  await sheet.getByLabel('Monto').fill('18000');
  await expect(sheet).toContainText('Monto escrito por ti');
  await expect(record).toBeEnabled();
  await record.click();

  const toast = page.getByRole('status').filter({ hasText: 'Anotado · Uber' });
  await expect(toast).toBeVisible();
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'done' });
  await expect.poll(async () => (await saved(page)).find((t) => t.concept === 'Uber'))
    .toMatchObject({ amount: 18_000, source: 'sms', sourceLabel: 'Bancolombia' });
  // It moved on to the next one.
  await expect(sheet.getByLabel('Concepto')).toHaveValue(/Restaurante/i);

  await toast.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'pending' });
  await expect.poll(async () => (await saved(page)).some((t) => t.concept === 'Uber')).toBe(false);
  // Back on Uber, pending again, keeping what was typed (as the prototype does).
  await expect(sheet.getByLabel('Concepto')).toHaveValue('Uber');
  await expect(sheet.getByLabel('Monto')).toHaveValue('18.000');

  // Record it for real and find its trace in Movimientos.
  await record.click();
  await expect(page.getByRole('status').filter({ hasText: 'Anotado · Uber' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(sheet).toBeHidden();

  await page.goto('movimientos');
  const row = page.getByRole('button', { name: /^Uber/ }).first();
  await expect(row.getByRole('img', { name: 'Llegó solo' })).toBeVisible();
  await row.click();
  await expect(page.getByText('Origen: SMS Bancolombia')).toBeVisible();
  await context.close();
});

test("a notification's ?revisar=<id> opens the review on that entry", async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signIn(page);

  await page.goto('?revisar=e-uber');
  const sheet = page.getByRole('dialog', { name: 'Por revisar' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Concepto')).toHaveValue('Uber');
  await expect(page).not.toHaveURL(/revisar=/);
  await context.close();
});

test('desktop: a 520 px dialog where ⌫ discards and ⏎ records', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 1440, height: 900 } });
  const { patches } = await fakeBackend(context, inbox());
  const page = await context.newPage();
  await page.goto('');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-actual-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Barra lateral' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Por revisar: 2' }).click();
  const dialog = page.getByRole('dialog', { name: 'Por revisar' });
  // Measured once the entry animation has settled.
  await expect.poll(async () => Math.round((await dialog.locator('> div').boundingBox())!.width)).toBe(520);

  // The newest first: Restaurante, complete. ⌫ discards it, no questions asked.
  await expect(dialog.getByLabel('Concepto')).toHaveValue(/Restaurante/i);
  await expect(dialog.getByRole('button', { name: 'Anotar', exact: true })).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('status').filter({ hasText: 'Descartado · Restaurante' })).toBeVisible();
  await expect.poll(() => patches).toContainEqual({ id: 'e-cielo', status: 'discarded' });

  // Uber: the amount field takes the focus; type it and ⏎ records.
  await expect(dialog.getByLabel('Monto')).toBeFocused();
  await page.keyboard.type('18000');
  await page.keyboard.press('Enter');
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'done' });
  await expect(dialog).toContainText('Todo revisado');
  await expect(dialog).toContainText('1 anotados · 1 descartados');
  await context.close();
});
