import { describe, expect, it } from 'vitest';
import { finalCategory, methodByType } from './resolve';
import type { PaymentMethod } from '../types';

const METHOD_KEYWORDS: PaymentMethod[] = [
  { id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '' },
  { id: 'pm-tc', type: 'credit', name: 'Tarjeta de crédito', isDefault: false, updatedAt: '' },
];

describe('metodoPorTipo', () => {
  it("finds the user's real method", () => {
    expect(methodByType(METHOD_KEYWORDS, 'credit')).toBe('pm-tc');
    expect(methodByType(METHOD_KEYWORDS, 'debit')).toBe('pm-debito');
  });

  it("with no mention it picks nothing: the form's default wins", () => {
    expect(methodByType(METHOD_KEYWORDS, null)).toBeNull();
  });

  it("a type the user hasn't set up doesn't invent one", () => {
    expect(methodByType(METHOD_KEYWORDS, 'cash')).toBeNull();
  });
});

describe('categoriaFinal', () => {
  const existingRows = ['cat-alimentacion', 'cat-transporte'];

  it('what was learned beats the keyword', () => {
    expect(finalCategory('cat-transporte', 'cat-alimentacion', existingRows)).toBe('cat-transporte');
  });

  it('with nothing learned it uses the keyword', () => {
    expect(finalCategory(null, 'cat-alimentacion', existingRows)).toBe('cat-alimentacion');
  });

  it("it doesn't propose a category the user deleted", () => {
    expect(finalCategory('cat-viajes', 'cat-alimentacion', existingRows)).toBe('cat-alimentacion');
    expect(finalCategory(null, 'cat-viajes', existingRows)).toBeNull();
  });

  it('with nothing at all, it proposes nothing', () => {
    expect(finalCategory(null, null, existingRows)).toBeNull();
  });
});
