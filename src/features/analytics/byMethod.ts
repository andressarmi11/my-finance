import type { PaymentMethod, Transaction } from '@/domain/types';

export interface SpendByMethod {
  debit: number;
  credit: number;
  cash: number;
}

/**
 * Spending split by how it was paid, for "Por método de pago" (redesign
 * §9c). Same rules as calculateDebitVsCredit (expenses only, cancelled
 * ones out), with cash as its own slice. Transfers and transactions with
 * no method count as debit, which is what that function already did.
 */
export function spendByMethod(transactions: Transaction[], methods: PaymentMethod[]): SpendByMethod {
  const typeById = new Map(methods.map((m) => [m.id, m.type]));
  const out: SpendByMethod = { debit: 0, credit: 0, cash: 0 };
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    const type = tx.paymentMethodId ? typeById.get(tx.paymentMethodId) : undefined;
    if (type === 'credit') out.credit += tx.amount;
    else if (type === 'cash') out.cash += tx.amount;
    else out.debit += tx.amount;
  }
  return out;
}
