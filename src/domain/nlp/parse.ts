/**
 * Understands a phrase in Spanish and turns it into a transaction.
 *
 * The same function serves all three entry points:
 *   - voice dictation   ("gasté 45 mil en el almuerzo con la tarjeta")
 *   - bank SMS          ("Bancolombia: Compra por $145.000 en EXITO")
 *   - typed text        (the "tell the app" bar)
 *
 * It's deterministic and runs offline: no language model, no API call.
 * For money that matters — an interpretation that changes on its own
 * between two runs isn't what you want for your expense tracking.
 * Whatever it learns, it learns from the user's own history
 * (domain/inference/conceptInference.ts), not from a model.
 */
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate, PaymentMethodType, TransactionType } from '../types';
import { guessCategory } from './categories';
import { findAmount, normalizeText } from './numbers';

export interface Parsed {
  type: TransactionType;
  /** null = no amount was found; the UI has to ask for it. */
  amount: number | null;
  concept: string;
  date: ISODate;
  /** Which type of payment method it mentioned, if it mentioned one. */
  method: PaymentMethodType | null;
  /** Keyword-based suggestion. The learned index overrides this. */
  categoryIdSugerida: string | null;
  /** Already happened (said "gasté", or it's an SMS for a completed purchase). */
  yaOcurrio: boolean;
}

const INCOME_VERBS = [
  'me llego', 'me llegaron', 'recibi', 'me pagaron', 'cobre', 'me consignaron',
  'me transfirieron', 'me entro', 'entro', 'ingreso', 'me depositaron',
  'recibiste', 'abono', 'abonaron', 'te consignaron', 'nomina', 'salario', 'vendi',
];

const EXPENSE_VERBS = [
  'gaste', 'pague', 'compre', 'me costo', 'salio', 'gasto', 'pagaste',
  'compra', 'retiraste', 'retire', 'saque',
];

// Future tense = scheduled, not happened yet (yaOcurrio false). They live in
// their own lists so "recibire" is income instead of falling to the expense default.
const FUTURE_INCOME_VERBS = [
  'recibire', 'me van a pagar', 'me llega', 'me llegara', 'cobrare', 'me consignan',
];
const FUTURE_EXPENSE_VERBS = ['pagare', 'voy a pagar', 'tengo que pagar', 'debo pagar'];

// Normalised (no accents). Longest first so "septiembre" wins over "sep".
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sept: 9, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
// Every quantifier below is bounded or a fixed alternation: this text comes
// from a public endpoint (see extractConcept), so no nested/unbounded repeats.
const END = String.raw`(?=[\s.,;]|$)`;
const DATE_MONTH_NAME = new RegExp(
  String.raw`(^|\s)(?:el\s+)?(?:dia\s+)?(\d{1,2})\s+de(?:l)?\s+(${MONTH_ALT})(?:\s+de(?:l)?\s+(\d{4}))?${END}`,
);
const DATE_NEXT_MONTH = new RegExp(
  String.raw`(^|\s)el\s+(?:dia\s+)?(\d{1,2})\s+de(?:l)?\s+(?:(?:proximo|siguiente)\s+mes|mes\s+(?:que\s+viene|proximo|siguiente|entrante))${END}`,
);
// The scale guard keeps "el 200 mil" from being read as a day.
const DATE_DAY = new RegExp(
  String.raw`(^|\s)el\s+(?:dia\s+)?(\d{1,2})(?!\d)(?!\s+(?:mil|millon|millones|k|lucas?|palos?)\b)${END}`,
);

const METHOD_KEYWORDS: Array<{ type: PaymentMethodType; keywords: string[] }> = [
  { type: 'credit', keywords: ['tarjeta de credito', 'con la tarjeta', 'con tarjeta', 'tc', 'credito', 'visa', 'mastercard', 't.cred'] },
  { type: 'cash', keywords: ['efectivo', 'en efectivo', 'cash', 'billete'] },
  { type: 'transfer', keywords: ['transferencia', 'nequi', 'daviplata', 'pse', 'transfiri'] },
  { type: 'debit', keywords: ['debito', 'con la debito', 'tarjeta debito', 'ahorros', 't.deb', 'desde tu cuenta'] },
];

