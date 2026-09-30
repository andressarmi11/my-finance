import { describe, expect, it } from 'vitest';
import { cleanMerchant, moneyAfterDollar } from './bankSms';
import { parseUtterance } from './parse';

const TODAY = '2026-09-30';
const p = (s: string) => parseUtterance(s, TODAY);

/** Real Bancolombia messages (the user's own, amounts and names as they came). */
describe('bank SMS, as they really come', () => {
  it('a transfer received: the amount after "$", not "una" (was $1)', () => {
    const r = p('Bancolombia: Andrés, recibiste una transferencia de SANDRA MILENA PALACIOS SARMIENTO por $300,000.00 en tu cuenta *7145 conectada a la llave 0052549599');
    expect(r).toMatchObject({ type: 'income', amount: 300_000, concept: 'Sandra Milena Palacios Sarmiento' });
  });

  it('a transfer received, the other template', () => {
    const r = p('Bancolombia: Recibiste una transferencia por $37,500 de BRYAN VELEZ en tu cuenta **7145, el 23/06/2026 a las 11:36. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.');
    expect(r).toMatchObject({ type: 'income', amount: 37_500, concept: 'Bryan Velez', date: '2026-06-23' });
  });

  it('a purchase with a processor prefix: the merchant, not "Compraste"', () => {
    const rappi = p('Bancolombia: Compraste $17.686,00 en RAPPI COLOMBIA*DL con tu T.Deb *9838, el 20/06/2026 a las 15:02. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.');
    expect(rappi).toMatchObject({ type: 'expense', amount: 17_686, concept: 'Rappi Colombia', method: 'debit', date: '2026-06-20' });
    const didi = p('Bancolombia: Compraste $21.300,00 en DLO*Didi con tu T.Deb *9838, el 21/06/2026 a las 03:13. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.');
    expect(didi).toMatchObject({ type: 'expense', amount: 21_300, concept: 'Didi' });
  });

  it('a QR payment and a deposit at a corresponsal', () => {
    const qr = p('Bancolombia: ANDRES FELIPE PALACIOS SARMIENTO pagaste $71,200.00 por codigo QR desde tu cuenta *7145 a la llave 0052549599 el 18/06/2026 a las 18:30. Con codigo QR es facil y de una. Dudas al 018000912345');
    expect(qr).toMatchObject({ type: 'expense', amount: 71_200, concept: 'Pago QR' });
    const dep = p('Bancolombia: Recibiste una consignacion por $72,000 desde el corresponsal BARRIO VILLA HEERMOSA MEDELLIN en MEDELLIN, el 18/06/26 19:47.');
    expect(dep).toMatchObject({ type: 'income', amount: 72_000, concept: 'Consignación' });
  });

  it('money sent to someone', () => {
    const r = p('Bancolombia: Enviaste $50.000 a JUAN PEREZ desde tu cuenta *7145 el 10/09/2026.');
    expect(r).toMatchObject({ type: 'expense', amount: 50_000, concept: 'Juan Perez' });
  });

  it('shorter or reordered messages still work', () => {
    expect(p('Compraste $4.860 en Didi')).toMatchObject({ type: 'expense', amount: 4_860, concept: 'Didi' });
    expect(p('Recibiste $1.200.000 de Nomina Empresa SAS')).toMatchObject({ type: 'income', amount: 1_200_000 });
    expect(p('Bancolombia: recibiste una transferencia sin monto de SANDRA')).toMatchObject({ amount: null });
  });
});

describe('moneyAfterDollar', () => {
  it('reads Colombian and US-style figures, dropping cents', () => {
    expect(moneyAfterDollar('300,000.00')).toBe(300_000);
    expect(moneyAfterDollar('17.686,00')).toBe(17_686);
    expect(moneyAfterDollar('4.860')).toBe(4_860);
    expect(moneyAfterDollar('72,000')).toBe(72_000);
    expect(moneyAfterDollar('1.200.000')).toBe(1_200_000);
    expect(moneyAfterDollar('45')).toBe(45);
  });
});

describe('cleanMerchant', () => {
  it('drops processor prefixes and web suffixes, title-cases', () => {
    expect(cleanMerchant('rappi colombia*dl')).toBe('Rappi Colombia');
    expect(cleanMerchant('dlo*didi')).toBe('Didi');
    expect(cleanMerchant('uber *trip help.uber.com')).toBe('Uber');
    expect(cleanMerchant('netflix.com')).toBe('Netflix');
  });
});
