import { describe, expect, it } from 'vitest';
import { calcularPeriodo, esMensual, normalizar, periodosDelMes, rangoDeClave } from './periodo';
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';

/**
 * El algoritmo de quincenas TAL COMO ERA antes de generalizarlo, copiado
 * aquí a propósito.
 *
 * Es la referencia contra la que se compara: si vive en el test y nadie lo
 * puede "arreglar" sin darse cuenta, entonces comparar contra él significa
 * algo. Importarlo del código de producción habría hecho que cualquier
 * cambio futuro moviera las dos cosas a la vez y el test dejara de proteger
 * nada.
 */
function calculateQuincena(date: string, startDays: [number, number]) {
  const [a, b] = startDays[0] < startDays[1] ? startDays : [startDays[1], startDays[0]];
  const { y, m, d } = parseISO(date);
  const aThis = clampDay(y, m, a);
  const bThis = clampDay(y, m, b);
  const key = (yy: number, mm: number, n: 1 | 2) =>
    `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-Q${n}`;

  if (d < aThis) {
    const prev = shiftMonth(y, m, -1);
    const bPrev = clampDay(prev.y, prev.m, b);
    return {
      key: key(prev.y, prev.m, 2),
      start: toISO({ ...prev, d: bPrev }),
      end: toISO(addDays({ y, m, d: aThis }, -1)),
    };
  }
  if (d < bThis) {
    return {
      key: key(y, m, 1),
      start: toISO({ y, m, d: aThis }),
      end: toISO(addDays({ y, m, d: bThis }, -1)),
    };
  }
  const next = shiftMonth(y, m, 1);
  const aNext = clampDay(next.y, next.m, a);
  return {
    key: key(y, m, 2),
    start: toISO({ y, m, d: bThis }),
    end: toISO(addDays({ ...next, d: aNext }, -1)),
  };
}

/** Todos los días entre dos fechas, para barrer un año entero. */
function dias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  let d = parseISO(desde);
  const fin = parseISO(hasta);
  while (toISO(d) <= toISO(fin)) {
    salida.push(toISO(d));
    d = addDays(d, 1);
  }
  return salida;
}

/**
 * Lo primero y lo más importante: generalizar no puede cambiarle nada a
 * quien ya usa la app. Si con dos días de pago el resultado difiere del
 * cálculo viejo aunque sea un día, los movimientos se reagruparían solos.
 */
describe('con dos días de pago da EXACTAMENTE lo mismo que antes', () => {
  for (const pago of [[10, 25], [1, 16], [5, 20], [15, 30]] as Array<[number, number]>) {
    it(`días ${pago[0]} y ${pago[1]}: un año entero, día por día`, () => {
      for (const fecha of dias('2026-01-01', '2026-12-31')) {
        const viejo = calculateQuincena(fecha, pago);
        const nuevo = calcularPeriodo(fecha, pago);
        expect({ key: nuevo.key, start: nuevo.start, end: nuevo.end }, `difieren el ${fecha}`)
          .toEqual({ key: viejo.key, start: viejo.start, end: viejo.end });
      }
    });
  }

  it('también en febrero de un año bisiesto, que es donde se rompen los bordes', () => {
    for (const fecha of dias('2024-02-01', '2024-03-05')) {
      expect(calcularPeriodo(fecha, [15, 31]).key).toBe(calculateQuincena(fecha, [15, 31]).key);
    }
  });
});

