import { describe, expect, it } from 'vitest';
import { buildPlan, isRide, monthlyEquivalent } from './plan';
import type { PlanInput } from './types';
import type { RecurringRule, Transaction } from '../types';
import { DEFAULT_CATEGORIES } from '../seed/defaultCategories';

let seq = 0;
function tx(o: Partial<Transaction>): Transaction {
  return {
    id: `t${++seq}`, type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-01', categoryId: null, paymentMethodId: null, status: 'paid',
    quincenaKey: null, createdAt: '', updatedAt: '', ...o,
  };
}

/** One expense per month (Jul, Aug, Sep 2026). */
const monthly = (categoryId: string, concept: string, amounts: number[], day = 5) =>
  amounts.map((amount, i) => tx({ categoryId, concept, amount, date: `2026-0${7 + i}-${String(day).padStart(2, '0')}` }));

function rule(o: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'r1', name: 'r', type: 'expense', amount: 0, categoryId: null, paymentMethodId: null,
    frequency: 'monthly', startDate: '2026-01-01', isActive: true, updatedAt: '', ...o,
  };
}

/** A typical COP user: rent, varied entertainment, deliveries and rides. */
function baseTxs(): Transaction[] {
  return [
    ...monthly('cat-hogar', 'Arriendo', [2_000_000, 2_000_000, 2_000_000]),
    ...monthly('cat-ingreso', 'Salario', [6_000_000, 6_000_000, 6_000_000]).map((t) => ({ ...t, type: 'income' as const })),
    tx({ categoryId: 'cat-entretenimiento', concept: 'Cine', amount: 100_000, date: '2026-07-10' }),
    tx({ categoryId: 'cat-entretenimiento', concept: 'Bar', amount: 200_000, date: '2026-08-10' }),
    tx({ categoryId: 'cat-entretenimiento', concept: 'Concierto', amount: 300_000, date: '2026-09-10' }),
    ...monthly('cat-alimentacion', 'Mercado Éxito', [600_000, 650_000, 720_000]),
    ...monthly('cat-alimentacion', 'Rappi', [60_000, 80_000, 70_000], 12),
    ...monthly('cat-alimentacion', 'iFood', [50_000, 40_000, 50_000], 20),
    ...monthly('cat-transporte', 'Recarga TuLlave', [100_000, 120_000, 90_000]),
    ...monthly('cat-transporte', 'Uber', [30_000, 40_000, 50_000], 15),
    ...monthly('cat-ahorro', 'Bolsillo', [300_000, 300_000, 300_000]),
  ];
}

const CATEGORIES = [
  ...DEFAULT_CATEGORIES,
  { id: 'cat-ingreso', name: 'Ingreso', icon: 'income', color: '', kind: 'income' as const, isArchived: false, sortOrder: 20, updatedAt: '' },
  { id: 'cat-mascotas', name: 'Mascotas', icon: 'pet', color: '', kind: 'expense' as const, isArchived: false, sortOrder: 21, updatedAt: '' },
];

function input(o: Partial<PlanInput> = {}): PlanInput {
  return {
    today: '2026-10-01', transactions: baseTxs(), categories: CATEGORIES, recurringRules: [],
    currency: 'COP', intensity: 'balanced', locked: [], mode: 'monthly', monthlyTarget: null, ...o,
  };
}

const cat = (r: ReturnType<typeof buildPlan>, id: string) => r.categories.find((c) => c.categoryId === id)!;

