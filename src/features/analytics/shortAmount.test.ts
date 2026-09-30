import { describe, expect, it } from 'vitest';
import { shortAmount } from './shortAmount';

describe('shortAmount', () => {
  it('abbreviates thousands and millions', () => {
    expect(shortAmount(704_000)).toBe('704K');
    expect(shortAmount(1_250_000)).toBe('1,3M');
    expect(shortAmount(8_300_000)).toBe('8,3M');
    expect(shortAmount(12_400_000)).toBe('12M');
  });
  it('leaves small amounts and zero as they are', () => {
    expect(shortAmount(950)).toBe('950');
    expect(shortAmount(0)).toBe('0');
  });
  it('keeps the sign', () => {
    expect(shortAmount(-45_000)).toBe('−45K');
  });
});
