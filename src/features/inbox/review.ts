/**
 * Reviewing what arrived on its own, one at a time (BANDEJA.md).
 *
 * Pure on purpose: what the sheet shows, whether "Anotar" is on and which
 * ones "Anotar los N completos" takes are decided here and tested apart
 * from the screen. The text is read by interpretText, as always; this only
 * lays the user's corrections over what it understood.
 */
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import type { Interpretation } from '@/domain/nlp/interpret';
import type { Id, ISODate, PaymentMethod, Transaction, TransactionSource, TransactionType } from '@/domain/types';
import type { InboxEntry } from '@/data/supabase/inbox';
import { convert } from '@/lib/currencies';

/** What the user changed in the sheet. Anything absent keeps what was understood. */
export interface Edits {
  type?: TransactionType;
  amount?: number | null;
  concept?: string;
  categoryId?: Id | null;
  paymentMethodId?: Id | null;
  date?: ISODate;
  currency?: string;
}

/**
 * The colour of the hint under the fields.
 *  - missing: red, something can't be read; "Anotar" is off.
 *  - typed:   green, the user wrote what was missing.
 *  - future:  blue, it's dated ahead: scheduled, not counted today.
 *  - learned: green, the category comes from the user's history.
 *  - ok:      green, complete.
 */
export type HintKind = 'missing' | 'typed' | 'future' | 'learned' | 'ok';

export interface Draft {
  entry: InboxEntry;
  source: TransactionSource;
  /** Who sent it, when the text says so ("Bancolombia"). */
  bank: string | null;
  type: TransactionType;
  /** In `currency`. null = still missing. */
  amount: number | null;
  concept: string;
  categoryId: Id | null;
  paymentMethodId: Id | null;
  date: ISODate;
  currency: string;
  status: 'paid' | 'pending';
  /** What the text itself lacked, before any correction. */
  originallyMissing: 'amount' | 'concept' | null;
  /** What still lacks now. */
  missing: 'amount' | 'concept' | null;
  complete: boolean;
  hint: HintKind;
}

/** The inbox stores 'dictado' (the Edge Function's word); the app says 'dictation'. */
export function sourceOf(origen: string): TransactionSource {
  if (origen === 'sms') return 'sms';
  if (origen === 'dictado' || origen === 'dictation') return 'dictation';
  return 'atajo';
}

/** Longest first: "Banco de Bogotá" before "Bogotá", "Nu" only as a whole word. */
const BANKS: Array<[RegExp, string]> = [
  [/bancolombia/i, 'Bancolombia'],
  [/nequi/i, 'Nequi'],
  [/daviplata/i, 'Daviplata'],
  [/davivienda/i, 'Davivienda'],
  [/banco de bogot[aá]/i, 'Banco de Bogotá'],
  [/bbva/i, 'BBVA'],
  [/scotiabank|colpatria/i, 'Scotiabank Colpatria'],
  [/banco de occidente/i, 'Banco de Occidente'],
  [/banco popular/i, 'Banco Popular'],
  [/av ?villas/i, 'AV Villas'],
  [/ita[uú]/i, 'Itaú'],
  [/falabella/i, 'Falabella'],
  [/rappipay|rappicard/i, 'RappiPay'],
  [/lulo/i, 'Lulo Bank'],
  [/\bnu\b|nubank/i, 'Nu'],
];

/** The sender named in the message, if it names one. Only for the label. */
export function bankFromText(text: string): string | null {
  for (const [re, name] of BANKS) if (re.test(text)) return name;
  return null;
}

