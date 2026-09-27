import { describe, expect, it } from 'vitest';
import { calcularPeriodo, periodoKey, rangoDeClave } from './periodo';

describe('calcularPeriodo — default (10 y 25)', () => {
  it('el dia 10 es el primero de la quincena del 10', () => {
    const r = calcularPeriodo('2026-09-10');
    expect(r).toMatchObject({ key: '2026-09-Q1', start: '2026-09-10', end: '2026-09-24' });
  });

  it('el dia 24 sigue en la quincena del 10', () => {
    expect(calcularPeriodo('2026-09-24').key).toBe('2026-09-Q1');
  });

  it('el dia 25 es el primero de la quincena del 25', () => {
    const r = calcularPeriodo('2026-09-25');
    expect(r.key).toBe('2026-09-Q2');
    expect(r.start).toBe('2026-09-25');
  });

  it('la quincena del 25 termina el 9 del mes siguiente', () => {
    expect(calcularPeriodo('2026-09-25').end).toBe('2026-10-09');
  });

  it('el 1 de octubre todavia es la quincena del 25 de septiembre (caso "Arriendo")', () => {
    const r = calcularPeriodo('2026-10-01');
    expect(r.key).toBe('2026-09-Q2');
    expect(r.start).toBe('2026-09-25');
    expect(r.end).toBe('2026-10-09');
  });

  it('el 9 de octubre es el ultimo dia de esa misma quincena', () => {
    expect(calcularPeriodo('2026-10-09').key).toBe('2026-09-Q2');
  });

  it('el 10 de octubre ya es una quincena nueva', () => {
    const r = calcularPeriodo('2026-10-10');
    expect(r.key).toBe('2026-10-Q1');
    expect(r.start).toBe('2026-10-10');
  });
});

describe('calcularPeriodo — cruce de año', () => {
  it('el 1 de enero cae en la quincena del 25 de diciembre del año anterior', () => {
    const r = calcularPeriodo('2027-01-01');
    expect(r.key).toBe('2026-12-Q2');
    expect(r.start).toBe('2026-12-25');
    expect(r.end).toBe('2027-01-09');
  });
});

describe('calcularPeriodo — configuracion genérica, no hardcodeada a 10/25', () => {
  it('acepta quincenas clasicas 1-15 / 16-fin', () => {
    expect(calcularPeriodo('2026-09-01', [1, 16]).key).toBe('2026-09-Q1');
    expect(calcularPeriodo('2026-09-15', [1, 16]).key).toBe('2026-09-Q1');
    expect(calcularPeriodo('2026-09-16', [1, 16]).key).toBe('2026-09-Q2');
    // con a=1, la Q2 no cruza de mes: termina el ultimo dia del mismo mes
    expect(calcularPeriodo('2026-09-16', [1, 16]).end).toBe('2026-09-30');
  });

  it('no le importa el orden en que se pasan los dias', () => {
    expect(calcularPeriodo('2026-09-10', [25, 10])).toEqual(calcularPeriodo('2026-09-10', [10, 25]));
  });

  it('clampea si el segundo dia no existe en un mes corto', () => {
    // startDays=[10,30]: en febrero (28 dias) el "30" se clampea a 28
    const r = calcularPeriodo('2026-02-28', [10, 30]);
    expect(r.key).toBe('2026-02-Q2');
  });
});

describe('periodoKey', () => {
  it('genera la llave con padding correcto', () => {
    expect(periodoKey(2026, 9, 1)).toBe('2026-09-Q1');
    expect(periodoKey(2026, 1, 2)).toBe('2026-01-Q2');
  });
});

describe('rangoDeClave', () => {
  it('reconstruye el rango de la quincena del 10 desde su llave', () => {
    expect(rangoDeClave('2026-09-Q1')).toMatchObject({
      key: '2026-09-Q1', start: '2026-09-10', end: '2026-09-24',
    });
  });

  it('reconstruye el rango de la quincena del 25, cruzando de mes', () => {
    expect(rangoDeClave('2026-09-Q2')).toMatchObject({
      key: '2026-09-Q2', start: '2026-09-25', end: '2026-10-09',
    });
  });

  it('rechaza una llave con formato invalido', () => {
    expect(() => rangoDeClave('no-valida')).toThrow();
  });
});
