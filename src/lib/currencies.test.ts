import { describe, expect, it } from 'vitest';
import { convert, formatRate, quickCurrencyList } from './currencies';

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
  it('converts to a whole amount', () => {
    expect(convert(20, 4000)).toBe(80_000);
    expect(convert(3, 4350.5)).toBe(13_052);
  });
  it('writes rates the way the app writes numbers, 2 decimals max', () => {
    expect(formatRate(4000)).toBe('4.000');
    expect(formatRate(4350.5)).toBe('4.350,5');
    expect(formatRate(4016.0643)).toBe('4.016,06');
  });
});
