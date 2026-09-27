/**
 * Interpret free text ("mercado 45 mil con la tarjeta") and decide which
 * category and which method to propose.
 *
 * This exists because it used to be done in three places — quick entry,
 * the inbox, and the Shortcut link — and the third one did it
 * differently: it only used the keyword table and never looked at what
 * had been learned. So you'd correct "Uber" to a different category, the
 * app would learn it, and coming in through the Shortcut it would go
 * back to proposing the usual one. With a single function, all three
 * paths learn the same way.
 */
import { parseUtterance, type Parsed } from './parse';
import { finalCategory, methodByType } from './resolve';
import { inferFromConcept, type ConceptIndexEntry, type InferenceResult } from '../inference/conceptInference';
import type { Id, ISODate, PaymentMethod } from '../types';

export interface UserContext {
  /** What the app has already learned from previous saves. */
  conceptIndex: ConceptIndexEntry[];
  /** Ids of the categories that exist TODAY: a learned one that was deleted is no good. */
  categoryIds: Id[];
  methodRows: PaymentMethod[];
  defaultMethodId: Id | null;
}

export interface Interpretation {
  parsed: Parsed;
  categoryId: Id | null;
  paymentMethodId: Id | null;
  learned: InferenceResult | null;
  /** The category came from history, not from the keyword table. */
  fromLearning: boolean;
}

export function interpretText(text: string, today: ISODate, ctx: UserContext): Interpretation {
  const parsed = parseUtterance(text, today);

  // null is deliberately passed as the base: what matters is whether
  // history says something on its own, not confirming what we were
  // already assuming.
  const learned = parsed.concept
    ? inferFromConcept(parsed.concept, ctx.conceptIndex, { categoryId: null, paymentMethodId: null })
    : null;

  // What's been learned goes first, the keyword table is the floor.
  const categoryId = finalCategory(learned?.categoryId ?? null, parsed.categoryIdSugerida, ctx.categoryIds);

  // The method the text names wins ("con la tarjeta" is explicit);
  // then what's been learned, and last the usual one.
  const paymentMethodId =
    methodByType(ctx.methodRows, parsed.method)
    ?? learned?.paymentMethodId
    ?? ctx.defaultMethodId
    ?? ctx.methodRows.find((m) => m.isDefault)?.id
    ?? null;

  return {
    parsed,
    categoryId,
    paymentMethodId,
    learned,
    fromLearning: Boolean(learned?.source) && categoryId === learned?.categoryId,
  };
}
