import { describe, expect, it } from 'vitest';
import { isUntouched, planPropagation, removableOnRuleDelete, staleCustomOccurrences } from './propagate';
import type { PaymentMethod, RecurringRule, Transaction } from '../types';

const TODAY = '2026-09-10';
const GEN = '1970-01-01T00:00:00.000Z';

const oldRule: RecurringRule = {
  id: 'r1', name: 'Arriendo', type: 'expense', amount: 1_000_000, categoryId: 'cat-a',
  paymentMethodId: null, frequency: 'monthly', dayOfMonth: 20, startDate: '2026-01-20',
  isActive: true, updatedAt: '',
};
const occ = (key: string, o: Partial<Transaction> = {}): Transaction => ({
  id: `r1:${key}`, type: 'expense', concept: 'Arriendo', amount: 1_000_000, date: `${key}-20`,
  categoryId: 'cat-a', paymentMethodId: null, status: 'pending', quincenaKey: null,
  recurringRuleId: 'r1', periodKey: key, createdAt: '', updatedAt: GEN, ...o,
});
const noMethods = new Map<string, PaymentMethod>();
const plan = (next: Partial<RecurringRule>, txs: Transaction[]) =>
  planPropagation(oldRule, { ...oldRule, ...next }, txs, TODAY, noMethods);

describe('planPropagation', () => {
  it('propagates amount and name to untouched pending future occurrences', () => {
    const c = plan({ amount: 1_200_000, name: 'Renta' }, [occ('2026-09'), occ('2026-10')]);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ kind: 'update', patch: { amount: 1_200_000, concept: 'Renta' } });
  });
  it('leaves paid, cancelled and past occurrences alone', () => {
    const c = plan({ amount: 5 }, [
      occ('2026-09', { status: 'paid' }), occ('2026-10', { status: 'cancelled' }),
      occ('2026-08', { date: '2026-08-20' }), occ('2026-11'),
    ]);
    expect(c.map((x) => x.id)).toEqual(['r1:2026-11']);
  });
  it('keeps a hand-edited amount but still propagates the category', () => {
    const c = plan({ amount: 1_500_000, categoryId: 'cat-b' }, [occ('2026-10', { amount: 900_000, updatedAt: '2026-09-01T00:00:00Z' })]);
    expect(c[0]!.patch).toEqual({ categoryId: 'cat-b' });
  });
  it('moves the date when the day changes and reports the delta', () => {
    const c = plan({ dayOfMonth: 25 }, [occ('2026-10')]);
    expect(c[0]).toMatchObject({ patch: { date: '2026-10-25' }, dateDeltaDays: 5 });
  });
  it('keeps a hand-moved date', () => {
    expect(plan({ dayOfMonth: 25 }, [occ('2026-10', { date: '2026-10-22' })])).toEqual([]);
  });
  it('recomputes the credit cycle when the method changes to a card', () => {
    const card = { id: 'tc', type: 'credit', name: 'TC', isDefault: false, cutoffDay: 15, paymentDay: 2 } as PaymentMethod;
    const c = planPropagation(oldRule, { ...oldRule, paymentMethodId: 'tc' }, [occ('2026-10')], TODAY, new Map([['tc', card]]));
    expect(c[0]!.patch).toMatchObject({ paymentMethodId: 'tc', cycleCutoffDate: '2026-11-15', cyclePaymentDate: '2026-12-02' });
  });
  it('an end date removes only untouched pending occurrences after it', () => {
    const c = plan({ endDate: '2026-10-31' }, [
      occ('2026-10'), occ('2026-11'), occ('2026-12', { amount: 5, updatedAt: '2026-09-02T00:00:00Z' }), occ('2027-01', { status: 'paid' }),
    ]);
    expect(c.map((x) => [x.id, x.kind])).toEqual([['r1:2026-11', 'remove']]);
  });
  it('a pattern change removes untouched keys the new rule no longer produces', () => {
    const c = plan({ frequency: 'custom', months: [12], dayOfMonth: 20 }, [occ('2026-10'), occ('2026-12')]);
    expect(c.map((x) => [x.id, x.kind])).toEqual([['r1:2026-10', 'remove']]);
  });
  it('a deactivated rule changes nothing', () => {
    expect(plan({ isActive: false, amount: 1 }, [occ('2026-10')])).toEqual([]);
  });
  it('ignores occurrences of other rules', () => {
    expect(plan({ amount: 1 }, [occ('2026-10', { recurringRuleId: 'other' })])).toEqual([]);
  });
});

describe('staleCustomOccurrences (old clients expanded custom as yearly)', () => {
  const custom: RecurringRule = { ...oldRule, frequency: 'custom', months: [3], dayOfMonth: 5 };
  const range = { from: '2026-01-01', to: '2027-12-31' };
  it('flags untouched pending ruleId:YYYY ghosts only', () => {
    const ghost = occ('2026', { date: '2026-03-05' });
    const real = occ('2026-03', { date: '2026-03-05' });
    const touched = occ('2027', { date: '2027-03-05', updatedAt: '2026-09-01T00:00:00Z' });
    expect(staleCustomOccurrences(custom, [ghost, real, touched], range)).toEqual([ghost]);
  });
  it('does nothing for non-custom rules', () => {
    expect(staleCustomOccurrences(oldRule, [occ('2026')], range)).toEqual([]);
  });
});

describe('removableOnRuleDelete', () => {
  it('only untouched pending occurrences from today on', () => {
    const keep = [
      occ('2026-09', { status: 'paid' }), occ('2026-10', { amount: 5, updatedAt: '2026-09-02T00:00:00Z' }),
      occ('2026-08', { date: '2026-08-20' }), occ('2026-11', { recurringRuleId: 'other' }),
    ];
    const gone = [occ('2026-12'), occ('2027-01')];
    expect(removableOnRuleDelete(oldRule, [...keep, ...gone], TODAY)).toEqual(gone);
  });
});

describe('propagated rows still count as untouched', () => {
  // What propagation leaves behind: a real updatedAt, fields equal to the new rule.
  const next: RecurringRule = { ...oldRule, amount: 1_200_000, name: 'Renta', categoryId: 'cat-b', dayOfMonth: 25 };
  const propagated = (key: string) => occ(key, {
    amount: 1_200_000, concept: 'Renta', categoryId: 'cat-b', date: `${key}-25`, updatedAt: '2026-09-10T12:00:00Z',
  });

  it('propagate, then delete the rule -> removed; a hand-edited one stays', () => {
    const rows = [propagated('2026-10'), propagated('2026-11'), { ...propagated('2026-12'), amount: 7 }];
    expect(isUntouched(rows[0]!, next)).toBe(true);
    expect(removableOnRuleDelete(next, rows, TODAY).map((t) => t.id)).toEqual(['r1:2026-10', 'r1:2026-11']);
  });
  it('propagate, then add an end date -> propagated rows after it are removed', () => {
    const rows = [propagated('2026-10'), propagated('2026-11'), { ...propagated('2026-12'), concept: 'mio' }];
    const c = planPropagation(next, { ...next, endDate: '2026-10-31' }, rows, TODAY, noMethods);
    expect(c.map((x) => [x.id, x.kind])).toEqual([['r1:2026-11', 'remove']]);
  });
  it('a row edited by hand never counts as untouched', () => {
    expect(isUntouched({ ...propagated('2026-10'), date: '2026-10-26' }, next)).toBe(false);
  });
});
