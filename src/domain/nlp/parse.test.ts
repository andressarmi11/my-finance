import { describe, expect, it } from 'vitest';
import { parseUtterance } from './parse';

const TODAY = '2026-09-18';
const p = (t: string) => parseUtterance(t, TODAY);

describe('spoken — expenses', () => {
  it('the typical phrase', () => {
    const r = p('gasté 45 mil en el almuerzo');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(45_000);
    expect(r.concept).toBe('Almuerzo');
    expect(r.date).toBe(TODAY);
    expect(r.categoryIdSugerida).toBe('cat-alimentacion');
  });

  it('with a payment method', () => {
    const r = p('pagué 120 mil de mercado con la tarjeta');
    expect(r.amount).toBe(120_000);
    expect(r.method).toBe('credit');
    expect(r.concept).toBe('Mercado');
    expect(r.categoryIdSugerida).toBe('cat-alimentacion');
  });

  it('in cash', () => {
    expect(p('gasté 20 mil en taxi en efectivo').method).toBe('cash');
  });

  it('via Nequi', () => {
    expect(p('pagué 35 mil por nequi').method).toBe('transfer');
  });

  it('with debit', () => {
    expect(p('gasté 15000 en gasolina con la débito').method).toBe('debit');
  });

  it('amount in words', () => {
    const r = p('gasté cuarenta y cinco mil en cine');
    expect(r.amount).toBe(45_000);
    expect(r.categoryIdSugerida).toBe('cat-entretenimiento');
  });
});

describe('spoken — income', () => {
  it('recognises that money is coming in', () => {
    const r = p('me llegaron dos millones y medio de nómina');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(2_500_000);
  });

  it('"recibí" too', () => {
    expect(p('recibí 700 mil de un freelance').type).toBe('income');
  });

  it('with no verb it assumes an expense, since that is what gets logged most', () => {
    expect(p('45 mil almuerzo').type).toBe('expense');
  });
});

describe('spoken dates', () => {
  it('yesterday', () => expect(p('gasté 10 mil ayer en café').date).toBe('2026-09-17'));
  it('the day before yesterday', () => expect(p('gasté 10 mil anteayer').date).toBe('2026-09-16'));
  it('3 days ago', () => expect(p('pagué 50 mil hace 3 dias').date).toBe('2026-09-15'));
  it('"el 5" is a day of the current month', () => expect(p('pagué 50 mil el 5').date).toBe('2026-09-05'));
  it('with no date it is today', () => expect(p('gasté 10 mil en pan').date).toBe(TODAY));
  it('the date does not leak into the concept', () => {
    expect(p('gasté 10 mil ayer en café').concept.toLowerCase()).not.toContain('ayer');
  });
});

