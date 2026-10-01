/**
 * "Ayúdame a ahorrar": the recommendation engine (PRESUPUESTOS-Y-AHORRO.md,
 * "Motor de recomendación"). Pure and deterministic: reads up to 3 complete
 * months of history and says how much each category can sensibly lose a
 * month, and why. Never cuts fixed or locked categories, never goes below a
 * category's floor, and never suggests a cut that no real data backs.
 */
import { parseISO, shiftMonth, toISO, daysInMonth } from '../dates';
import type { Category, ISODate, RecurringRule, Transaction } from '../types';
import { INTENSITY_RATE, type CategoryPlan, type PlanInput, type PlanResult, type Reason } from './types';

/** Seeded ids that are never cut (rent, loans). */
const FIXED_IDS = new Set(['cat-hogar', 'cat-deudas']);

const WEIGHTS: Record<string, number> = {
  'cat-entretenimiento': 1,
  'cat-compras': 1,
  'cat-suscripciones': 1,
  'cat-viajes': 0.8,
  'cat-alimentacion': 0.6,
  'cat-transporte': 0.4,
  'cat-salud': 0.15,
  'cat-educacion': 0,
  'cat-servicios': 0,
  'cat-otros': 0.5,
};
const CUSTOM_WEIGHT = 0.5;
/**
 * Day-to-day categories: what's in them is a habit, not a commitment, even
 * when it repeats (a Netflix every month, groceries every month). Only the
 * rest can turn "fixed" from recurring rules or stable monthly charges.
 */
const FLEXIBLE_IDS = new Set([
  'cat-entretenimiento', 'cat-compras', 'cat-suscripciones', 'cat-viajes', 'cat-alimentacion', 'cat-transporte', 'cat-salud',
]);

const OUTLIER_FACTOR = 2.5;
const OUTLIER_MIN_COUNT = 3;
const FIXED_SHARE = 0.8;
const STABLE_RATIO = 1.1;
const ABOVE_AVERAGE = 1.15;

const DELIVERY_RE = /rappi|ifood|domicilio|didi food|uber eats|merqueo|picap food|justo/;
const RIDE_RE = /uber|didi|cabify|indriver|in driver|taxi|beat|picap/;

/** Lowercase, no accents, trimmed, single spaces. */
export function normalizeConcept(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ');
}

export function isDelivery(concept: string): boolean {
  return DELIVERY_RE.test(normalizeConcept(concept));
}

export function isRide(concept: string): boolean {
  const c = normalizeConcept(concept);
  if (/uber eats|didi food|picap food/.test(c)) return false;
  return RIDE_RE.test(c);
}

/** COP rounds to 10.000; anything else to 10. */
export function roundingUnit(currency: string): number {
  return currency === 'COP' ? 10_000 : 10;
}

