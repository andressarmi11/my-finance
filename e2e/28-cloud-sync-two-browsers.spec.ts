import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Two browsers, one account. Each context has its own IndexedDB and
 * localStorage — exactly what Safari and the home-screen app are on iOS.
 *
 * The backend is an in-memory PostgREST + auth served through route(),
 * on a `.test` host: the dev server for this spec is started pointing
 * there (playwright.config.ts), so nothing leaves the machine and the
 * real login screen, the real sync and the real Dexie all run.
 */

const HOST = 'http://fake-supabase.test';
const USER_ID = '00000000-0000-4000-8000-000000000001';
// Same cap hosted Supabase applies to every select without a range.
const MAX_ROWS = 1000;

type Row = Record<string, unknown>;
const PK: Record<string, string[]> = {
  settings: ['user_id'],
  deletions: ['user_id', 'id'],
};

function makeBackend() {
  const tables = new Map<string, Row[]>();
  const t = (name: string) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  };
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp })}.sig`;
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'sync-test@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

  function filterRows(rows: Row[], params: URLSearchParams): Row[] {
    let out = rows;
    params.forEach((v, k) => {
      if (['select', 'order', 'on_conflict', 'limit', 'offset'].includes(k)) return;
      const [op, ...rest] = v.split('.');
      const val = rest.join('.');
      if (op === 'eq') out = out.filter((r) => String(r[k]) === val);
      else if (op === 'in') {
        const set = new Set(val.replace(/^\(|\)$/g, '').split(',').map((x: string) => x.replace(/^"|"$/g, '')));
        out = out.filter((r) => set.has(String(r[k])));
      } else if (op === 'gte') out = out.filter((r) => String(r[k]) >= val);
      else if (op === 'lte') out = out.filter((r) => String(r[k]) <= val);
    });
    return out;
  }

  // Every sync cycle starts by pulling tombstones: counting those GETs per
  // browser says whether a new cycle has started.
  const cycles = new Map<BrowserContext, number>();

  async function handle(context: BrowserContext) {
    cycles.set(context, 0);
    await context.route(`${HOST}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
        'access-control-expose-headers': 'content-range',
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
      const rows = t(table);
      const params = url.searchParams;

      if (req.method() === 'GET' && table === 'deletions') cycles.set(context, (cycles.get(context) ?? 0) + 1);
      if (req.method() === 'GET' || req.method() === 'HEAD') {
        const all = filterRows(rows, params);
        // PostgREST honours the Range header, and supabase-js's .range() sends it.
        const range = /^(\d+)-(\d+)$/.exec(req.headers()['range'] ?? '');
        const from = range ? Number(range[1]) : 0;
        const to = range ? Math.min(Number(range[2]), from + MAX_ROWS - 1) : MAX_ROWS - 1;
        const off = Number(params.get('offset') ?? from);
        const lim = params.has('limit') ? Math.min(Number(params.get('limit')), MAX_ROWS) : to - from + 1;
        const page = all.slice(off, off + lim);
        return json(200, req.method() === 'HEAD' ? '' : page, { 'content-range': `${off}-${off + Math.max(page.length - 1, 0)}/${all.length}` });
      }
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Row | Row[];
        const keys = PK[table] ?? ['id'];
        for (const r of Array.isArray(body) ? body : [body]) {
          const i = rows.findIndex((x) => keys.every((k) => x[k] === r[k]));
          if (i >= 0) rows[i] = { ...rows[i], ...r };
          else rows.push({ ...r });
        }
        return route.fulfill({ status: 201, headers: cors, body: '' });
      }
      if (req.method() === 'DELETE') {
        const doomed = new Set(filterRows(rows, params));
        tables.set(table, rows.filter((r) => !doomed.has(r)));
        return route.fulfill({ status: 204, headers: cors, body: '' });
      }
      return json(405, {});
    });
  }

  return { tables: t, handle, cycles: (c: BrowserContext) => cycles.get(c) ?? 0 };
}

type Backend = ReturnType<typeof makeBackend>;
const now = () => new Date().toISOString();

function seedAccount(backend: Backend) {
  backend.tables('settings').push({
    user_id: USER_ID, display_name: 'Tester', currency: 'COP', locale: 'es-CO', quincena_start_days: [10, 25],
    default_payment_method_id: null, reminder_default_days_before: 1, theme: 'system',
    onboarded_at: now(), updated_at: now(),
  });
}

/** Runs `action` and waits for the sync cycle it triggers to finish. */
async function syncAfter(page: Page, backend: Backend, action: () => Promise<unknown>) {
  const before = backend.cycles(page.context());
  await action();
  await expect.poll(() => backend.cycles(page.context()), { timeout: 15_000 }).toBeGreaterThan(before);
  // The cycle's last word is the push; give React a beat to paint the
  // indicator before asking for it to be gone.
  await page.waitForTimeout(300);
  await expect(page.getByText('Sincronizando…')).toBeHidden({ timeout: 15_000 });
}

/** A new browser: logs in through the real screen and waits for the first pull. */
async function openBrowser(browser: Browser, backend: Backend) {
  const context = await browser.newContext({ locale: 'es-CO' });
  await backend.handle(context);
  const page = await context.newPage();
  await page.goto('');
  await page.getByLabel('Correo').fill('sync-test@example.test');
  await page.getByLabel('Contraseña').fill('test-password-123');
  await syncAfter(page, backend, () => page.getByRole('button', { name: 'Entrar' }).click());
  await expect(page.getByLabel('Correo')).toBeHidden();
  return { context, page };
}

