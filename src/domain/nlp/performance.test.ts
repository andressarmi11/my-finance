import { describe, expect, it } from 'vitest';
import { parseUtterance } from './parse';
import { buscarMonto } from './numbers';

/**
 * Estas pruebas no miden funcionalidad, miden TIEMPO, y existen por un
 * agujero real: la expresión que limpia los números de referencia de un
 * SMS tenía repetición sin cota y alternativas con prefijo compartido
 * (ref/referencia, aut/autorizacion). Eso daba backtracking exponencial:
 * 96 caracteres tardaban 859 ms y ~150 colgaban el hilo por minutos.
 *
 * Importa porque este texto NO lo escribe solo el dueño del teléfono:
 * entra por la función pública `ingest` a la bandeja, y se interpreta al
 * abrirla. Un mensaje corto bastaba para congelar el navegador de la
 * víctima.
 */
const HOY = '2026-09-18';
const LIMITE_MS = 100;

function mide(fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

describe('resistencia a textos hostiles', () => {
  it('la limpieza de referencias no explota con repetición', () => {
    const hostil = 'ref '.repeat(120); // 480 caracteres
    expect(mide(() => parseUtterance(hostil, HOY))).toBeLessThan(LIMITE_MS);
  });

  it('aguanta el texto más largo que la bandeja acepta', () => {
    // El tope de `ingest` y de la base es 2000 caracteres.
    const hostil = 'aut:'.repeat(500);
    expect(mide(() => parseUtterance(hostil, HOY))).toBeLessThan(LIMITE_MS);
  });

  it('los números en palabras no escalan al cubo', () => {
    const hostil = 'cero '.repeat(400); // 2000 caracteres, todos numéricos
    expect(mide(() => buscarMonto(hostil))).toBeLessThan(LIMITE_MS);
  });

  it('un SMS real sigue siendo instantáneo', () => {
    const real = 'Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32 Aut 123456';
    expect(mide(() => parseUtterance(real, HOY))).toBeLessThan(LIMITE_MS);
  });
});

describe('el arreglo no cambió lo que entiende', () => {
  it('sigue limpiando el número de autorización', () => {
    expect(parseUtterance('Compra por $89.900 en NETFLIX Aut 123456', HOY).concept.toLowerCase())
      .toBe('netflix');
  });

  it('sigue limpiando "saldo disponible"', () => {
    expect(parseUtterance('Compra por $45.000 en EXITO. Saldo disponible 1200000', HOY).concept.toLowerCase())
      .toBe('exito');
  });

  it('sigue leyendo cifras largas en palabras', () => {
    expect(buscarMonto('doscientos cuarenta y cinco mil')?.valor).toBe(245_000);
  });
});
