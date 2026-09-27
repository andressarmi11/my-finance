/**
 * How much has been spent per category. Used both by the Categories screen
 * and by Analytics.
 */
import type { Id, Transaction } from '../types';

export interface CategoryTotal {
  categoryId: Id | null;
  amount: number;
  count: number;
}

export function calculateSpendByCategory(transactions: Transaction[]): CategoryTotal[] {
  const map = new Map<Id | null, CategoryTotal>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    const current = map.get(tx.categoryId) ?? { categoryId: tx.categoryId, amount: 0, count: 0 };
    current.amount += tx.amount;
    current.count += 1;
    map.set(tx.categoryId, current);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}
