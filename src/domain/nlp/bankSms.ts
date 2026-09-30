/**
 * Bank SMS ("Bancolombia: Compraste $17.686,00 en RAPPI COLOMBIA*DL con tu
 * T.Deb *9838, el 20/06/2026 a las 15:02...").
 *
 * The generic reader takes the FIRST number it finds and whatever words are
 * left as the concept. That breaks on real messages: "recibiste UNA
 * transferencia ... por $300,000.00" came out as $1, card and account
 * numbers (*7145) compete with the amount, and "Compraste" stayed in the
 * concept. Bank templates vary in length and order, but two things hold:
 *
 *  - the amount is always the figure right after "$";
 *  - a verb says which way the money went (compraste / pagaste / enviaste /
 *    retiraste… out; recibiste / te consignaron / abono… in) and where the
 *    counterpart is written ("en MERCHANT", "de NAME", "a NAME").
 *
 * Works on normalizeText() output (lowercase, no accents). Every quantifier
 * is bounded: this text comes from a public endpoint (ingest).
 */
import type { TransactionType } from '../types';

export interface BankSms {
  type: TransactionType;
  amount: number;
  concept: string;
}

const OUT = [
  'compraste', 'pagaste', 'enviaste', 'transferiste', 'retiraste', 'giraste', 'debitamos',
  'se debito', 'realizaste un pago', 'realizaste una compra', 'realizaste una transferencia', 'compra aprobada', 'pago aprobado',
];
const IN = [
  'recibiste', 'te consignaron', 'te transfirieron', 'te enviaron', 'te llego', 'te llegaron',
  'abono', 'abonamos', 'consignacion', 'recibio', 'deposito',
];

/** "$300,000.00" / "$17.686,00" / "$4.860" / "$72,000" / "$ 1.200.000" → whole pesos. */
export function moneyAfterDollar(raw: string): number | null {
  const s = raw.replace(/\s/g, '');
  if (!/^\d[\d.,]{0,20}$/.test(s)) return null;
  const seps = [...s.matchAll(/[.,]/g)].map((m) => m.index!);
  if (seps.length === 0) return Number(s);
  const last = seps[seps.length - 1]!;
  const tail = s.slice(last + 1);
  // Two digits after the last separator = cents (",00" / ".00"): dropped.
  // Otherwise every separator is a thousands one.
  const whole = tail.length === 2 || tail.length === 1 ? s.slice(0, last) : s;
  const n = Number(whole.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function firstIndex(text: string, words: string[]): { word: string; at: number } | null {
  let best: { word: string; at: number } | null = null;
  for (const w of words) {
    const re = new RegExp(`(^|[\\s,:;.])${w.replace(/\s/g, '\\s+')}(?=[\\s,:;.]|$)`);
    const m = re.exec(text);
    if (m && (best === null || m.index < best.at)) best = { word: w, at: m.index };
  }
  return best;
}

/** "rappi colombia*dl" → "Rappi Colombia"; "dlo*didi" → "Didi"; "uber *trip" → "Uber". */
export function cleanMerchant(raw: string): string {
  let s = raw.trim();
  if (s.includes('*')) {
    const [head, ...rest] = s.split('*');
    const tailPart = rest.join(' ').trim();
    // A 1–3 letter head is the payment processor's prefix (DLO*, MP*, PAY*).
    s = (head!.trim().length <= 3 && tailPart) ? tailPart : head!.trim();
  }
  s = s.replace(/[._-]+(com|co|net)\b.*$/, '').replace(/[^\p{L}\p{N}&\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return titleCase(s);
}

function titleCase(s: string): string {
  return s.split(' ').filter(Boolean)
    .map((w) => w.length <= 2 && /^(de|la|el|y|en|del)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Words where the counterpart ends: the next clause of the template. */
const STOP = String.raw`(?=\s+(?:con|en tu|desde|a la|a tu|por|el\s+\d|a las|si tienes|el dia|aut|autorizacion|ref|referencia|saldo|cupo|trans|hora)\b|[,;]|\.(?=\s|$)|$)`;

function counterpart(text: string, after: number, kind: 'merchant' | 'from' | 'to'): string | null {
  const rest = text.slice(after, after + 240);
  const lead = kind === 'merchant' ? String.raw`\s(?:en|a)\s` : kind === 'from' ? String.raw`\s(?:de|desde)\s` : String.raw`\s(?:a)\s`;
  const re = new RegExp(`${lead}(?:el\\s+)?([\\p{L}\\p{N}*&'.\\- ]{2,60}?)${STOP}`, 'u');
  const m = re.exec(rest);
  if (!m) return null;
  const got = m[1]!.trim();
  // "tu cuenta", "la llave", numbers: not a counterpart.
  if (/^(tu|su|la|el)\s|^\d/.test(got) || /^(cuenta|llave|corresponsal)$/.test(got)) return null;
  return got;
}

/**
 * Reads a bank SMS. null when the text isn't one (no "$" amount, or no verb
 * that says which way the money went): the generic reader handles it.
 */
export function parseBankSms(text: string): BankSms | null {
  const dollar = /\$\s{0,2}(\d[\d.,]{0,20})/.exec(text);
  if (!dollar) return null;
  const amount = moneyAfterDollar(dollar[1]!);
  if (amount == null || amount <= 0) return null;

  const outVerb = firstIndex(text, OUT);
  const inVerb = firstIndex(text, IN);
  if (!outVerb && !inVerb) return null;
  const type: TransactionType = inVerb && (!outVerb || inVerb.at < outVerb.at) ? 'income' : 'expense';
  const verb = type === 'income' ? inVerb! : outVerb!;
  const from = verb.at + verb.word.length;

  let concept: string | null = null;
  if (type === 'expense') {
    if (/codigo\s+qr|\bqr\b/.test(text) && verb.word === 'pagaste') concept = 'Pago QR';
    else if (verb.word === 'retiraste') concept = 'Retiro';
    else if (verb.word === 'enviaste' || verb.word === 'transferiste' || verb.word === 'realizaste una transferencia') {
      const to = counterpart(text, from, 'to');
      concept = to ? cleanMerchant(to) : 'Transferencia';
    } else {
      const m = counterpart(text, dollar.index, 'merchant') ?? counterpart(text, from, 'merchant');
      concept = m ? cleanMerchant(m) : null;
    }
  } else {
    const corresponsal = /corresponsal\s+([\p{L}\p{N} ]{2,60}?)(?=\s+en\s|[,.]|$)/u.exec(text);
    if (verb.word === 'consignacion' || corresponsal) concept = 'Consignación';
    else {
      const who = counterpart(text, from, 'from') ?? counterpart(text, dollar.index, 'from');
      concept = who ? cleanMerchant(who) : null;
    }
  }

  return { type, amount, concept: concept ?? '' };
}