describe('buildPlan', () => {
  it('uses the 3 complete months before today and averages per category', () => {
    const r = buildPlan(input());
    expect(r.historyMonths).toBe(3);
    expect(r.enoughHistory).toBe(true);
    expect(r.income).toBe(6_000_000);
    expect(r.alreadySaving).toBe(300_000);
    expect(r.categories.some((c) => c.categoryId === 'cat-ahorro')).toBe(false);
    expect(cat(r, 'cat-entretenimiento').avg).toBe(200_000);
    // Biggest avg first.
    const avgs = r.categories.map((c) => c.avg);
    expect(avgs).toEqual([...avgs].sort((a, b) => b - a));
  });

  it('fixed and locked categories are never cut', () => {
    const r = buildPlan(input({ locked: ['cat-entretenimiento'] }));
    const hogar = cat(r, 'cat-hogar');
    expect(hogar.fixed).toBe(true);
    expect([hogar.cap, hogar.cut]).toEqual([0, 0]);
    const ent = cat(r, 'cat-entretenimiento');
    expect(ent.locked).toBe(true);
    expect([ent.cap, ent.cut]).toEqual([0, 0]);
    expect(ent.reason).not.toBeNull();
  });

  it('active recurring rules covering ≥ 80 % make a category fixed', () => {
    const txs = [...baseTxs(), ...monthly('cat-mascotas', 'Veterinaria', [90_000, 110_000, 100_000])];
    const rules = [rule({ categoryId: 'cat-mascotas', amount: 40_000, frequency: 'biweekly' })];
    expect(cat(buildPlan(input({ transactions: txs, recurringRules: rules })), 'cat-mascotas').fixed).toBe(true);
    const inactive = [{ ...rules[0]!, isActive: false }];
    expect(cat(buildPlan(input({ transactions: txs, recurringRules: inactive })), 'cat-mascotas').fixed).toBe(false);
  });

  it('a stable concept every month makes a category fixed', () => {
    const txs = [...baseTxs(), ...monthly('cat-mascotas', 'Guardería Perro', [200_000, 205_000, 210_000])];
    const r = buildPlan(input({ transactions: txs }));
    expect(cat(r, 'cat-mascotas').fixed).toBe(true);
    expect(cat(r, 'cat-mascotas').cut).toBe(0);
  });

  it('day-to-day categories never turn fixed from repetition: a monthly Netflix is still cuttable', () => {
    const subs = [
      ...monthly('cat-suscripciones', 'Netflix', [45_000, 45_000, 45_000]),
      ...monthly('cat-suscripciones', 'Spotify', [17_000, 17_000, 17_000]),
    ];
    const r = buildPlan(input({
      transactions: [...baseTxs(), ...subs],
      recurringRules: [rule({ categoryId: 'cat-suscripciones', amount: 62_000 })],
    }));
    expect(cat(r, 'cat-suscripciones').fixed).toBe(false);
  });

  it('a concept bought several times a month is a habit, not a fixed charge', () => {
    const pets = [1, 2, 3, 4].flatMap((w) => monthly('cat-mascotas', 'Concentrado', [50_000, 50_000, 50_000], w * 6));
    expect(cat(buildPlan(input({ transactions: [...baseTxs(), ...pets] })), 'cat-mascotas').fixed).toBe(false);
  });

  it('monthly equivalents of each frequency', () => {
    expect(monthlyEquivalent(rule({ amount: 1200, frequency: 'yearly' }))).toBe(100);
    expect(monthlyEquivalent(rule({ amount: 120, frequency: 'weekly' }))).toBe(520);
    expect(monthlyEquivalent(rule({ amount: 300, frequency: 'custom', interval: { every: 3, unit: 'months' } }))).toBe(100);
    expect(monthlyEquivalent(rule({ amount: 600, frequency: 'custom', months: [1, 7] }))).toBe(100);
  });

  it('never cuts below the floor, at every intensity', () => {
    for (const intensity of ['gentle', 'balanced', 'intense'] as const) {
      const r = buildPlan(input({ intensity }));
      for (const c of r.categories) {
        expect(c.cut).toBeLessThanOrEqual(c.cap);
        expect(c.avg - c.cut).toBeGreaterThanOrEqual(c.floor);
      }
    }
  });

  it('caps by intensity × weight, rounded to 10.000 COP', () => {
    const r = buildPlan(input({ intensity: 'intense' }));
    expect(cat(r, 'cat-entretenimiento').cap).toBe(60_000); // 200k × 0.3 × 1
    for (const c of r.categories) expect(c.cap % 10_000).toBe(0);
  });

  it('a target above Σcap is limited and flagged', () => {
    const r = buildPlan(input({ monthlyTarget: 10_000_000 }));
    expect(r.want).toBe(10_000_000);
    expect(r.total).toBeLessThanOrEqual(r.maxCut);
    expect(r.total).toBe(r.maxCut);
    expect(r.over).toBe(true);
  });

  it('a target under Σcap is spread proportionally and not flagged', () => {
    const r = buildPlan(input({ intensity: 'intense' }));
    const half = buildPlan(input({ intensity: 'intense', monthlyTarget: r.maxCut / 2 }));
    expect(half.over).toBe(false);
    expect(Math.abs(half.total - r.maxCut / 2)).toBeLessThanOrEqual(10_000 * half.categories.length);
  });

  it('goal mode: months = ceil(goal / total)', () => {
    const r = buildPlan(input({ mode: 'goal', goalAmount: 1_000_000 }));
    expect(r.total).toBeGreaterThan(0);
    expect(r.goalMonths).toBe(Math.ceil(1_000_000 / r.total));
    expect(buildPlan(input()).goalMonths).toBeNull();
  });

  it('nothing to cut asks to unlock a category', () => {
    const ids = CATEGORIES.map((c) => c.id);
    const r = buildPlan(input({ locked: ids, mode: 'goal', goalAmount: 1_000_000 }));
    expect(r.total).toBe(0);
    expect(r.needsUnlock).toBe(true);
    expect(r.goalMonths).toBeNull();
  });

  it('an outlier does not inflate the average and is listed', () => {
    const txs = [
      ...baseTxs(),
      ...monthly('cat-compras', 'Ropa', [100_000, 120_000, 110_000]),
      tx({ categoryId: 'cat-compras', concept: 'Televisor', amount: 2_500_000, date: '2026-08-20' }),
    ];
    const c = cat(buildPlan(input({ transactions: txs })), 'cat-compras');
    expect(c.avg).toBe(110_000);
    expect(c.outliers).toEqual([{ concept: 'Televisor', amount: 2_500_000, date: '2026-08-20' }]);
    expect(c.reason).toEqual({ kind: 'oneOff', concept: 'Televisor', amount: 2_500_000 });
  });

  it('a category with no backing data is not suggested', () => {
    const txs = [...baseTxs(), tx({ categoryId: 'cat-compras', concept: 'Zapatos', amount: 300_000, date: '2026-07-03' })];
    const c = cat(buildPlan(input({ transactions: txs })), 'cat-compras');
    expect(c.reason).toBeNull();
    expect([c.cap, c.cut]).toEqual([0, 0]);
  });

  it('reasons: deliveries and rides with their counts', () => {
    const r = buildPlan(input());
    expect(cat(r, 'cat-alimentacion').reason).toEqual({ kind: 'deliveries', perMonth: 2, amountPerMonth: 116_667 });
    expect(cat(r, 'cat-transporte').reason).toEqual({ kind: 'rides', perMonth: 1, amountPerMonth: 40_000 });
    expect(isRide('Uber Eats pedido')).toBe(false);
    expect(isRide('Taxi aeropuerto')).toBe(true);
  });

  it('floors: food keeps the groceries, transport keeps the bus', () => {
    const r = buildPlan(input({ intensity: 'intense' }));
    const food = cat(r, 'cat-alimentacion');
    // avg 773.333 minus 116.667 of deliveries; the monthly groceries are not outliers.
    expect(food.avg).toBe(773_333);
    expect(food.outliers).toEqual([]);
    expect(food.floor).toBe(656_667);
    expect(food.avg - food.cut).toBeGreaterThanOrEqual(656_667);
    const transport = cat(r, 'cat-transporte');
    expect(transport.floor).toBe(103_333); // 143.333 − 40.000 of rides
  });

  it('reasons: above average, top subscription, top concepts', () => {
    const txs = [
      ...baseTxs(),
      ...monthly('cat-suscripciones', 'Netflix', [40_000, 40_000, 40_000]),
      tx({ categoryId: 'cat-suscripciones', concept: 'Spotify', amount: 20_000, date: '2026-07-02' }),
      tx({ categoryId: 'cat-suscripciones', concept: 'Spotify', amount: 22_000, date: '2026-08-02' }),
      tx({ categoryId: 'cat-otros', concept: 'regalo', amount: 50_000, date: '2026-07-02' }),
      tx({ categoryId: 'cat-otros', concept: 'Regalo', amount: 60_000, date: '2026-08-02' }),
      tx({ categoryId: 'cat-otros', concept: 'Papelería', amount: 40_000, date: '2026-09-02' }),
    ];
    const r = buildPlan(input({ transactions: txs }));
    expect(cat(r, 'cat-entretenimiento').reason).toEqual({ kind: 'aboveAverage', pct: 50, month: 9 });
    expect(cat(r, 'cat-suscripciones').reason).toEqual({ kind: 'topSubscription', concept: 'Netflix', amountPerMonth: 40_000, count: 2 });
    expect(cat(r, 'cat-otros').reason).toEqual({ kind: 'topConcepts', concepts: ['Regalo', 'Papelería'] });
  });

  it('USD rounds to 10', () => {
    const txs = [
      tx({ categoryId: 'cat-entretenimiento', concept: 'Movies', amount: 123, date: '2026-07-10' }),
      tx({ categoryId: 'cat-entretenimiento', concept: 'Bar', amount: 157, date: '2026-08-10' }),
      tx({ categoryId: 'cat-entretenimiento', concept: 'Concert', amount: 300, date: '2026-09-10' }),
    ];
    const r = buildPlan(input({ transactions: txs, currency: 'USD', intensity: 'intense' }));
    const ent = cat(r, 'cat-entretenimiento');
    expect(ent.avg).toBe(193);
    expect(ent.cap).toBe(60); // 193 × 0.3 = 57.9 → 60
    expect(r.total).toBe(60);
  });

  it('a single month of history counts as one month', () => {
    const txs = [
      tx({ categoryId: 'cat-entretenimiento', concept: 'Cine', amount: 100_000, date: '2026-09-03' }),
      tx({ categoryId: 'cat-entretenimiento', concept: 'Bar', amount: 200_000, date: '2026-09-18' }),
    ];
    const r = buildPlan(input({ transactions: txs }));
    expect(r.historyMonths).toBe(1);
    expect(cat(r, 'cat-entretenimiento').avg).toBe(300_000);
  });

  it('cancelled and current-month transactions are ignored', () => {
    const txs = [
      ...baseTxs(),
      tx({ categoryId: 'cat-entretenimiento', concept: 'Fiesta', amount: 900_000, date: '2026-08-11', status: 'cancelled' }),
      tx({ categoryId: 'cat-entretenimiento', concept: 'Fiesta', amount: 900_000, date: '2026-10-01' }),
    ];
    expect(cat(buildPlan(input({ transactions: txs })), 'cat-entretenimiento').avg).toBe(200_000);
  });

  it('no history: not enough, empty', () => {
    const r = buildPlan(input({ transactions: [tx({ categoryId: 'cat-compras', amount: 100, date: '2026-10-01' })] }));
    expect(r.historyMonths).toBe(0);
    expect(r.enoughHistory).toBe(false);
    expect(r.categories).toEqual([]);
    expect(r.needsUnlock).toBe(false);
    expect(buildPlan(input({ transactions: [] })).enoughHistory).toBe(false);
  });

  it('money summary adds up', () => {
    const r = buildPlan(input());
    const fixed = r.categories.filter((c) => c.fixed).reduce((a, c) => a + c.avg, 0);
    const daily = r.categories.filter((c) => !c.fixed).reduce((a, c) => a + c.avg, 0);
    expect(r.fixedTotal).toBe(fixed);
    expect(r.dailyTotal).toBe(daily - r.total);
    expect(r.free).toBe(r.income - r.fixedTotal - r.dailyTotal - r.alreadySaving - r.total);
  });
});
