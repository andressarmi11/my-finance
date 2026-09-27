import { describe, expect, it } from 'vitest';
import { findAmount } from './numbers';

const v = (t: string) => findAmount(t)?.value ?? null;

describe('buscarMonto — digits', () => {
  it('plain number', () => expect(v('45000')).toBe(45_000));
  it('with Colombian thousands dot', () => expect(v('45.000')).toBe(45_000));
  it('with peso sign', () => expect(v('$ 45.000')).toBe(45_000));
  it('millions with thousands dot', () => expect(v('2.800.000')).toBe(2_800_000));
  it('comma as thousands separator', () => expect(v('45,000')).toBe(45_000));
});

describe('buscarMonto — scales', () => {
  it('"45 mil"', () => expect(v('45 mil')).toBe(45_000));
  it('"45mil" stuck together', () => expect(v('45mil')).toBe(45_000));
  it('"45k"', () => expect(v('45k')).toBe(45_000));
  it('"45 lucas"', () => expect(v('45 lucas')).toBe(45_000));
  it('"1.2 millones" uses the dot as decimal', () => expect(v('1.2 millones')).toBe(1_200_000));
  it('"2 millones"', () => expect(v('2 millones')).toBe(2_000_000));
  it('"dos palos"', () => expect(v('dos palos')).toBe(2_000_000));
});

describe('buscarMonto — in words', () => {
  it('"cuarenta y cinco mil"', () => expect(v('cuarenta y cinco mil')).toBe(45_000));
  it('"veinte mil"', () => expect(v('veinte mil')).toBe(20_000));
  it('"un millon"', () => expect(v('un millon')).toBe(1_000_000));
  it('"dos millones y medio"', () => expect(v('dos millones y medio')).toBe(2_500_000));
  it('"ciento veinte mil"', () => expect(v('ciento veinte mil')).toBe(120_000));
  it('"mil" alone is worth a thousand', () => expect(v('mil')).toBe(1_000));
  it('"quinientos mil"', () => expect(v('quinientos mil')).toBe(500_000));
  it('with accents', () => expect(v('un millón')).toBe(1_000_000));
});

describe('buscarMonto — inside a sentence', () => {
  it('extracts the amount from a spoken sentence', () => {
    expect(v('gasté 45 mil en el almuerzo')).toBe(45_000);
    expect(v('me llegaron dos millones y medio de nómina')).toBe(2_500_000);
  });

  it('extracts the amount from a bank SMS', () => {
    expect(v('Bancolombia le informa Compra por $145.000 en EXITO')).toBe(145_000);
    expect(v('Nequi: Pagaste $12.500 a RAPPI')).toBe(12_500);
  });
});

describe('findAmount — no amount', () => {
  it('returns null', () => {
    expect(v('hola')).toBeNull();
    expect(v('')).toBeNull();
    expect(v('gasté en el almuerzo')).toBeNull();
  });
});
