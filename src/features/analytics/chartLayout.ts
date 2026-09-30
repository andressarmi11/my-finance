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
  | 'spend-by-category'
  | 'budgets'
  | 'fixed-vs-variable'
  | 'by-method';

export interface Chart {
  id: ChartId;
  title: string;
}

/**
 * The factory order (redesign §6/§9c). "Balance por categoría" and the
 * donut became one "Gastos por categoría"; "Ingresos vs. gastos" left (the
 * hero already says both); "Débito vs. tarjeta" became "Por método de pago".
 */
export const DEFAULT_ORDER: ChartId[] = [
  'spend-by-category',
  'budgets',
  'fixed-vs-variable',
  'by-method',
];

/**
 * Ids from before the redesign, and what they turned into. null = gone.
 * Read once so nobody's arrangement is lost; the next save stores new ids.
 */
const RENAMED: Record<string, ChartId | null> = {
  'balance-by-category': 'spend-by-category',
  'distribution': 'spend-by-category',
  'debit-vs-credit': 'by-method',
  'income-vs-expenses': null,
};

function upgrade(ids: readonly string[]): ChartId[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const out: ChartId[] = [];
  for (const raw of ids) {
    const id = raw in RENAMED ? RENAMED[raw] : raw;
    if (id && known.has(id) && !out.includes(id as ChartId)) out.push(id as ChartId);
  }
  return out;
}

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

  const order = upgrade(stored.order ?? []);
  for (const id of DEFAULT_ORDER) {
    if (!order.includes(id)) order.push(id);
  }
  // A merged card stays hidden only if everything it replaced was hidden:
  // hiding the donut alone must not take the category list away.
  const hiddenRaw = stored.hiddenIds ?? [];
  const hiddenIds = upgrade(hiddenRaw).filter((id) => {
    const sources = Object.entries(RENAMED).filter(([, to]) => to === id).map(([from]) => from);
    const fromOld = hiddenRaw.filter((h) => sources.includes(h));
    return fromOld.length === 0 || fromOld.length === sources.length;
  });
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

/** Folded cards (§9c), next to the layout: same device-only reasoning. */
const COLLAPSED_KEY = 'analytics.collapsed';

export function readCollapsed(): ChartId[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? upgrade(parsed.filter((x): x is string => typeof x === 'string')) : [];
  } catch {
    return [];
  }
}

export function saveCollapsed(ids: ChartId[]): void {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids)); } catch { /* no-op */ }
}
