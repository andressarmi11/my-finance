import { describe, expect, it } from 'vitest';
import {
  budgetFromRow, budgetToRow, categoryFromRow, categoryToRow,
  paymentMethodFromRow, paymentMethodToRow, recurringRuleFromRow, recurringRuleToRow,
  reminderFromRow, reminderToRow, settingsFromRow, settingsToRow,
  transactionFromRow, transactionToRow,
} from './mappers';
import type {
  Budget, Category, PaymentMethod, RecurringRule, Reminder, Settings, Transaction,
} from '@/domain/types';

const USER = 'user-123';

describe('settings round-trip', () => {
  it('row -> domain -> row keeps everything', () => {
    const settings: Settings = {
      id: 'singleton', displayName: 'Andrés', onboardedAt: '2026-09-18T10:00:00.000Z',
      currency: 'COP', locale: 'es-CO', payDays: [10, 25],
      defaultPaymentMethodId: 'pm-1', reminderDefaultDaysBefore: 2, theme: 'dark',
      updatedAt: '2026-09-18T12:00:00.000Z',
    };
    const row = settingsToRow(USER, settings);
    expect(settingsFromRow(row)).toEqual(settings);
  });
});

describe('category round-trip', () => {
  it('keeps icon, color and kind', () => {
    const category: Category = {
      id: 'c1', name: 'Hogar', icon: '🏠', color: '#5B6FE0', kind: 'both', isArchived: false, sortOrder: 3, updatedAt: '2026-09-18T12:00:00.000Z',
    };
    expect(categoryFromRow(categoryToRow(USER, category))).toEqual(category);
  });
});

describe('paymentMethod round-trip', () => {
  it('keeps cutoffDay/paymentDay, even when absent', () => {
    const debit: PaymentMethod = { id: 'pm-1', type: 'debit', name: 'Débito', isDefault: true, updatedAt: 'T' };
    expect(paymentMethodFromRow(paymentMethodToRow(USER, debit))).toEqual(debit);

    const credit: PaymentMethod = { id: 'pm-2', type: 'credit', name: 'TC', isDefault: false, cutoffDay: 15, paymentDay: 2, updatedAt: 'T' };
    expect(paymentMethodFromRow(paymentMethodToRow(USER, credit))).toEqual(credit);
  });
});

describe('transaction round-trip', () => {
  it('keeps all fields, including the optional credit-card and recurrence ones', () => {
    const tx: Transaction = {
      id: 't1', type: 'expense', concept: 'Cine', amount: 38_000, date: '2026-09-17',
      categoryId: 'cat-entretenimiento', paymentMethodId: 'pm-tc', status: 'pending', notes: 'con Ana',
      cycleCutoffDate: '2026-09-15', cyclePaymentDate: '2026-10-02', quincenaKey: null,
      recurringRuleId: 'r1', periodKey: '2026-09', createdAt: '2026-09-17T10:00:00Z', updatedAt: '2026-09-17T10:00:00Z',
    };
    expect(transactionFromRow(transactionToRow(USER, tx))).toEqual(tx);
  });

  it('keeps a minimal transaction (no optional fields)', () => {
    const tx: Transaction = {
      id: 't2', type: 'income', concept: 'Salario', amount: 3_000_000, date: '2026-09-10',
      categoryId: null, paymentMethodId: null, status: 'paid', quincenaKey: 'manual-key',
      createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z',
    };
    expect(transactionFromRow(transactionToRow(USER, tx))).toEqual(tx);
  });
});

describe('recurringRule round-trip', () => {
  it('keeps the full rule', () => {
    const rule: RecurringRule = {
      id: 'r1', name: 'Arriendo', type: 'expense', amount: 2_500_000, categoryId: 'cat-hogar',
      paymentMethodId: 'pm-debito', frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01',
      endDate: '2026-12-31', isActive: true, updatedAt: '2026-09-18T12:00:00.000Z',
    };
    expect(recurringRuleFromRow(recurringRuleToRow(USER, rule))).toEqual(rule);
  });

  it('round-trips custom patterns (interval and months)', () => {
    const base: RecurringRule = {
      id: 'r2', name: 'Seguro', type: 'expense', amount: 90_000, categoryId: null,
      paymentMethodId: null, frequency: 'custom', dayOfMonth: 5, startDate: '2026-01-01',
      isActive: true, updatedAt: '2026-09-18T12:00:00.000Z',
    };
    const interval = { ...base, interval: { every: 3, unit: 'weeks' as const } };
    const months = { ...base, months: [1, 7] };
    expect(recurringRuleFromRow(recurringRuleToRow(USER, interval))).toEqual(interval);
    expect(recurringRuleFromRow(recurringRuleToRow(USER, months))).toEqual(months);
    expect(recurringRuleToRow(USER, months)).toMatchObject({ interval_every: null, interval_unit: null, months: [1, 7] });
  });
});

describe('recurringRule from a hostile row', () => {
  it('drops out-of-range patterns', () => {
    const row = recurringRuleToRow(USER, {
      id: 'r3', name: 'x', type: 'expense', amount: 1, categoryId: null, paymentMethodId: null,
      frequency: 'custom', startDate: '2026-01-01', isActive: true, updatedAt: '',
    });
    const bad = recurringRuleFromRow({ ...row, interval_every: 0, interval_unit: 'weeks', months: [0, 13] });
    expect(bad.interval).toBeUndefined();
    expect(bad.months).toBeUndefined();
    expect(recurringRuleFromRow({ ...row, months: [7, 3, 7] }).months).toEqual([3, 7]);
  });
});

describe('budget round-trip', () => {
  it('keeps year, month, amount and the modification date', () => {
    const budget: Budget = {
      id: 'b1', categoryId: 'cat-hogar', year: 2026, month: 9, amount: 3_000_000,
      updatedAt: '2026-09-18T10:00:00.000Z',
    };
    expect(budgetFromRow(budgetToRow(USER, budget))).toEqual(budget);
  });

  it('a row with no date gets stamped on upload, so it never loses by default', () => {
    const budget: Budget = {
      id: 'b1', categoryId: 'cat-hogar', year: 2026, month: 9, amount: 3_000_000, updatedAt: '',
    };
    expect(budgetToRow(USER, budget).updated_at).not.toBe('');
  });
});

describe('reminder round-trip', () => {
  it('keeps the status and optional sentAt', () => {
    const reminder: Reminder = {
      id: 'rem1', transactionId: 't1', remindAt: '2026-09-16T09:00:00Z', status: 'scheduled',
      updatedAt: '2026-09-15T08:00:00.000Z',
    };
    expect(reminderFromRow(reminderToRow(USER, reminder))).toEqual(reminder);
  });
});
