import { describe, expect, it } from 'vitest';
import { parseUtterance } from './parse';
import { findAmount } from './numbers';

/**
 * These tests don't measure behaviour, they measure TIME, and they exist
 * because of a real hole: the expression that strips reference numbers out
 * of an SMS had unbounded repetition and alternatives sharing a prefix
 * (ref/referencia, aut/autorizacion). That gave exponential backtracking:
 * 96 characters took 859 ms and ~150 hung the thread for minutes.
 *
 * It matters because this text is NOT written only by the phone's owner: it
 * comes in through the public `ingest` function into the inbox, and gets
 * interpreted when the inbox is opened. A short message was enough to
 * freeze the victim's browser.
 */
const TODAY = '2026-09-18';
const LIMIT_MS = 100;

function measure(fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

describe('resistencia a textos hostiles', () => {
  it("stripping references doesn't blow up on repetition", () => {
    const hostile = 'ref '.repeat(120); // 480 caracteres
    expect(measure(() => parseUtterance(hostile, TODAY))).toBeLessThan(LIMIT_MS);
  });

  it('handles the longest text the inbox accepts', () => {
    // The cap in `ingest` and in the database is 2000 characters.
    const hostile = 'aut:'.repeat(500);
    expect(measure(() => parseUtterance(hostile, TODAY))).toBeLessThan(LIMIT_MS);
  });

  it("spelled-out numbers don't scale cubically", () => {
    const hostile = 'cero '.repeat(400); // 2000 caracteres, todos numéricos
    expect(measure(() => findAmount(hostile))).toBeLessThan(LIMIT_MS);
  });

  it('a real SMS is still instant', () => {
    const real = 'Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32 Aut 123456';
    expect(measure(() => parseUtterance(real, TODAY))).toBeLessThan(LIMIT_MS);
  });
});

describe("the fix didn't change what it understands", () => {
  it('it still strips the authorization number', () => {
    expect(parseUtterance('Compra por $89.900 en NETFLIX Aut 123456', TODAY).concept.toLowerCase())
      .toBe('netflix');
  });

  it('sigue limpiando "saldo disponible"', () => {
    expect(parseUtterance('Compra por $45.000 en EXITO. Saldo disponible 1200000', TODAY).concept.toLowerCase())
      .toBe('exito');
  });

  it('sigue leyendo cifras largas en palabras', () => {
    expect(findAmount('doscientos cuarenta y cinco mil')?.value).toBe(245_000);
  });
});
