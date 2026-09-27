import { describe, expect, it } from 'vitest';
import { interpretText, type UserContext } from './interpret';
import { parseUtterance } from './parse';
import { normalize, type ConceptIndexEntry } from '../inference/conceptInference';
import type { PaymentMethod } from '../types';

const TODAY = '2026-09-18';

const debit: PaymentMethod = {
  id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '',
};
const card: PaymentMethod = {
  id: 'pm-credito', type: 'credit', name: 'Tarjeta', isDefault: false,
  cutoffDay: 15, paymentDay: 5, updatedAt: '',
};

function ctx(over: Partial<UserContext> = {}): UserContext {
  return {
    conceptIndex: [],
    categoryIds: ['cat-alimentacion', 'cat-transporte', 'cat-trabajo', 'cat-hogar'],
    methodRows: [debit, card],
    defaultMethodId: 'pm-debito',
    ...over,
  };
}

/** A history entry for the concept the parser extracts from `texto`. */
function learned(text: string, categoryId: string, paymentMethodId: string | null = null): ConceptIndexEntry {
  const concept = parseUtterance(text, TODAY).concept;
  return {
    id: normalize(concept), displayName: concept, categoryId, paymentMethodId,
    count: 3, lastUsedAt: '2026-09-01T00:00:00Z',
  };
}

describe('interpretarTexto — learned history beats the keyword table', () => {
  const TEXT = 'mercado 45 mil';

  it('with no history, uses what the keywords suggest', () => {
    const r = interpretText(TEXT, TODAY, ctx());
    expect(r.parsed.amount).toBe(45_000);
    expect(r.categoryId).toBe(r.parsed.categoryIdSugerida);
    expect(r.fromLearning).toBe(false);
  });

  it('with history, the category the user corrected wins', () => {
    const r = interpretText(TEXT, TODAY, ctx({
      conceptIndex: [learned(TEXT, 'cat-trabajo')],
    }));
    expect(r.categoryId).toBe('cat-trabajo');
    expect(r.fromLearning).toBe(true);
    // And we are genuinely overriding something else, not matching by coincidence.
    expect(r.parsed.categoryIdSugerida).not.toBe('cat-trabajo');
  });

  it('a learned category that has already been deleted is not proposed', () => {
    const r = interpretText(TEXT, TODAY, ctx({
      conceptIndex: [learned(TEXT, 'cat-que-ya-no-existe')],
      categoryIds: ['cat-alimentacion'],
    }));
    expect(r.categoryId).not.toBe('cat-que-ya-no-existe');
    expect(r.fromLearning).toBe(false);
  });
});

describe('interpretarTexto — the payment method', () => {
  it('what the text says explicitly overrides what was learned', () => {
    const r = interpretText('almuerzo 20 mil con la tarjeta', TODAY, ctx({
      conceptIndex: [learned('almuerzo 20 mil con la tarjeta', 'cat-alimentacion', 'pm-debito')],
    }));
    expect(r.paymentMethodId).toBe('pm-credito');
  });

  it('with nothing explicit, uses what was learned before the usual one', () => {
    const r = interpretText('almuerzo 20 mil', TODAY, ctx({
      conceptIndex: [learned('almuerzo 20 mil', 'cat-alimentacion', 'pm-credito')],
    }));
    expect(r.paymentMethodId).toBe('pm-credito');
  });

  it('with neither text nor history, falls back to the default method', () => {
    const r = interpretText('almuerzo 20 mil', TODAY, ctx());
    expect(r.paymentMethodId).toBe('pm-debito');
  });
});
