import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * A fake Supabase for the inbox specs (cloud-sync project, see
 * playwright.config.ts): auth, settings, and an inbox whose PATCHes are
 * recorded, so the real login, session and IndexedDB all run and nothing
 * leaves the machine.
 */

const HOST = 'http://fake-supabase.test';
const USER_ID = '00000000-0000-4000-8000-000000000040';
export const EMAIL = 'inbox-test@example.test';

export interface Entry { id: string; texto: string; origen: string; created_at: string; status: string }

export async function fakeBackend(context: BrowserContext, entries: Entry[]) {
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

export function inbox(): Entry[] {
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  return [
    { id: 'e-cielo', texto: 'Bancolombia: Compraste $500.000,00 en RESTAURANTE EL CIELO con tu T.Deb', origen: 'sms', created_at: at(1), status: 'pending' },
    { id: 'e-uber', texto: 'Bancolombia: Compra aprobada en UBER.', origen: 'sms', created_at: at(60), status: 'pending' },
  ];
}

export async function signIn(page: Page) {
  await page.goto('');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-actual-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Correo')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });
}


/** Desktop: the same login, waiting for the sidebar instead of the tab bar. */
export async function signInDesktop(page: Page) {
  await page.goto('');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-actual-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Barra lateral' })).toBeVisible({ timeout: 15_000 });
}
