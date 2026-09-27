/**
 * Which charts show up in Analytics, and in what order.
 *
 * Lives in localStorage and not in Settings — which does sync — for the
 * same reason as the language: it's a preference about how you LOOK AT
 * the app on this device, not data about your money. On a tablet you
 * might want a different order than on the phone.
 *
 * Keys are saved by id and not by index: adding a new chart in the
 * future doesn't scramble what the user already arranged, and an id that
 * no longer exists is simply ignored on read.
 */
export type ChartId =
  | 'balance-by-category'
  | 'budgets'
  | 'distribution'
  | 'income-vs-expenses'
  | 'fixed-vs-variable'
  | 'debit-vs-credit';

export interface Chart {
  id: ChartId;
  title: string;
}

/** The factory order. Budgets goes right after the balance. */
export const DEFAULT_ORDER: ChartId[] = [
  'balance-by-category',
  'budgets',
  'distribution',
  'income-vs-expenses',
  'fixed-vs-variable',
  'debit-vs-credit',
];

const STORAGE_KEY = 'step-up:analytics-layout';
/** The key this used to be saved under. Read once, so nobody's arrangement
 *  disappears because the key got renamed; the next save moves it over. */
const LEGACY_STORAGE_KEY = 'step-up:analisis-disposicion';

export interface ChartLayout {
  order: ChartId[];
  hiddenIds: ChartId[];
}

const EMPTY_LAYOUT: ChartLayout = { order: DEFAULT_ORDER, hiddenIds: [] };

/**
 * Reads what's saved and RECONCILES it with the charts that exist today:
 * discards unknown ids and appends at the end the ones that showed up
 * after the user saved. Without this, adding a new chart would leave it
 * invisible to anyone who had ever touched the order.
 */
export function readChartLayout(): ChartLayout {
  let stored: Partial<ChartLayout> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<ChartLayout>;
  } catch { /* storage blocked or corrupt JSON: fall back to the factory one */ }
  if (!stored) return EMPTY_LAYOUT;

  const known = new Set<string>(DEFAULT_ORDER);
  const order = (stored.order ?? []).filter((id): id is ChartId => known.has(id));
  for (const id of DEFAULT_ORDER) {
    if (!order.includes(id)) order.push(id);
  }
  const hiddenIds = (stored.hiddenIds ?? []).filter((id): id is ChartId => known.has(id));
  return { order, hiddenIds };
}

export function saveChartLayout(d: ChartLayout): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* no-op */ }
}

/** Moves a chart one position up or down. The edges don't move. */
export function move(order: ChartId[], id: ChartId, delta: -1 | 1): ChartId[] {
  const i = order.indexOf(id);
  const target = i + delta;
  if (i === -1 || target < 0 || target >= order.length) return order;
  const copy = [...order];
  [copy[i], copy[target]] = [copy[target]!, copy[i]!];
  return copy;
}

export function toggleHidden(hiddenIds: ChartId[], id: ChartId): ChartId[] {
  return hiddenIds.includes(id) ? hiddenIds.filter((o) => o !== id) : [...hiddenIds, id];
}
