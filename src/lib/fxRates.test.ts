import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRates, sharedIsFresh, tableFromApi, tableFromShared } from './fxRates';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

const api = { result: 'success', rates: { COP: 1, USD: 0.00025, EUR: 0.000227, BAD: 'x' } };

beforeEach(() => store.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('tableFromApi', () => {
  it('inverts "1 COP = x USD" into "1 USD = y COP"', () => {
    const t = tableFromApi('COP', '2026-09-30', api)!;
    expect(t.perUnit.USD).toBe(4000);
    expect(t.perUnit.EUR).toBeCloseTo(4405.29, 2);
    expect(t.perUnit.COP).toBe(1);
    expect(t.perUnit.BAD).toBeUndefined();
  });
  it('rejects an error answer', () => {
    expect(tableFromApi('COP', '2026-09-30', { result: 'error' })).toBeNull();
    expect(tableFromApi('COP', '2026-09-30', null)).toBeNull();
  });
});

describe('loadRates', () => {
  it('fetches once a day and serves the cache after that', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(api) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadRates('COP', '2026-09-30'))!.perUnit.USD).toBe(4000);
    expect((await loadRates('COP', '2026-09-30'))!.perUnit.USD).toBe(4000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('offline, falls back to the last table fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(api) }));
    await loadRates('COP', '2026-09-29');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const t = await loadRates('COP', '2026-09-30');
    expect(t).toMatchObject({ fetchedOn: '2026-09-29' });
  });
  it('with no network and nothing cached, there is no rate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await loadRates('COP', '2026-09-30')).toBeNull();
  });
});

describe('shared daily table (audit C3)', () => {
  const usd = { USD: 1, COP: 4000, EUR: 0.9, MXN: 20 };

  it('derives any base from the USD row', () => {
    const t = tableFromShared('COP', '2026-09-30', usd)!;
    expect(t.perUnit.USD).toBe(4000);
    expect(t.perUnit.EUR).toBeCloseTo(4444.44, 2);
    expect(t.perUnit.MXN).toBe(200);
    expect(t.perUnit.COP).toBe(1);
    expect(tableFromShared('ARS', '2026-09-30', usd)).toBeNull();
    expect(tableFromShared('COP', '2026-09-30', null)).toBeNull();
  });

  it('a row up to two days old is fresh', () => {
    expect(sharedIsFresh('2026-09-30', '2026-09-30')).toBe(true);
    expect(sharedIsFresh('2026-09-28', '2026-09-30')).toBe(true);
    expect(sharedIsFresh('2026-09-27', '2026-09-30')).toBe(false);
    expect(sharedIsFresh('garbage', '2026-09-30')).toBe(false);
  });

  it('with Supabase configured, reads the shared row and never calls the rates API', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([{ fetched_on: '2026-09-30', rates: usd }]) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadRates('COP', '2026-09-30'))!.perUnit.USD).toBe(4000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/rest/v1/fx_rates');
  });

  it('an old or missing shared row falls back to the rates API', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ fetched_on: '2026-09-01', rates: usd }]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(api) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadRates('COP', '2026-09-30'))!.perUnit.USD).toBe(4000);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('open.er-api.com');
  });
});
