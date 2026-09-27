import { describe, expect, it } from 'vitest';
import { describeParsed, describeDate } from './describe';
import { parseUtterance } from './parse';
import type { Category, PaymentMethod } from '../types';

const TODAY = '2026-09-18';
const CATS: Category[] = [
  { id: 'cat-alimentacion', name: 'Alimentación', icon: '🍽️', color: '#E0A23B', kind: 'expense', isArchived: false, sortOrder: 0, updatedAt: '' },
];
const METS: PaymentMethod[] = [
  { id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '' },
];

describe('describirFecha', () => {
  it('uses words, not dates, for anything close by', () => {
    expect(describeDate('2026-09-18', TODAY)).toBe('hoy');
    expect(describeDate('2026-09-17', TODAY)).toBe('ayer');
    expect(describeDate('2026-09-16', TODAY)).toBe('anteayer');
    expect(describeDate('2026-09-19', TODAY)).toBe('mañana');
  });

  it('states the date for anything far off', () => {
    expect(describeDate('2026-09-05', TODAY)).toBe('el 5 de septiembre');
  });
});

describe('describir', () => {
  const ctx = {
    today: TODAY, cats: CATS, methodRows: METS,
    categoryId: 'cat-alimentacion' as string | null,
    paymentMethodId: 'pm-debito' as string | null,
    learned: false,
  };

  it('summarises what is going to be saved', () => {
    const d = describeParsed(parseUtterance('gasté 45 mil en el almuerzo', TODAY), ctx);
    expect(d.summary).toBe('Gasto de $ 45.000, en Almuerzo, hoy, con Débito.');
    expect(d.missing).toBeNull();
  });

  it('says what is missing instead of making it up', () => {
    const d = describeParsed(parseUtterance('gasté en el almuerzo', TODAY), ctx);
    expect(d.missing).toBe('¿Cuánto fue?');
  });

  it('flags it when it repeats what it learned', () => {
    const d = describeParsed(parseUtterance('gasté 45 mil en almuerzo', TODAY), { ...ctx, learned: true });
    expect(d.note).toBe('Lo puse en Alimentación, como la última vez.');
  });

  it('when it does not know the category, it says so and asks for help', () => {
    const d = describeParsed(parseUtterance('gasté 10 mil en zzzz', TODAY), { ...ctx, categoryId: null });
    expect(d.note).toContain('No le encontré categoría');
  });

  it('an income is described as an income', () => {
    const d = describeParsed(parseUtterance('me llegaron 2 millones de nómina', TODAY), { ...ctx, categoryId: null, paymentMethodId: null });
    expect(d.summary).toContain('Ingreso de $ 2.000.000');
  });
});