/** A rule's amount expressed per month. */
export function monthlyEquivalent(rule: RecurringRule): number {
  switch (rule.frequency) {
    case 'monthly':
      return rule.amount;
    case 'biweekly':
      return rule.amount * 2;
    case 'weekly':
      return (rule.amount * 52) / 12;
    case 'yearly':
      return rule.amount / 12;
    case 'custom':
      if (rule.interval) {
        const every = Math.max(1, rule.interval.every);
        return rule.interval.unit === 'months' ? rule.amount / every : (rule.amount * 52) / 12 / every;
      }
      if (rule.months?.length) return (rule.amount * rule.months.length) / 12;
      return 0;
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** 'YYYY-MM' of a date. */
const monthKey = (date: ISODate): string => date.slice(0, 7);

function weightOf(id: string): number {
  return WEIGHTS[id] ?? CUSTOM_WEIGHT;
}

/** Concepts by total spend, with the casing of their most recent occurrence. */
function conceptTotals(txs: readonly Transaction[]): Array<{ concept: string; total: number }> {
  const by = new Map<string, { concept: string; date: ISODate; total: number }>();
  for (const t of txs) {
    const key = normalizeConcept(t.concept);
    const cur = by.get(key);
    if (!cur) by.set(key, { concept: t.concept.trim(), date: t.date, total: t.amount });
    else {
      cur.total += t.amount;
      if (t.date >= cur.date) {
        cur.concept = t.concept.trim();
        cur.date = t.date;
      }
    }
  }
  return [...by.values()]
    .sort((a, b) => b.total - a.total || a.concept.localeCompare(b.concept))
    .map(({ concept, total }) => ({ concept, total }));
}

/**
 * Single monthly charges (one per month, every window month) with a stable
 * amount, like rent or a loan payment: their monthly average. A concept
 * bought several times a month (deliveries, rides) is a habit, not a charge.
 */
function stableConceptsAvg(txs: readonly Transaction[], months: readonly string[]): number {
  if (months.length < 2) return 0;
  const by = new Map<string, Map<string, number>>();
  const count = new Map<string, Map<string, number>>();
  for (const t of txs) {
    const key = normalizeConcept(t.concept);
    const perMonth = by.get(key) ?? new Map<string, number>();
    perMonth.set(monthKey(t.date), (perMonth.get(monthKey(t.date)) ?? 0) + t.amount);
    by.set(key, perMonth);
    const counts = count.get(key) ?? new Map<string, number>();
    counts.set(monthKey(t.date), (counts.get(monthKey(t.date)) ?? 0) + 1);
    count.set(key, counts);
  }
  let sum = 0;
  for (const [key, perMonth] of by) {
    if (!months.every((m) => perMonth.has(m))) continue;
    if ([...count.get(key)!.values()].some((c) => c > 1)) continue;
    const values = months.map((m) => perMonth.get(m)!);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min > 0 && max / min <= STABLE_RATIO) sum += values.reduce((a, b) => a + b, 0) / months.length;
  }
  return sum;
}

interface CategoryStats {
  avg: number;
  kept: Transaction[];
  outliers: Transaction[];
}

function categoryStats(txs: readonly Transaction[], historyMonths: number): CategoryStats {
  let kept = [...txs];
  let outliers: Transaction[] = [];
  if (txs.length >= OUTLIER_MIN_COUNT) {
    const limit = OUTLIER_FACTOR * median(txs.map((t) => t.amount));
    // A concept bought in more than one month (the monthly groceries next to
    // small deliveries) is regular spending, not a one-off.
    const monthsOf = new Map<string, Set<string>>();
    for (const t of txs) {
      const key = normalizeConcept(t.concept);
      monthsOf.set(key, (monthsOf.get(key) ?? new Set<string>()).add(monthKey(t.date)));
    }
    const isOutlier = (t: Transaction) => t.amount > limit && monthsOf.get(normalizeConcept(t.concept))!.size < 2;
    kept = txs.filter((t) => !isOutlier(t));
    outliers = txs.filter(isOutlier);
  }
  const sum = kept.reduce((a, t) => a + t.amount, 0);
  return { avg: Math.round(sum / historyMonths), kept, outliers };
}

const EMPTY: Omit<PlanResult, 'historyMonths' | 'enoughHistory'> = {
  categories: [],
  maxCut: 0,
  total: 0,
  want: 0,
  over: false,
  goalMonths: null,
  needsUnlock: false,
  income: 0,
  alreadySaving: 0,
  fixedTotal: 0,
  dailyTotal: 0,
  free: 0,
};

export function buildPlan(input: PlanInput): PlanResult {
  const unit = roundingUnit(input.currency);
  const roundUnit = (n: number) => Math.round(n / unit) * unit;

  // Window: up to 3 complete months before today's month, from the first month with data.
  const { y, m } = parseISO(input.today);
  const firstDate = input.transactions.reduce<ISODate | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
  const months: string[] = [];
  for (let k = 3; k >= 1; k--) {
    const s = shiftMonth(y, m, -k);
    const key = `${String(s.y).padStart(4, '0')}-${String(s.m).padStart(2, '0')}`;
    if (firstDate !== null && key >= monthKey(firstDate)) months.push(key);
  }
  const historyMonths = months.length;
  if (historyMonths === 0) return { historyMonths: 0, enoughHistory: false, ...EMPTY };

  const first = parseISO(`${months[0]!}-01`);
  const last = parseISO(`${months[months.length - 1]!}-01`);
  const from = toISO(first);
  const to = toISO({ y: last.y, m: last.m, d: daysInMonth(last.y, last.m) });
  const lastMonth = months[months.length - 1]!;

  const inWindow = input.transactions.filter(
    (t) => (t.type === 'expense' || t.type === 'income') && t.status !== 'cancelled' && t.date >= from && t.date <= to,
  );
  const income = Math.round(inWindow.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0) / historyMonths);

  const byCategory = new Map<string, Transaction[]>();
  for (const t of inWindow) {
    if (t.type !== 'expense' || t.categoryId === null) continue;
    const list = byCategory.get(t.categoryId) ?? [];
    list.push(t);
    byCategory.set(t.categoryId, list);
  }

  const locked = new Set(input.locked);
  const rate = INTENSITY_RATE[input.intensity];
  let alreadySaving = 0;
  const plans: CategoryPlan[] = [];

  for (const cat of input.categories) {
    if (cat.kind !== 'expense' && cat.kind !== 'both') continue;
    const txs = byCategory.get(cat.id);
    if (!txs?.length) continue;
    const stats = categoryStats(txs, historyMonths);
    if (cat.icon === 'savings') {
      alreadySaving += stats.avg;
      continue;
    }
    plans.push(planCategory(cat, stats, txs, { input, historyMonths, months, lastMonth, locked, rate, unit, roundUnit }));
  }
  plans.sort((a, b) => b.avg - a.avg || a.categoryId.localeCompare(b.categoryId));

  // Spread what's asked proportionally to each cap.
  const maxCut = plans.reduce((a, p) => a + p.cap, 0);
  const want = input.mode === 'monthly' && input.monthlyTarget != null ? input.monthlyTarget : maxCut;
  const target = Math.min(want, maxCut);
  const f = maxCut ? target / maxCut : 0;
  for (const p of plans) p.cut = Math.min(p.cap, roundUnit(p.cap * f));
  const total = plans.reduce((a, p) => a + p.cut, 0);

  const fixedTotal = plans.filter((p) => p.fixed).reduce((a, p) => a + p.avg, 0);
  const dailyTotal = plans.filter((p) => !p.fixed).reduce((a, p) => a + p.avg, 0) - total;
  const goalMonths = input.goalAmount && total > 0 ? Math.ceil(input.goalAmount / total) : null;

  return {
    historyMonths,
    enoughHistory: true,
    categories: plans,
    maxCut,
    total,
    want,
    over: want > maxCut,
    goalMonths,
    needsUnlock: total === 0,
    income,
    alreadySaving,
    fixedTotal,
    dailyTotal,
    free: Math.max(0, income - fixedTotal - dailyTotal - alreadySaving - total),
  };
}

