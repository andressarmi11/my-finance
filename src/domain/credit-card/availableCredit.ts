/**
 * A card's limit and available credit, and the balances left unpaid.
 *
 * The available amount comes from the transactions themselves, not from
 * a balance the user types in by hand nor from a bank integration: limit
 * minus what's been bought that isn't marked paid yet.
 *
 * That means the number depends on the user marking cycles as paid. That's
 * why unpaidBalances() exists and why the dashboard shows it: if nobody
 * remembers to mark it, the available amount drifts silently.
 */
import type { ISODate, PaymentMethod, Transaction } from '../types';

export interface AvailableCredit {
  cupo: number;
  used: number;
  /** cupo - usado. Negative = over the limit, and shown as such. */
  available: number;
}

/**
 * `null` when the card has no limit configured: there's no available
 * amount to show, and returning a 0 limit would be a lie.
 *
 * Only counts purchases dated <= today. Without that filter, recurring
 * transactions — which materialize.ts seeds with status 'pending' up to
 * about three months ahead — would show up as limit consumed by
 * purchases that haven't happened yet. A future purchase doesn't
 * consume the limit.
 */
export function calculateAvailableCredit(
  card: PaymentMethod,
  transacciones: Transaction[],
  today: ISODate,
): AvailableCredit | null {
  if (card.creditLimit === undefined) return null;

  let used = 0;
  for (const tx of transacciones) {
    if (!usesCredit(tx, card.id, today)) continue;
    used += tx.amount;
  }

  return { cupo: card.creditLimit, used, available: card.creditLimit - used };
}

function usesCredit(tx: Transaction, cardId: string, today: ISODate): boolean {
  return (
    tx.paymentMethodId === cardId &&
    tx.type === 'expense' &&
    tx.status !== 'paid' &&
    tx.status !== 'cancelled' &&
    // purchaseDate, not date: an instalment purchase locks the whole
    // limit the day you swipe the card, not instalment by instalment —
    // that's what the bank does. Instalment 7 has a future date but its
    // purchase already happened. The ?? leaves anything that isn't an
    // instalment purchase untouched.
    (tx.purchaseDate ?? tx.date) <= today
  );
}

export interface UnpaidBalance {
  card: PaymentMethod;
  paymentDate: ISODate;
  total: number;
  count: number;
}

/**
 * The cycles whose payment date has ALREADY passed and are still not
 * marked paid.
 *
 * Deliberately doesn't reuse domain/totals/outstanding.ts: that one looks
 * at the current month and mixes pending, scheduled and card. This one
 * looks backward, card only and overdue only. They're different questions.
 *
 * Sorted oldest to newest: whatever's been unpaid the longest is the
 * most urgent.
 */
export function unpaidBalances(
  cards: PaymentMethod[],
  transacciones: Transaction[],
  today: ISODate,
): UnpaidBalance[] {
  const byCard = new Map(cards.map((t) => [t.id, t]));
  // A card and a cycle together identify the balance; two cards can have
  // the same payment date and must not be added together in one row.
  const running = new Map<string, UnpaidBalance>();

  for (const tx of transacciones) {
    const dueDate = tx.cyclePaymentDate;
    if (!dueDate || dueDate > today) continue;
    if (tx.type !== 'expense' || tx.status === 'paid' || tx.status === 'cancelled') continue;

    const card = tx.paymentMethodId ? byCard.get(tx.paymentMethodId) : undefined;
    if (!card) continue;

    const key = `${card.id}|${dueDate}`;
    const previous = running.get(key);
    if (previous) {
      previous.total += tx.amount;
      previous.count += 1;
    } else {
      running.set(key, { card, paymentDate: dueDate, total: tx.amount, count: 1 });
    }
  }

  return [...running.values()].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
}
