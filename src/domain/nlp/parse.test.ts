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
    expect(c).toMatchObject({ type: 'expense', amount: 45_900, concept: 'Exito Laureles', method: 'credit', date: '2026-06-20' });
    const d = p('Bancolombia: Compraste $12.000,00 en RAPPI con tu T.Deb *7145, el 20/06/2026 a las 15:05.');
    expect(d).toMatchObject({ amount: 12_000, concept: 'Rappi', method: 'debit' });
  });

  it('Bancolombia QR payment and deposit (real SMS)', () => {
    const qr = p('Bancolombia: ANDRES FELIPE PALACIOS SARMIENTO pagaste $71,200.00 por codigo QR desde tu cuenta *7145 a la llave 0052549599 el 18/06/2026 a las 18:30. Con codigo QR es facil y de una. Dudas al 018000912345');
    expect(qr).toMatchObject({ type: 'expense', amount: 71_200, concept: 'Pago QR', method: 'debit', date: '2026-06-18' });
    const dep = p('Bancolombia: Recibiste una consignacion por $72,000 desde el corresponsal BARRIO VILLA HEERMOSA MEDELLIN en MEDELLIN, el 18/06/26 19:47. Si tienes dudas, llamanos: 018000931987. A tu lado siempre.');
    expect(dep).toMatchObject({ type: 'income', amount: 72_000, concept: 'Consignación', date: '2026-06-18' });
  });

  it('spoken income: "recibí" and "vendí"', () => {
    expect(p('Recibí 45 mil')).toMatchObject({ type: 'income', amount: 45_000, concept: 'Ingreso' });
    expect(p('Recibí 400,000')).toMatchObject({ type: 'income', amount: 400_000, concept: 'Ingreso' });
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

describe('scheduled — future verbs and dates (today = 2026-09-29)', () => {
  const f = (t: string) => parseUtterance(t, '2026-09-29');

  it('"Pagaré 200 mil el 15 de noviembre"', () => {
    const r = f('Pagaré 200 mil el 15 de noviembre');
    expect(r).toMatchObject({ type: 'expense', amount: 200_000, date: '2026-11-15', yaOcurrio: false });
    expect(r.concept.toLowerCase()).not.toMatch(/noviembre|día|dia/);
  });
  it('"Recibiré 1.5 millones el 5 de octubre" is income, not the expense default', () => {
    expect(f('Recibiré 1.5 millones el 5 de octubre'))
      .toMatchObject({ type: 'income', amount: 1_500_000, date: '2026-10-05', yaOcurrio: false });
  });
  it('a day already gone + future verb -> next month', () => {
    expect(f('Recibiré 300 mil el 15')).toMatchObject({ type: 'income', amount: 300_000, date: '2026-10-15', yaOcurrio: false });
  });
  it('a day already gone + past verb -> this month, already happened', () => {
    expect(f('Gasté 20 mil el 15')).toMatchObject({ amount: 20_000, date: '2026-09-15', yaOcurrio: true });
  });
  it('a month already past -> next year', () => {
    expect(f('Pagaré 80 mil el 3 de enero')).toMatchObject({ amount: 80_000, date: '2027-01-03', yaOcurrio: false });
  });
  it('past verb + month already gone -> most recent occurrence, already happened', () => {
    expect(f('Gasté 20 mil el 3 de enero')).toMatchObject({ amount: 20_000, date: '2026-01-03', yaOcurrio: true });
  });
  it('past verb + month still ahead this year -> last year', () => {
    expect(f('Gasté 20 mil el 3 de diciembre')).toMatchObject({ date: '2025-12-03', yaOcurrio: true });
  });
  it('"el 15 del próximo mes" and "del mes que viene"', () => {
    expect(f('Pagaré 50 mil el 15 del próximo mes').date).toBe('2026-10-15');
    expect(f('Pagaré 50 mil el 15 del mes que viene').date).toBe('2026-10-15');
  });
  it('"el día 15" and abbreviated month', () => {
    expect(f('Pagaré 50 mil el día 15 de nov').date).toBe('2026-11-15');
    expect(f('Voy a pagar 50 mil el día 30').date).toBe('2026-09-30');
  });
  it('clamps nonexistent days', () => {
    expect(f('Pagaré 50 mil el 31 de noviembre').date).toBe('2026-11-30');
    expect(f('Pagaré 50 mil el 31 del próximo mes').date).toBe('2026-10-31');
  });
  it('a future verb alone is scheduled even for today', () => {
    expect(f('Me van a pagar 2 millones')).toMatchObject({ type: 'income', date: '2026-09-29', yaOcurrio: false });
    expect(f('Tengo que pagar 90 mil de arriendo').yaOcurrio).toBe(false);
  });
  it('the other future verbs', () => {
    for (const t of ['me llegará', 'cobraré', 'me consignan', 'me llega']) {
      expect(f(`${t} 100 mil`).type).toBe('income');
    }
    expect(f('Debo pagar 100 mil').type).toBe('expense');
  });
  it('"el 200 mil" is not a day', () => {
    expect(f('pagué el 200 mil').date).toBe('2026-09-29');
  });
  it('stays fast on pathological input', () => {
    const t0 = Date.now();
    f(`el ${'dia '.repeat(5000)}15 de`);
    f('el 1 '.repeat(3000));
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe('round-3 regressions', () => {
  it('"$1.500.000" still parses', () => {
    expect(parseUtterance('Gasté $1.500.000 en mercado', '2026-09-29').amount).toBe(1_500_000);
  });
  it('scheduled phrase keeps the concept clean and is pending', () => {
    const r = parseUtterance('Pagaré 200 mil el 15 de noviembre', '2026-09-29');
    expect(r.concept.toLowerCase()).not.toMatch(/noviembre|día|dia/);
    expect(r.yaOcurrio).toBe(false);
  });
});

describe('currency and cash (redesign §9b)', () => {
  const TODAY = '2026-09-30';
  it('"dólares" and "usd" mean USD, and the word leaves the concept', () => {
    const r = parseUtterance('gasté 20 dólares en un libro', TODAY);
    expect(r).toMatchObject({ amount: 20, currency: 'USD', concept: 'Libro' });
    expect(parseUtterance('pagué 15 usd de netflix', TODAY).currency).toBe('USD');
  });
  it('"euros" means EUR', () => {
    expect(parseUtterance('compré un café de 3 euros', TODAY)).toMatchObject({ amount: 3, currency: 'EUR' });
  });
  it('no currency word, no currency field', () => {
    expect(parseUtterance('gasté 45 mil en el almuerzo', TODAY)).not.toHaveProperty('currency');
  });
  it('"en efectivo" is the cash method', () => {
    const r = parseUtterance('gasté 20 dólares en efectivo en el taxi', TODAY);
    expect(r).toMatchObject({ method: 'cash', currency: 'USD' });
    expect(r.concept.toLowerCase()).toContain('taxi');
  });
});
