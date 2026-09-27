/**
 * Which reminders can be uploaded.
 *
 * Simpler than budgets: a reminder's id IS its transaction's id, so two
 * devices generate the same id for the same reminder and plain
 * last-write-wins by id is enough. There's no natural key to reconcile.
 *
 * What does need watching is the FK: in Postgres reminders.transaction_id
 * points to transactions(id). Uploading the reminder of a transaction
 * that no longer exists doesn't fail quietly on its own; it takes down
 * the entire push, and with it the upload of everything else queued behind it.
 */
import type { Reminder } from '@/domain/types';
import { newest } from './newest';

export function remindersToUpload(
  localRows: Reminder[],
  remoteRows: Reminder[],
  /** Ids of transactions that exist and are not deleted. */
  liveTransactionIds: Set<string>,
): Reminder[] {
  const remoteById = new Map(remoteRows.map((r) => [r.id, r]));
  return localRows.filter((r) => {
    if (!liveTransactionIds.has(r.transactionId)) return false;
    const remoteRow = remoteById.get(r.id);
    return !remoteRow || newest(r.updatedAt, remoteRow.updatedAt);
  });
}