/** Words that are noise in the concept once everything else has been stripped out. */
const FILL = new Set([
  'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'por', 'para', 'con', 'y', 'a', 'al', 'me', 'mi', 'pesos', 'peso', 'plata',
  'que', 'se', 'lo', 'le', 'su', 'fue', 'es', 'esta', 'hoy',
]);

function contains(text: string, frases: string[]): string | null {
  for (const f of frases) {
    const re = new RegExp(`(^|\\s)${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(text)) return f;
  }
  return null;
}

/** Spoken relative dates. Returns the date and the text that produced it. */
function findDate(text: string, today: ISODate, future: boolean, past: boolean): { date: ISODate; text: string | null } {
  const h = parseISO(today);

  if (/(^|\s)anteayer(\s|$)/.test(text)) return { date: toISO(addDays(h, -2)), text: 'anteayer' };
  if (/(^|\s)ayer(\s|$)/.test(text)) return { date: toISO(addDays(h, -1)), text: 'ayer' };
  if (/(^|\s)manana(\s|$)/.test(text)) return { date: toISO(addDays(h, 1)), text: 'manana' };

  const ago = /hace\s+(\d+)\s+dias?/.exec(text);
  if (ago) return { date: toISO(addDays(h, -Number(ago[1]))), text: ago[0] };

  // "el 15 del proximo mes" / "el 15 del mes que viene"
  const nextMonth = DATE_NEXT_MONTH.exec(text);
  if (nextMonth) {
    const d = Number(nextMonth[2]);
    if (d >= 1 && d <= 31) {
      const ym = shiftMonth(h.y, h.m, 1);
      return { date: toISO({ ...ym, d: clampDay(ym.y, ym.m, d) }), text: nextMonth[0].trim() };
    }
  }

  // "15 de noviembre", "el 15 de nov". No year: a past verb ("gasté") means the
  // MOST RECENT occurrence (already happened); otherwise the NEXT one, so a
  // month already gone this year means next year.
  const named = DATE_MONTH_NAME.exec(text);
  if (named) {
    const d = Number(named[2]);
    const m = MONTHS[named[3]!]!;
    if (d >= 1 && d <= 31) {
      const at = (y: number) => toISO({ y, m, d: clampDay(y, m, d) });
      let date = at(named[4] ? Number(named[4]) : h.y);
      if (!named[4] && past && date > today) date = at(h.y - 1);
      else if (!named[4] && !past && date < today) date = at(h.y + 1);
      return { date, text: named[0].trim() };
    }
  }

  // "el 15" / "el dia 3" -> that day of the current month; with a future verb
  // ("recibire ... el 15") a day already gone means next month. Two digits max,
  // to avoid being confused with an amount.
  const day = DATE_DAY.exec(text);
  if (day) {
    const d = Number(day[2]);
    if (d >= 1 && d <= 31) {
      const ym = future && d < h.d ? shiftMonth(h.y, h.m, 1) : { y: h.y, m: h.m };
      return { date: toISO({ ...ym, d: clampDay(ym.y, ym.m, d) }), text: day[0].trim() };
    }
  }

  // Explicit SMS date: 18/09/2026 or 18/09/26
  const explicit = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text);
  if (explicit) {
    const [, dd, mm, yy] = explicit;
    const y = Number(yy!.length === 2 ? `20${yy}` : yy);
    const m = Number(mm);
    if (m >= 1 && m <= 12) {
      return { date: toISO({ y, m, d: clampDay(y, m, Number(dd)) }), text: explicit[0] };
    }
  }

  return { date: today, text: null };
}

/**
 * The concept: what's left after stripping out amount, date, verb and
 * method. For bank SMS, the merchant comes after "en" or "a".
 */
function extractConcept(text: string, aQuitar: Array<string | null>): string {
  let t = text;
  for (const chunk of aQuitar) {
    if (!chunk) continue;
    t = t.replace(chunk, ' ');
  }
  // The SMS timestamp ("18/09/2026 14:32"): the date was already
  // stripped above, but the time was left dangling and ended up inside
  // the concept — the first real SMS I tested came out as "Rappi 19 40".
  t = t.replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/g, ' ');
  // Reference leftovers that also aren't the merchant.
  // Several words in a row before the number: 'saldo disponible 1200000'
  // left 'saldo' dangling when the pattern only accepted one.
  // The repetition is BOUNDED to {1,5}. With an unbounded `+`, the
  // alternatives sharing a prefix (ref/referencia, aut/autorizacion)
  // caused exponential backtracking: 96 characters of 'ref ' repeated
  // took 859 ms, and ~150 hung the thread for minutes. This wasn't
  // theoretical — this text comes from a public function into the
  // inbox, so a short message froze the browser of whoever opened it.
  // In a real SMS there are never more than two or three of these words
  // in a row.
  t = t.replace(/\b(?:(?:ref|referencia|autorizacion|aut|cupo|saldo|disponible|trans|tarjeta|terminada)\s*[:#]?\s*){1,5}\d+/g, ' ');
  const words = t
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 0 && !FILL.has(p));

  return words.join(' ').trim();
}

/**
 * Bancolombia's templates put the merchant between fixed phrases
 * ("Compraste $X en EXITO LAURELES con tu T.Cred"), so read it from there
 * instead of hoping the leftovers read well — the generic path turned the
 * real SMS into "Compraste exito laureles tu t cred 1234 si tienes dudas…".
 * Bounded, no nested quantifiers: this text comes from a public endpoint.
 */
function bankConcept(text: string): string | null {
  const compra = /\sen ([^,]{1,60}?) con tu t\./.exec(text);
  if (compra) return compra[1]!.trim();
  if (/\scodigo qr\s/.test(text)) return 'pago qr';
  if (/\sconsignacion\s/.test(text)) return 'consignacion';
  return null;
}

/** Capitalises the first letter; the rest is left as it came. */
function pretty(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseUtterance(originalText: string, today: ISODate): Parsed {
  const text = normalizeText(originalText);

  const futureVerb = contains(text, [...FUTURE_INCOME_VERBS, ...FUTURE_EXPENSE_VERBS]);
  const income = contains(text, [...INCOME_VERBS, ...FUTURE_INCOME_VERBS]);
  const expense = contains(text, [...EXPENSE_VERBS, ...FUTURE_EXPENSE_VERBS]);
  // If it says both, whichever appears first wins.
  let type: TransactionType = 'expense';
  if (income && (!expense || text.indexOf(income) < text.indexOf(expense))) type = 'income';

  const date = findDate(text, today, futureVerb !== null, futureVerb === null && (income !== null || expense !== null));
  // The date text goes BEFORE the amount search: "el 15" must never be read
  // as the amount, nor steal digits from "200 mil".
  const rest = date.text ? text.replace(date.text, ' ') : text;
  const amount = findAmount(rest);

  let method: PaymentMethodType | null = null;
  let methodText: string | null = null;
  for (const { type, keywords } of METHOD_KEYWORDS) {
    const hit = contains(text, keywords);
    if (hit) {
      method = type;
      methodText = hit;
      break;
    }
  }

  const concept = bankConcept(text) ?? extractConcept(rest, [
    amount ? normalizeText(amount.text) : null,
    methodText,
    income,
    expense,
    // Typical bank SMS noise.
    'bancolombia', 'davivienda', 'nequi', 'daviplata', 'bbva', 'scotiabank',
    'le informa', 'te informa', 'informa', 'aprobada', 'aprobado', 'hora',
  ]);

  return {
    type,
    amount: amount?.value ?? null,
    // "Recibí 400 mil" says nothing else, and an entry without a concept
    // can't be logged — it sat in the inbox with the button off. For
    // money coming in, "Ingreso" is an honest name; an expense still asks.
    concept: pretty(concept) || (type === 'income' ? 'Ingreso' : ''),
    date: date.date,
    method,
    categoryIdSugerida: guessCategory(concept || text),
    // A bank SMS always reports something that already happened. In
    // speech, "gasté" and "me llegó" are also past tense. A future verb
    // ("pagaré", "recibiré") or a future date means scheduled, even for today.
    yaOcurrio: date.date <= today && futureVerb === null,
  };
}
