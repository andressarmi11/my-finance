import { useEffect, useState } from 'react';
import { addDays, parseISO, toISO } from '@/domain/dates';
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
 *
 * With Supabase configured, the table comes first from public.fx_rates: the
 * fx-rates Edge Function fetches it once a day for everyone (audit C3), so
 * the rates API sees one request a day instead of one per device. It's read
 * with a plain REST call (no supabase-js in this chunk) and needs no session.
 * If that row is missing or old — function not deployed, cron stopped — the
 * app asks open.er-api directly, as before.
 */
export const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/';
const CACHE_KEY = 'fx.daily';
const FETCH_TIMEOUT_MS = 8_000;
/** The shared source answers from our own project: give it less time. */
const SHARED_TIMEOUT_MS = 4_000;
/** A shared table older than this is ignored (the cron runs daily). */
const SHARED_MAX_AGE_DAYS = 2;

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

/**
 * The shared row holds "1 USD = x currency" for every currency. Any base
 * comes out of it: 1 currency = rates[base] / rates[currency] units of base.
 */
export function tableFromShared(base: string, fetchedOn: string, usdRates: unknown): RateTable | null {
  if (!usdRates || typeof usdRates !== 'object') return null;
  const rates = usdRates as Record<string, unknown>;
  const perBase = Number(rates[base]);
  if (!Number.isFinite(perBase) || perBase <= 0) return null;
  const perUnit: Record<string, number> = {};
  for (const [code, raw] of Object.entries(rates)) {
    const x = Number(raw);
    if (Number.isFinite(x) && x > 0) perUnit[code] = Math.round((perBase / x) * 10_000) / 10_000;
  }
  perUnit[base] = 1;
  return { base, fetchedOn, perUnit };
}

/** Whether a shared row fetched on `sharedOn` is still usable on `today`. */
export function sharedIsFresh(sharedOn: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sharedOn)) return false;
  return sharedOn >= toISO(addDays(parseISO(today), -SHARED_MAX_AGE_DAYS));
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Today's table from public.fx_rates, or null to fall back to the API. */
async function loadShared(base: string, today: string): Promise<RateTable | null> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  try {
    const r = await fetchWithTimeout(
      `${url}/rest/v1/fx_rates?base=eq.USD&select=fetched_on,rates`,
      SHARED_TIMEOUT_MS,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{ fetched_on?: string; rates?: unknown }>;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row?.fetched_on || !sharedIsFresh(row.fetched_on, today)) return null;
    // fetchedOn is the day WE got it, like the direct path: the cache is per day.
    return tableFromShared(base, today, row.rates);
  } catch {
    return null;
  }
}

async function loadDirect(base: string, today: string): Promise<RateTable | null> {
  const r = await fetchWithTimeout(`${FX_ENDPOINT}${encodeURIComponent(base)}`, FETCH_TIMEOUT_MS);
  return tableFromApi(base, today, r.ok ? await r.json() : null);
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
    // A rates API that never answers must not leave the sheet on "Trayendo
    // la tasa…" forever: each source gives up on a timeout and the cache is used.
    p = loadShared(base, today)
      .then((shared) => shared ?? loadDirect(base, today))
      .then((table) => {
        if (table) writeCache(table);
        return table ?? cached;
      })
      .catch(() => cached)
      .finally(() => { inFlight.delete(key); });
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
