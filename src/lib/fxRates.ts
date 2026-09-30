import { useEffect, useState } from 'react';
import { todayISO } from './todayISO';

/**
 * Today's exchange rates, fetched — never typed by the user.
 *
 * Source: open.er-api.com (ExchangeRate-API's open endpoint): no key, CORS
 * enabled, covers COP/MXN/ARS/CLP/PEN, updated once a day. It's the market
 * mid rate, the same kind of figure Google Finance shows. Google itself has
 * no public API.
 *
 * Local-first: the day's table is cached, so a second transaction the same
 * day costs no request, and offline the last table fetched is used (with its
 * date shown). A transaction stores the rate it was saved with, so its amount
 * never moves afterwards.
 */
export const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/';
const CACHE_KEY = 'fx.daily';

export interface RateTable {
  /** Main currency the table is based on. */
  base: string;
  /** The day it was fetched, 'YYYY-MM-DD' (local). */
  fetchedOn: string;
  /** Units of `base` per 1 unit of each currency. */
  perUnit: Record<string, number>;
}

/**
 * The API answers "1 base = x currency"; the app needs "1 currency = y base",
 * which is what amount conversion multiplies by.
 */
export function tableFromApi(base: string, fetchedOn: string, json: unknown): RateTable | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as { result?: string; rates?: Record<string, unknown> };
  if (body.result !== 'success' || !body.rates) return null;
  const perUnit: Record<string, number> = {};
  for (const [code, raw] of Object.entries(body.rates)) {
    const x = Number(raw);
    if (Number.isFinite(x) && x > 0) perUnit[code] = Math.round((1 / x) * 10_000) / 10_000;
  }
  perUnit[base] = 1;
  return { base, fetchedOn, perUnit };
}

function readCache(base: string): RateTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all: unknown = raw ? JSON.parse(raw) : null;
    const table = all && typeof all === 'object' ? (all as Record<string, RateTable>)[base] : undefined;
    return table && table.perUnit && table.fetchedOn ? table : null;
  } catch {
    return null;
  }
}

function writeCache(table: RateTable): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, RateTable>;
    all[table.base] = table;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // Private mode: it just gets fetched again next time.
  }
}

const inFlight = new Map<string, Promise<RateTable | null>>();

/** Today's table for `base`: from the cache if it's today's, else fetched. */
export function loadRates(base: string, today = todayISO()): Promise<RateTable | null> {
  const cached = readCache(base);
  if (cached?.fetchedOn === today) return Promise.resolve(cached);
  const key = `${base}|${today}`;
  let p = inFlight.get(key);
  if (!p) {
    p = fetch(`${FX_ENDPOINT}${encodeURIComponent(base)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const table = tableFromApi(base, today, json);
        if (table) writeCache(table);
        return table ?? cached;
      })
      .catch(() => cached)
      .finally(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return p;
}

export type FxState =
  | { status: 'same' }
  | { status: 'loading' }
  | { status: 'ready'; rate: number; fetchedOn: string; stale: boolean }
  | { status: 'unavailable' };

/**
 * The rate to convert 1 `currency` into `main`. `fixed` is a rate already
 * stored on a transaction being edited: it wins, so editing never changes
 * what an old expense cost.
 */
export function useFxRate(currency: string, main: string, fixed?: number): FxState {
  const [table, setTable] = useState<RateTable | null | undefined>(() => readCache(main) ?? undefined);
  const needed = currency !== main && !fixed;

  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void loadRates(main).then((t) => { if (alive) setTable(t); });
    return () => { alive = false; };
  }, [main, needed]);

  if (currency === main) return { status: 'same' };
  if (fixed) return { status: 'ready', rate: fixed, fetchedOn: '', stale: false };
  if (table === undefined) return { status: 'loading' };
  const rate = table?.perUnit[currency];
  if (!table || !rate) return { status: 'unavailable' };
  return { status: 'ready', rate, fetchedOn: table.fetchedOn, stale: table.fetchedOn !== todayISO() };
}
