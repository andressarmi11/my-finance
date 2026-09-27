import { describe, expect, it } from 'vitest';
import { formatCompact, formatMoney, parseMoney } from './format';

describe('formatMoney', () => {
  it('uses Colombian format with a dot as thousands separator', () => {
    expect(formatMoney(2_500_000)).toBe('$ 2.500.000');
  });

  it('shows no decimals', () => {
    expect(formatMoney(9_900)).toBe('$ 9.900');
    expect(formatMoney(175_094)).toBe('$ 175.094');
  });

  it('handles zero and negatives', () => {
    expect(formatMoney(0)).toBe('$ 0');
    expect(formatMoney(-48_000)).toBe('-$ 48.000');
  });
});

describe('parseMoney', () => {
  it('accepts what the user actually types', () => {
    expect(parseMoney('85000')).toBe(85_000);
    expect(parseMoney('85.000')).toBe(85_000);
    expect(parseMoney('$ 85.000')).toBe(85_000);
    expect(parseMoney('1.500.000')).toBe(1_500_000);
  });

  it('returns null when there is no number', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('formatCompact', () => {
  it('abbreviates millions and thousands', () => {
    expect(formatCompact(2_500_000)).toBe('$ 2,5 M');
    expect(formatCompact(85_000)).toBe('$ 85 k');
  });
});

describe('setMoneyLocale', () => {
  it('changes the currency for all formats without touching call sites', async () => {
    const { setMoneyLocale, currencySymbol } = await import('./format');
    try {
      setMoneyLocale('en-US', 'USD');
      expect(formatMoney(2500)).toBe('$2,500');
      expect(currencySymbol()).toBe('$');

      setMoneyLocale('es-ES', 'EUR');
      expect(formatMoney(2500)).toContain('€');
      expect(currencySymbol()).toBe('€');
      expect(formatCompact(2_500_000)).toBe('€ 2,5 M');
    } finally {
      // Other tests assume COP: leave the module as it was.
      setMoneyLocale('es-CO', 'COP');
    }
  });

  it('goes back to Colombian on restore', () => {
    expect(formatMoney(2_500_000)).toBe('$ 2.500.000');
  });
});

/**
 * The same table lives in mobile/lib/domain/money/format.dart and its
 * test asserts exactly these values. If one changes, the other should fail.
 */
describe('parity with the native app', () => {
  const CASES: Array<[string, string, number, string]> = [
    ['es-CO', 'COP', 2_500_000, '$ 2.500.000'],
    ['es-MX', 'MXN', 2_500, '$2,500'],
    ['es-AR', 'ARS', 2_500, '$ 2.500'],
    ['es-CL', 'CLP', 2_500, '$2.500'],
    ['es-PE', 'PEN', 2_500, 'S/ 2,500'],
    ['en-US', 'USD', 2_500, '$2,500'],
    ['es-ES', 'EUR', 2_500, '2.500 €'],
  ];

  it('writes each currency the same as Flutter', async () => {
    const { setMoneyLocale } = await import('./format');
    try {
      for (const [locale, currency, amount, expected] of CASES) {
        setMoneyLocale(locale, currency);
        expect(formatMoney(amount)).toBe(expected);
      }
    } finally {
      setMoneyLocale('es-CO', 'COP');
    }
  });
});
