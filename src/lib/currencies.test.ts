import { describe, expect, it } from 'vitest';
import { convert, formatRate, parseRate, quickCurrencyList, suggestedRate } from './currencies';

describe('quick currencies', () => {
  it('defaults to COP · USD · EUR', () => {
    expect(quickCurrencyList('COP', undefined)).toEqual(['COP', 'USD', 'EUR']);
  });
  it('always includes the main currency, first when it was missing', () => {
    expect(quickCurrencyList('MXN', ['COP', 'USD', 'EUR'])).toEqual(['MXN', 'COP', 'USD']);
  });
  it('drops codes the app cannot format', () => {
    expect(quickCurrencyList('COP', ['COP', 'XYZ', 'USD'])).toEqual(['COP', 'USD']);
  });
});

describe('rates', () => {
  it('the main currency converts 1:1', () => {
    expect(suggestedRate('COP', 'COP')).toBe(1);
  });
  it('has a starting rate for COP, none for other main currencies', () => {
    expect(suggestedRate('USD', 'COP')).toBeGreaterThan(0);
    expect(suggestedRate('USD', 'MXN')).toBeNull();
  });
  it('converts to a whole amount', () => {
    expect(convert(20, 4000)).toBe(80_000);
    expect(convert(3, 4350.5)).toBe(13_052);
  });
  it('reads and writes rates the way the app writes numbers', () => {
    expect(formatRate(4000)).toBe('4.000');
    expect(formatRate(4350.5)).toBe('4.350,5');
    expect(parseRate('4.000')).toBe(4000);
    expect(parseRate('4350,5')).toBe(4350.5);
    expect(parseRate('0')).toBeNull();
    expect(parseRate('abc')).toBeNull();
  });
});
