import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRates, tableFromApi } from './fxRates';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

const api = { result: 'success', rates: { COP: 1, USD: 0.00025, EUR: 0.000227, BAD: 'x' } };

beforeEach(() => store.clear());
afterEach(() => vi.unstubAllGlobals());

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
