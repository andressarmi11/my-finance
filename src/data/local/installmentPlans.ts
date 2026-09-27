/**
 * Saves and deletes installment purchases: N installments that are N
 * transactions.
 *
 * Lives in data/ and not in domain/ because it writes. The split itself
 * —how much each installment is worth and when it's paid— is pure and
 * lives in domain/credit-card/installments.ts.
 */
import { expandInstallments } from '@/domain/credit-card/installments';
import type { PaymentMethod, Transaction } from '@/domain/types';
import { nowISO } from '@/lib/todayISO';
import { db } from '../db';
import { localRepository } from './localRepository';

/**
 * An installment's id IS its identity: group + number.
 *
 * Deterministic and not random, for the same reason as occurrenceId in
 * materialize.ts: the deletion tombstone stores the row's id, and with a
 * random id there would be no way to know which installment died once
 * it was deleted.
 */
export function installmentId(groupId: string, toNumber: number): string {
  return `${groupId}:cuota-${toNumber}`;
}

/**
 * Creates the N installments of an installment purchase in a single batch.
 *
 * `base` is the purchase as the form built it: concept, category, method,
 * and the TOTAL amount. The installments are derived from that.
 */
export async function createInstallmentPlan(
  base: Transaction,
  installments: number,
  method: PaymentMethod | undefined,
  installmentAmount?: number,
): Promise<void> {
  const groupId = base.installmentGroupId ?? crypto.randomUUID();
  const split = expandInstallments(
    base.date, base.amount, installments, method?.cutoffDay, method?.paymentDay, installmentAmount,
  );
  const now = nowISO();

  const rows: Transaction[] = split.map((c) => ({
    ...base,
    id: installmentId(groupId, c.toNumber),
    amount: c.amount,
    date: c.date,
    // A card purchase isn't paid the day you make it: it's owed until the
    // statement. Same as in spec 1.
    status: 'pending',
    cycleCutoffDate: c.cycleCutoffDate,
    cyclePaymentDate: c.cyclePaymentDate,
    installmentGroupId: groupId,
    installmentNumber: c.toNumber,
    installmentCount: split.length,
    purchaseDate: base.date,
    createdAt: base.createdAt || now,
    updatedAt: now,
  }));

  // saveTransaction, not bulkPut: it feeds the smart-fill's conceptIndex.
  // Only the first one, or twelve installments would count as twelve uses
  // of the concept and inflate its ranking in the autocomplete.
  await localRepository.saveTransaction(rows[0]!);
  if (rows.length > 1) await db.transactions.bulkPut(rows.slice(1));
}

/** The sibling installments of one, including itself. Empty if it's not an installment purchase. */
export async function groupInstallments(tx: Transaction): Promise<Transaction[]> {
  if (!tx.installmentGroupId) return [];
  const group = tx.installmentGroupId;
  // filter, not where: transactions doesn't index installmentGroupId in Dexie.
  return db.transactions.filter((t) => t.installmentGroupId === group).toArray();
}

/**
 * Deletes the ENTIRE installment purchase. An installment purchase with a
 * gap at installment 7 means nothing, and deleting them one by one throws
 * off the credit limit silently.
 *
 * Each installment is deleted through localRepository so it leaves its
 * own tombstone and the deletion travels between devices.
 */
export async function deleteInstallmentPlan(tx: Transaction): Promise<number> {
  const installments = await groupInstallments(tx);
  if (installments.length === 0) {
    await localRepository.deleteTransaction(tx.id);
    return 1;
  }
  for (const installment of installments) await localRepository.deleteTransaction(installment.id);
  return installments.length;
}