interface Ctx {
  input: PlanInput;
  historyMonths: number;
  months: string[];
  lastMonth: string;
  locked: Set<string>;
  rate: number;
  unit: number;
  roundUnit: (n: number) => number;
}

function planCategory(cat: Category, stats: CategoryStats, all: Transaction[], ctx: Ctx): CategoryPlan {
  const { avg, kept, outliers } = stats;
  const { historyMonths, unit, roundUnit } = ctx;
  const id = cat.id;
  const weight = weightOf(id);
  const isLocked = ctx.locked.has(id);

  const deliveries = id === 'cat-alimentacion' ? kept.filter((t) => isDelivery(t.concept)) : [];
  const rides = id === 'cat-transporte' ? kept.filter((t) => isRide(t.concept)) : [];
  const deliveriesAvg = deliveries.reduce((a, t) => a + t.amount, 0) / historyMonths;
  const ridesAvg = rides.reduce((a, t) => a + t.amount, 0) / historyMonths;

  // Fixed: rent/loans, recurring rules that cover most of it, or stable concepts every month.
  const recurringMonthly = ctx.input.recurringRules
    .filter((r) => r.isActive && r.type === 'expense' && r.categoryId === id)
    .reduce((a, r) => a + monthlyEquivalent(r), 0);
  const fixed =
    FIXED_IDS.has(id) ||
    (!FLEXIBLE_IDS.has(id) && avg > 0 && recurringMonthly >= FIXED_SHARE * avg) ||
    (!FLEXIBLE_IDS.has(id) && avg > 0 && stableConceptsAvg(all, ctx.months) >= FIXED_SHARE * avg);

  let floor: number;
  switch (id) {
    case 'cat-alimentacion':
      floor = Math.max(avg - deliveriesAvg, 0.5 * avg);
      break;
    case 'cat-transporte':
      floor = Math.max(avg - ridesAvg, 0.6 * avg);
      break;
    case 'cat-salud':
      floor = 0.85 * avg;
      break;
    case 'cat-entretenimiento':
      floor = 0.3 * avg;
      break;
    case 'cat-compras':
      floor = 0.25 * avg;
      break;
    default:
      floor = 0.5 * avg;
  }

  const reason = reasonFor(id, avg, kept, outliers, deliveries, rides, deliveriesAvg, ridesAvg, ctx);

  let cap = 0;
  if (!isLocked && !fixed && weight > 0 && reason !== null) {
    const room = avg - floor;
    cap = roundUnit(avg * ctx.rate * weight);
    if (cap > room) cap = Math.floor(room / unit) * unit;
    cap = Math.max(0, cap);
  }

  return {
    categoryId: id,
    avg,
    // Money is whole; ceil keeps avg − cap ≥ floor true for the reported value too.
    floor: Math.ceil(floor),
    weight,
    fixed,
    locked: isLocked,
    cap,
    cut: 0,
    reason,
    outliers: outliers.map((t) => ({ concept: t.concept, amount: t.amount, date: t.date })),
  };
}

