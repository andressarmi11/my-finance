/**
 * Works out WHEN a transaction's reminder should fire.
 * Pure: it takes the transaction's date and how many days ahead to warn,
 * and returns an ISO datetime in UTC at a fixed, sensible hour (9:00 am
 * Colombia time = 14:00 UTC, no daylight saving).
 */
import { addDays, parseISO, toISO } from '../dates';
import type { ISODate, Reminder, ReminderRule, Settings, Transaction } from '../types';

const REMINDER_HOUR_UTC = 14; // 9:00 am America/Bogota (UTC-5, no DST)

export function calculateReminderTime(transactionDate: ISODate, daysBefore: number): string {
  const remindDate = addDays(parseISO(transactionDate), -daysBefore);
  const iso = toISO(remindDate);
  return `${iso}T${String(REMINDER_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
}

/* ───────────────────────── Reminders v2 (redesign §9f) ─────────────────────────
 * Everything below extends the above without touching it: with the default
 * setting ({ mode: 'days', days: reminderDefaultDaysBefore, time: '09:00' })
 * reminderInstant gives exactly what calculateReminderTime gives (see the
 * test "matches calculateReminderTime for the default rule").
 */

/** Colombia is UTC-5 all year (no DST): local clock + 5h = UTC. */
const COLOMBIA_OFFSET_MINUTES = 5 * 60;
/** Same-day reminders count from the transaction's time, or from this one. */
export const DEFAULT_REMINDER_TIME = '09:00';
const NINE_AM = 9 * 60;

/** 'HH:MM' → minutes since midnight, or null if it isn't a valid time. */
export function parseHHMM(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** A non-negative whole number, or the fallback if it's anything else. */
function wholeOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/**
 * The general rule. `settings.reminder` absent = derived from the old
 * setting (N days before at 9:00), so nobody's reminders move when the
 * app updates.
 */
export function generalReminderRule(
  settings: Pick<Settings, 'reminder' | 'reminderDefaultDaysBefore'>,
): ReminderRule {
  return settings.reminder ?? {
    mode: 'days',
    days: settings.reminderDefaultDaysBefore,
    time: DEFAULT_REMINDER_TIME,
    sameDay: { kind: 'hours', value: 1 },
  };
}

/** The transaction's own rule wins; 'none' = no reminder; null/absent = the general one. */
export function effectiveReminderRule(
  general: ReminderRule,
  override: Transaction['reminder'],
): ReminderRule | null {
  if (override === 'none') return null;
  return override ?? general;
}

/** ISO UTC instant for a Colombia wall-clock time (minutes may overflow the day either way). */
function colombiaToUTC(date: ISODate, minutesOfDay: number): string {
  const { y, m, d } = parseISO(date);
  return new Date(Date.UTC(y, m - 1, d, 0, minutesOfDay + COLOMBIA_OFFSET_MINUTES)).toISOString();
}

/**
 * When a transaction's reminder fires, as an ISO datetime in UTC, or null
 * for "no reminder" ('none').
 *
 *  - days:            `days` days before the date, at `time`.
 *  - sameDay hours:   `value` hours before the transaction's time (09:00 if it has none).
 *  - sameDay minutes: same, in minutes.
 *  - sameDay at:      that clock time on the transaction's day.
 *
 * Counting back can cross midnight (00:30 minus 1 h = 23:30 the day before):
 * it's an instant, not a date, so that's simply correct.
 *
 * Tolerant of bad data (it comes from synced JSON): an invalid time falls
 * back to 09:00 and an invalid count to the preset (0 days, 1 h, 30 min).
 */
export function reminderInstant(
  tx: Pick<Transaction, 'date' | 'time' | 'reminder'>,
  general: ReminderRule,
): string | null {
  const rule = effectiveReminderRule(general, tx.reminder);
  if (!rule) return null;

  if (rule.mode === 'days') {
    const date = toISO(addDays(parseISO(tx.date), -wholeOr(rule.days, 0)));
    return colombiaToUTC(date, parseHHMM(rule.time) ?? NINE_AM);
  }

  const { kind, value } = rule.sameDay;
  if (kind === 'at') return colombiaToUTC(tx.date, parseHHMM(value) ?? NINE_AM);
  const from = parseHHMM(tx.time) ?? NINE_AM;
  const before = kind === 'hours' ? wholeOr(value, 1) * 60 : wholeOr(value, 30);
  return colombiaToUTC(tx.date, from - before);
}

/**
 * What to write for a transaction's reminder, given what's stored locally
 * and the instant just computed. null = write nothing.
 *
 *  - No reminder any more ('none'): a still-scheduled one is dismissed, so
 *    the server never sends it; one already sent/failed is history and stays.
 *  - Same instant as stored: nothing. Re-saving would stamp a newer
 *    updatedAt, and that local copy would beat the server's 'sent' on the
 *    next sync — putting it back to 'scheduled' and sending it twice.
 *  - Otherwise (new, moved, or back from dismissed): scheduled at the instant.
 *
 * updatedAt comes back empty: localRepository.saveReminder stamps it.
 */
export function planReminder(
  txId: string,
  existing: Reminder | undefined,
  remindAt: string | null,
): Reminder | null {
  if (remindAt === null) {
    return existing?.status === 'scheduled' ? { ...existing, status: 'dismissed', updatedAt: '' } : null;
  }
  if (existing && existing.remindAt === remindAt && existing.status !== 'dismissed') return null;
  return { id: txId, transactionId: txId, remindAt, status: 'scheduled', updatedAt: '' };
}
