/**
 * Works out WHEN a transaction's reminder should fire.
 * Pure: it takes the transaction's date and how many days ahead to warn,
 * and returns an ISO datetime in UTC at a fixed, sensible hour (9:00 am
 * Colombia time = 14:00 UTC, no daylight saving).
 */
import { addDays, parseISO, toISO } from '../dates';
import type { ISODate } from '../types';

const REMINDER_HOUR_UTC = 14; // 9:00 am America/Bogota (UTC-5, no DST)

export function calculateReminderTime(transactionDate: ISODate, daysBefore: number): string {
  const remindDate = addDays(parseISO(transactionDate), -daysBefore);
  const iso = toISO(remindDate);
  return `${iso}T${String(REMINDER_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
}
