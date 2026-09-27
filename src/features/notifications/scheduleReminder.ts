/**
 * Creates/updates a transaction's reminder.
 *
 * It's saved LOCALLY first and sync uploads it afterwards. It used to go
 * straight to the cloud, and that got lost offline: getSession() returns
 * the cached session even with no network, so it passed the guard and the
 * upsert blew up; the caller swallowed the error with a console.error and
 * nobody ever retried. An expense jotted down on the bus was left without a
 * reminder forever, silently.
 *
 * What FIRES the notification is still the server (see
 * docs/NOTIFICATIONS.md); local is only where the data is born, as with
 * everything else in this app.
 *
 * A transaction has at most one active reminder: the transaction's own id
 * is used as the reminder's id, so saving it again (e.g. if the date
 * changes) updates the same one instead of duplicating it. And since the id
 * comes from the transaction, two devices generate the SAME id for the same
 * reminder: there's no way to duplicate it when syncing.
 */
import { calculateReminderTime } from '@/domain/reminders/schedule';
import type { Settings, Transaction } from '@/domain/types';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { localRepository } from '@/data/local/localRepository';

export async function maybeScheduleReminder(tx: Transaction, settings: Settings): Promise<void> {
  // Without Supabase there's no server to fire anything, so the data
  // would be good for nothing (see docs/NOTIFICATIONS.md).
  if (!isSupabaseConfigured()) return;
  if (tx.status === 'paid' || tx.status === 'cancelled') return;

  await localRepository.saveReminder({
    id: tx.id,
    transactionId: tx.id,
    remindAt: calculateReminderTime(tx.date, settings.reminderDefaultDaysBefore),
    status: 'scheduled',
    // The real timestamp is stamped by localRepository.saveReminder.
    updatedAt: '',
  });
}
