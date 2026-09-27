/**
 * Groups card purchases by their payment date (the cycle they belong to).
 * This is the "aggregated" half of the hybrid view requested: each
 * purchase shows up individually, but also as part of a cycle total —
 * the computed equivalent of the "Card purchase payment" row in your
 * spreadsheet.
 */
import { compareISO } from '../dates';
import { calculateAvailableCredit, type AvailableCredit } from './availableCredit';
import type { ISODate, PaymentMethod, Transaction } from '../types';

export interface CreditCycleGroup {
  paymentDate: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

export function groupByCycle(creditTransactions: Transaction[]): CreditCycleGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const tx of creditTransactions) {
    if (tx.status === 'cancelled' || !tx.cyclePaymentDate) continue;
    const list = byDate.get(tx.cyclePaymentDate) ?? [];
    list.push(tx);
    byDate.set(tx.cyclePaymentDate, list);
  }

  const groups: CreditCycleGroup[] = [];
  for (const [paymentDate, txs] of byDate) {
    const sorted = txs.slice().sort((a, b) => compareISO(a.date, b.date));
    groups.push({
      paymentDate,
      total: sorted.reduce((acc, t) => acc + t.amount, 0),
      count: sorted.length,
      transactions: sorted,
    });
  }
  return groups.sort((a, b) => compareISO(a.paymentDate, b.paymentDate));
}

export interface CardCycles {
  card: PaymentMethod;
  /** null if the card has no limit configured. */
  available: AvailableCredit | null;
  cycles: CreditCycleGroup[];
}

/**
 * Same thing, but split BY CARD first and cycle inside that.
 *
 * groupByCycle only groups by payment date, which was enough when there
 * was a single card. With two, two different purchases can fall on the
 * same payment date and ended up summed into a row that means nothing:
 * each card is paid separately.
 *
 * ALL cards are returned, even without purchases, because their
 * available credit is still information the user wants to see.
 */
export function groupByCard(
  cards: PaymentMethod[],
  transacciones: Transaction[],
  today: ISODate,
): CardCycles[] {
  const credit = cards.filter((t) => t.type === 'credit');
  const byCard = new Map<string, Transaction[]>(credit.map((t) => [t.id, []]));

  for (const tx of transacciones) {
    if (!tx.paymentMethodId) continue;
    byCard.get(tx.paymentMethodId)?.push(tx);
  }

  return credit.map((card) => {
    const theirs = byCard.get(card.id) ?? [];
    return {
      card,
      available: calculateAvailableCredit(card, theirs, today),
      cycles: groupByCycle(theirs),
    };
  });
}