export function buildDraft(entry: InboxEntry, read: Interpretation, edits: Edits, ctx: {
  today: ISODate;
  mainCurrency: string;
  /** Currencies the app can convert; a named one outside the list falls back to the main one. */
  knownCurrencies: string[];
}): Draft {
  const { parsed } = read;
  const named = parsed.currency && ctx.knownCurrencies.includes(parsed.currency) ? parsed.currency : ctx.mainCurrency;
  const amount = edits.amount !== undefined ? edits.amount : parsed.amount;
  // Kept as typed so the input can take a space between words; trimmed
  // only to judge it and when it's saved.
  const concept = edits.concept ?? parsed.concept.trim();
  const date = edits.date ?? parsed.date;
  const categoryId = edits.categoryId !== undefined ? edits.categoryId : read.categoryId;

  // Ahead of today it's scheduled. Otherwise what the text said: a picked
  // past or present date means it happened.
  const status: Draft['status'] = date > ctx.today ? 'pending'
    : edits.date !== undefined || parsed.yaOcurrio ? 'paid'
    : 'pending';

  const originallyMissing = parsed.amount == null ? 'amount' : !parsed.concept ? 'concept' : null;
  const missing = amount == null || amount <= 0 ? 'amount' : !concept.trim() ? 'concept' : null;
  const learned = read.fromLearning && categoryId === read.categoryId;
  const hint: HintKind = missing ? 'missing'
    : originallyMissing ? 'typed'
    : status === 'pending' ? 'future'
    : learned ? 'learned'
    : 'ok';

  return {
    entry,
    source: sourceOf(entry.origen),
    bank: bankFromText(entry.text),
    type: edits.type ?? parsed.type,
    amount: amount ?? null,
    concept,
    categoryId,
    paymentMethodId: edits.paymentMethodId !== undefined ? edits.paymentMethodId : read.paymentMethodId,
    date,
    currency: edits.currency ?? named,
    status,
    originallyMissing,
    missing,
    complete: missing === null,
    hint,
  };
}

/**
 * "Anotar los N que están completos": only the ones that came in whole and
 * in the main currency. Never one that had something in red, even after
 * it was typed — that one gets looked at on its own.
 */
export function bulkable(drafts: Draft[], mainCurrency: string): Draft[] {
  return drafts.filter((d) => d.complete && d.originallyMissing === null && d.currency === mainCurrency);
}

/** The transaction to save. `fxRate` converts a foreign amount into the main currency. */
export function toTransaction(d: Draft, ctx: {
  id: Id;
  now: string;
  methods: PaymentMethod[];
  mainCurrency: string;
  fxRate: number | null;
}): Transaction | null {
  if (!d.complete || d.amount == null) return null;
  const foreign = d.currency !== ctx.mainCurrency;
  if (foreign && !ctx.fxRate) return null;
  const method = ctx.methods.find((m) => m.id === d.paymentMethodId);
  const cycle = method?.type === 'credit'
    ? calculateCreditCardCycle(d.date, method.cutoffDay, method.paymentDay)
    : null;
  return {
    id: ctx.id,
    type: d.type,
    concept: d.concept.trim(),
    amount: foreign ? convert(d.amount, ctx.fxRate!) : d.amount,
    ...(foreign ? { currency: d.currency, originalAmount: d.amount, fxRate: ctx.fxRate! } : {}),
    date: d.date,
    categoryId: d.categoryId,
    paymentMethodId: d.paymentMethodId,
    status: d.status,
    quincenaKey: null,
    cycleCutoffDate: cycle?.cycleCutoff,
    cyclePaymentDate: cycle?.paymentDate,
    source: d.source,
    ...(d.bank ? { sourceLabel: d.bank } : {}),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** "hace 3 min": how long ago it arrived. Returns the number and the unit. */
export function ago(createdAt: string, now = Date.now()): { n: number; unit: 'now' | 'min' | 'h' | 'd' } {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return { n: 0, unit: 'now' };
  if (minutes < 60) return { n: minutes, unit: 'min' };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { n: hours, unit: 'h' };
  return { n: Math.floor(hours / 24), unit: 'd' };
}

/** Moving through the queue without deciding: stays within 0..length-1. */
export function moveIndex(idx: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, idx + delta));
}

/**
 * The status dot and segment of each waiting entry (BANDEJA-WEB.md):
 * red when something is missing, blue when it's for later, green otherwise.
 */
export function queueTone(d: Draft): 'missing' | 'future' | 'ok' {
  return d.missing ? 'missing' : d.status === 'pending' ? 'future' : 'ok';
}