function reasonFor(
  id: string,
  avg: number,
  kept: Transaction[],
  outliers: Transaction[],
  deliveries: Transaction[],
  rides: Transaction[],
  deliveriesAvg: number,
  ridesAvg: number,
  ctx: Ctx,
): Reason | null {
  const { historyMonths } = ctx;
  if (deliveries.length >= 2) {
    return { kind: 'deliveries', perMonth: Math.round(deliveries.length / historyMonths), amountPerMonth: Math.round(deliveriesAvg) };
  }
  if (rides.length >= 2) {
    return { kind: 'rides', perMonth: Math.round(rides.length / historyMonths), amountPerMonth: Math.round(ridesAvg) };
  }
  if (id === 'cat-suscripciones' && kept.length >= 1) {
    const concepts = conceptTotals(kept);
    const top = concepts[0]!;
    return { kind: 'topSubscription', concept: top.concept, amountPerMonth: Math.round(top.total / historyMonths), count: concepts.length };
  }
  const lastSpend = kept.filter((t) => monthKey(t.date) === ctx.lastMonth).reduce((a, t) => a + t.amount, 0);
  if (avg > 0 && lastSpend >= ABOVE_AVERAGE * avg) {
    return { kind: 'aboveAverage', pct: Math.round((lastSpend / avg - 1) * 100), month: Number(ctx.lastMonth.slice(5, 7)) };
  }
  if (outliers.length) {
    const big = outliers.reduce((a, t) => (t.amount > a.amount ? t : a));
    return { kind: 'oneOff', concept: big.concept, amount: big.amount };
  }
  if (kept.length + outliers.length >= 2) {
    return { kind: 'topConcepts', concepts: conceptTotals(kept).slice(0, 2).map((c) => c.concept) };
  }
  return null;
}