describe('mensual — un solo día de pago', () => {
  it('con el día 1 es el mes calendario', () => {
    const p = calcularPeriodo('2026-09-20', [1]);
    expect(p).toEqual({ key: '2026-09-Q1', start: '2026-09-01', end: '2026-09-30', indice: 1 });
  });

  it('el último día del mes sigue siendo del mismo periodo', () => {
    expect(calcularPeriodo('2026-09-30', [1]).key).toBe('2026-09-Q1');
    expect(calcularPeriodo('2026-10-01', [1]).key).toBe('2026-10-Q1');
  });

  /**
   * El caso de quien cobra a fin de mes: su "mes" va del día de pago al
   * anterior al siguiente pago, igual que la quincena del 25 cruzaba.
   */
  it('con el día 30, el periodo cruza el cambio de mes', () => {
    const p = calcularPeriodo('2026-10-05', [30]);
    expect(p).toEqual({ key: '2026-09-Q1', start: '2026-09-30', end: '2026-10-29', indice: 1 });
  });

  it('el día del pago abre periodo nuevo', () => {
    expect(calcularPeriodo('2026-10-29', [30]).key).toBe('2026-09-Q1');
    expect(calcularPeriodo('2026-10-30', [30]).key).toBe('2026-10-Q1');
  });

  it('el día 31 se ajusta en los meses que no lo tienen', () => {
    // Febrero de 2026 no tiene 31: el pago cae el 28.
    const p = calcularPeriodo('2026-03-01', [31]);
    expect(p.start).toBe('2026-02-28');
    expect(p.key).toBe('2026-02-Q1');
  });

  it('nunca hay un Q2 si solo hay un día de pago', () => {
    for (const fecha of dias('2026-01-01', '2026-12-31')) {
      expect(calcularPeriodo(fecha, [15]).key.endsWith('Q1')).toBe(true);
    }
  });
});

describe('esMensual', () => {
  it('distingue por cuántos días de pago hay', () => {
    expect(esMensual([1])).toBe(true);
    expect(esMensual([30])).toBe(true);
    expect(esMensual([10, 25])).toBe(false);
  });

  it('un día repetido es un solo día de pago', () => {
    expect(esMensual([15, 15])).toBe(true);
  });
});

describe('normalizar', () => {
  it('ordena, quita repetidos y descarta lo imposible', () => {
    expect(normalizar([25, 10])).toEqual([10, 25]);
    expect(normalizar([10, 10, 25])).toEqual([10, 25]);
    expect(normalizar([0, 10, 32, 25])).toEqual([10, 25]);
    expect(normalizar([5.5, 10])).toEqual([10]);
  });

  it('una lista vacía cae en el valor por defecto en vez de reventar', () => {
    // Sin esto, calcular un periodo con [] daría un índice fuera de rango.
    expect(normalizar([])).toEqual([10, 25]);
    expect(normalizar([0, 99])).toEqual([10, 25]);
  });
});

describe('rangoDeClave', () => {
  it('reconstruye el rango sin tener una transacción en la mano', () => {
    expect(rangoDeClave('2026-09-Q2', [10, 25])).toEqual(calcularPeriodo('2026-09-25', [10, 25]));
    expect(rangoDeClave('2026-09-Q1', [1])).toEqual(calcularPeriodo('2026-09-01', [1]));
  });

  /**
   * Alguien que venía usando quincenas y se pasa a mensual tiene claves Q2
   * guardadas. La pantalla no puede reventar por eso.
   */
  it('una clave Q2 vieja no rompe a quien ahora cobra una vez al mes', () => {
    expect(() => rangoDeClave('2026-09-Q2', [1])).not.toThrow();
    expect(rangoDeClave('2026-09-Q2', [1]).key).toBe('2026-09-Q1');
  });

  it('una clave con basura sí falla, y lo dice', () => {
    expect(() => rangoDeClave('septiembre', [10, 25])).toThrow(/Clave de periodo invalida/);
  });
});

describe('periodosDelMes', () => {
  it('devuelve tantas claves como días de pago', () => {
    expect(periodosDelMes(2026, 9, [10, 25])).toEqual(['2026-09-Q1', '2026-09-Q2']);
    expect(periodosDelMes(2026, 9, [1])).toEqual(['2026-09-Q1']);
  });
});

/**
 * Ninguna fecha puede quedarse sin periodo ni caer en dos. Es la propiedad
 * que sostiene todos los totales de la app: si un día se contara dos veces,
 * los saldos mentirían.
 */
describe('cobertura: cada día cae en exactamente un periodo', () => {
  for (const pago of [[10, 25], [1], [30], [1, 16], [5, 15, 25]]) {
    it(`días de pago ${JSON.stringify(pago)}`, () => {
      for (const fecha of dias('2026-01-01', '2026-12-31')) {
        const p = calcularPeriodo(fecha, pago);
        expect(p.start <= fecha, `${fecha} cae antes de su periodo ${p.key}`).toBe(true);
        expect(fecha <= p.end, `${fecha} cae después de su periodo ${p.key}`).toBe(true);
      }
    });
  }
});