describe('bank SMS', () => {
  it('Bancolombia — purchase', () => {
    const r = p('Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(145_000);
    expect(r.concept.toLowerCase()).toContain('exito');
    expect(r.categoryIdSugerida).toBe('cat-alimentacion');
    expect(r.date).toBe('2026-09-18');
  });

  it('Nequi — payment', () => {
    const r = p('Nequi: Pagaste $12.500 a RAPPI');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(12_500);
    expect(r.concept.toLowerCase()).toContain('rappi');
  });

  it('deposit recognised as income', () => {
    const r = p('Bancolombia: Recibiste $2.800.000 por NOMINA');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(2_800_000);
  });

  it('Bancolombia purchase: merchant and T.Cred / T.Deb', () => {
    const c = p('Bancolombia: Compraste $45.900,00 en EXITO LAURELES con tu T.Cred *1234, el 20/06/2026 a las 15:05. Si tienes dudas, llamanos al 018000931987');
    expect(c).toMatchObject({ type: 'expense', amount: 45_900, concept: 'Exito laureles', method: 'credit', date: '2026-06-20' });
    const d = p('Bancolombia: Compraste $12.000,00 en RAPPI con tu T.Deb *7145, el 20/06/2026 a las 15:05.');
    expect(d).toMatchObject({ amount: 12_000, concept: 'Rappi', method: 'debit' });
  });

  it('Bancolombia QR payment and deposit (real SMS)', () => {
    const qr = p('Bancolombia: ANDRES FELIPE PALACIOS SARMIENTO pagaste $71,200.00 por codigo QR desde tu cuenta *7145 a la llave 0052549599 el 18/06/2026 a las 18:30. Con codigo QR es facil y de una. Dudas al 018000912345');
    expect(qr).toMatchObject({ type: 'expense', amount: 71_200, concept: 'Pago qr', method: 'debit', date: '2026-06-18' });
    const dep = p('Bancolombia: Recibiste una consignacion por $72,000 desde el corresponsal BARRIO VILLA HEERMOSA MEDELLIN en MEDELLIN, el 18/06/26 19:47. Si tienes dudas, llamanos: 018000931987. A tu lado siempre.');
    expect(dep).toMatchObject({ type: 'income', amount: 72_000, concept: 'Consignacion', date: '2026-06-18' });
  });

  it('spoken income: "recibí" and "vendí"', () => {
    expect(p('Recibí 45 mil')).toMatchObject({ type: 'income', amount: 45_000 });
    expect(p('Vendí la bicicleta en 500 mil')).toMatchObject({ type: 'income', amount: 500_000 });
  });

  it('the bank name does not end up as the concept', () => {
    const r = p('Bancolombia le informa Compra por $89.900 en NETFLIX');
    expect(r.concept.toLowerCase()).not.toContain('bancolombia');
    expect(r.categoryIdSugerida).toBe('cat-suscripciones');
  });

  it('the SMS date overrides today', () => {
    expect(p('Compra por $10.000 en D1 15/09/2026').date).toBe('2026-09-15');
  });
});

describe('when it is not enough', () => {
  it('with no amount it says so, does not make one up', () => {
    const r = p('gasté en el almuerzo');
    expect(r.amount).toBeNull();
    expect(r.concept).toBe('Almuerzo');
  });

  it('empty text does not blow up', () => {
    const r = p('');
    expect(r.amount).toBeNull();
    expect(r.concept).toBe('');
  });

  it('with no known word it does not suggest a category', () => {
    expect(p('gasté 10 mil en zzzz').categoryIdSugerida).toBeNull();
  });
});

describe('categories by keyword', () => {
  const testCases: Array<[string, string]> = [
    ['gasté 20 mil en uber', 'cat-transporte'],
    ['pagué 89 mil de netflix', 'cat-suscripciones'],
    ['pagué 1.800.000 de arriendo', 'cat-hogar'],
    ['pagué 120 mil de luz', 'cat-servicios'],
    ['gasté 50 mil en la droguería', 'cat-salud'],
    ['gasté 200 mil en ropa', 'cat-compras'],
    ['pagué 500 mil del curso', 'cat-educacion'],
  ];
  for (const [frase, esperada] of testCases) {
    it(frase, () => expect(p(frase).categoryIdSugerida).toBe(esperada));
  }
});

describe('SMS noise that is not the merchant', () => {
  it('the time does not leak into the concept', () => {
    // Real case: the first SMS I tested came out as "Rappi 19 40".
    const r = p('Bancolombia le informa Compra por $38.500 en RAPPI 18/09/2026 19:40');
    expect(r.concept.toLowerCase()).toBe('rappi');
    expect(r.amount).toBe(38_500);
  });

  it('nor does the time with am/pm', () => {
    expect(p('Compra por $10.000 en D1 15/09/2026 08:05 a.m.').concept.toLowerCase()).toBe('d1');
  });

  it('nor does the authorisation number', () => {
    const r = p('Davivienda: Compra aprobada por $89.900 en NETFLIX Aut 123456');
    expect(r.concept.toLowerCase()).toBe('netflix');
  });

  it('the balance the bank reports is not confused with the merchant', () => {
    const r = p('Bancolombia Compra por $45.000 en EXITO. Saldo disponible 1200000');
    expect(r.amount).toBe(45_000);
    expect(r.concept.toLowerCase()).toBe('exito');
  });
});
