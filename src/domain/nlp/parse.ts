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
import { addDays, clampDay, parseISO, toISO } from '../dates';
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
function findDate(text: string, today: ISODate): { date: ISODate; text: string | null } {
  const h = parseISO(today);

  if (/(^|\s)anteayer(\s|$)/.test(text)) return { date: toISO(addDays(h, -2)), text: 'anteayer' };
  if (/(^|\s)ayer(\s|$)/.test(text)) return { date: toISO(addDays(h, -1)), text: 'ayer' };
  if (/(^|\s)manana(\s|$)/.test(text)) return { date: toISO(addDays(h, 1)), text: 'manana' };

  const ago = /hace\s+(\d+)\s+dias?/.exec(text);
  if (ago) return { date: toISO(addDays(h, -Number(ago[1]))), text: ago[0] };

  // "el 15" / "el 3" -> that day of the current month. Two digits max,
  // to avoid being confused with an amount.
  const day = /(^|\s)el\s+(\d{1,2})(\s|$)/.exec(text);
  if (day) {
    const d = Number(day[2]);
    if (d >= 1 && d <= 31) return { date: toISO({ y: h.y, m: h.m, d: clampDay(h.y, h.m, d) }), text: day[0].trim() };
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

  const income = contains(text, INCOME_VERBS);
  const expense = contains(text, EXPENSE_VERBS);
  // If it says both, whichever appears first wins.
  let type: TransactionType = 'expense';
  if (income && (!expense || text.indexOf(income) < text.indexOf(expense))) type = 'income';

  const amount = findAmount(originalText);
  const date = findDate(text, today);

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

  const concept = bankConcept(text) ?? extractConcept(text, [
    amount ? normalizeText(amount.text) : null,
    date.text,
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
    concept: pretty(concept),
    date: date.date,
    method,
    categoryIdSugerida: guessCategory(concept || text),
    // A bank SMS always reports something that already happened. In
    // speech, "gasté" and "me llegó" are also past tense; "voy a pagar"
    // isn't handled.
    yaOcurrio: date.date <= today,
  };
}