/** Leaving the app forces a sync; waits until it lands. */
async function leaveAndReturn(page: Page, backend: Backend) {
  await syncAfter(page, backend, () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
}

async function addMovement(page: Page, concept: string, amount: string, income = false) {
  await page.goto(income ? 'movimientos?nuevo=1&tipo=ingreso' : 'movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill(concept);
  await dialog.getByPlaceholder('$ 0').fill(amount);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

const toggleOf = (page: Page, concept: string) =>
  page.getByRole('button', { name: new RegExp(`^Marcar ${concept} como (pagado|pendiente|recibido|no recibido)$`) });

test('expenses, income and checks travel between two browsers, both ways', async ({ browser }) => {
  const backend = makeBackend();
  seedAccount(backend);

  const a = await openBrowser(browser, backend);
  await addMovement(a.page, 'Almuerzo prueba', '25000');
  await addMovement(a.page, 'Ingreso prueba', '45000', true);

  const almuerzo = toggleOf(a.page, 'Almuerzo prueba');
  const antes = await almuerzo.getAttribute('aria-label');
  await almuerzo.click();
  await expect(almuerzo).not.toHaveAttribute('aria-label', antes!);
  const almuerzoFinal = await almuerzo.getAttribute('aria-label');
  await leaveAndReturn(a.page, backend);

  const b = await openBrowser(browser, backend);
  await b.page.goto('movimientos');
  await expect(b.page.getByText('Almuerzo prueba')).toBeVisible();
  await expect(b.page.getByText('Ingreso prueba')).toBeVisible();
  await expect(toggleOf(b.page, 'Almuerzo prueba')).toHaveAttribute('aria-label', almuerzoFinal!);

  // And back: a check made in B shows up in A.
  const ingreso = toggleOf(b.page, 'Ingreso prueba');
  const ingresoAntes = await ingreso.getAttribute('aria-label');
  await ingreso.click();
  await expect(ingreso).not.toHaveAttribute('aria-label', ingresoAntes!);
  const ingresoFinal = await ingreso.getAttribute('aria-label');
  await leaveAndReturn(b.page, backend);

  await syncAfter(a.page, backend, () => a.page.goto('movimientos'));
  await expect(toggleOf(a.page, 'Ingreso prueba')).toHaveAttribute('aria-label', ingresoFinal!);
  await expect(toggleOf(a.page, 'Almuerzo prueba')).toHaveAttribute('aria-label', almuerzoFinal!);

  await a.context.close();
  await b.context.close();
});

test('a check on a recurring payment is not undone by the other browser generating that month', async ({ browser }) => {
  const backend = makeBackend();
  seedAccount(backend);
  backend.tables('recurring_rules').push({
    id: 'rule-arriendo', user_id: USER_ID, name: 'Arriendo', type: 'expense', amount: 1_500_000,
    category_id: null, payment_method_id: null, frequency: 'monthly', day_of_month: 1, day_of_week: null,
    start_date: '2026-01-01', end_date: null, is_active: true, updated_at: now(),
  });

  // Both browsers already know the account, and B stays open on the
  // list — a laptop tab, or the home-screen app resumed within a minute.
  const a = await openBrowser(browser, backend);
  const b = await openBrowser(browser, backend);
  await syncAfter(b.page, backend, () => b.page.goto('movimientos'));

  // A goes four months ahead — outside the window the app generates on
  // its own at start-up — and pays the rent early.
  await a.page.goto('movimientos');
  for (let i = 0; i < 4; i++) await a.page.getByRole('button', { name: 'Mes siguiente' }).click();
  await a.page.getByRole('button', { name: 'Marcar Arriendo como pagado' }).click();
  await expect(a.page.getByRole('button', { name: 'Marcar Arriendo como pendiente' })).toBeVisible();
  await leaveAndReturn(a.page, backend);

  const paidInCloud = () => backend.tables('transactions')
    .filter((r) => r.recurring_rule_id === 'rule-arriendo' && r.status === 'paid');
  expect(paidInCloud()).toHaveLength(1);

  // Later, B (no reload, so no pull yet) looks at that same month and
  // leaves the app.
  for (let i = 0; i < 4; i++) await b.page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(b.page.getByText('Arriendo').first()).toBeVisible();
  // B only looked, so leaving has nothing to upload; its next sync is the
  // next time it opens. That reload generates the month again BEFORE
  // pulling — the moment the stale copy used to win.
  await syncAfter(b.page, backend, () => b.page.reload());
  for (let i = 0; i < 4; i++) await b.page.getByRole('button', { name: 'Mes siguiente' }).click();

  // The check has to survive, in the cloud and in B.
  expect(paidInCloud()).toHaveLength(1);
  await expect(b.page.getByRole('button', { name: 'Marcar Arriendo como pendiente' })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test('an account with more than 1000 movements arrives complete in a new browser', async ({ browser }) => {
  const backend = makeBackend();
  seedAccount(backend);
  const stamp = now();
  for (let i = 0; i < 1200; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 21_600_000).toISOString().slice(0, 10);
    backend.tables('transactions').push({
      id: `tx-${i}`, user_id: USER_ID, type: 'expense', concept: `Gasto ${i}`, amount: 1000, date: d,
      category_id: null, payment_method_id: null, status: 'paid', notes: null,
      cycle_cutoff_date: null, cycle_payment_date: null, installment_group_id: null,
      installment_number: null, installment_count: null, purchase_date: null,
      quincena_key: null, recurring_rule_id: null, period_key: null, created_at: stamp, updated_at: stamp,
    });
  }

  const b = await openBrowser(browser, backend);
  const localCount = () => b.page.evaluate(async () => {
    return await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open('myfinance_v1');
      open.onsuccess = () => {
        const req = open.result.transaction('transactions').objectStore('transactions').count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  await expect.poll(localCount, { timeout: 15_000 }).toBe(1200);
  await b.context.close();
});
