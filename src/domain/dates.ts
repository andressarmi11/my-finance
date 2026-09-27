/**
 * Date kernel. All the rest of the domain goes through here for
 * month/day arithmetic. Uses exclusively UTC methods of Date
 * (never local methods) so the result doesn't depend on the
 * timezone of whoever runs the code.
 */
import type { ISODate } from './types';

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseISO(date: ISODate): YMD {
  const parts = date.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Fecha ISO invalida: "${date}" (se esperaba 'YYYY-MM-DD')`);
  }
  return { y, m, d };
}

export function toISO({ y, m, d }: YMD): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Last day of month m (1-12) of year y. Handles leap years automatically. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Clamps day to the month's valid range, never produces a non-existent day. */
export function clampDay(y: number, m: number, day: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(y, m));
}

/** Adds (or subtracts) months exactly, without native Date's "overflow". */
export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + delta;
  const y2 = Math.floor(total / 12);
  const m2 = total - y2 * 12 + 1;
  return { y: y2, m: m2 };
}

export function addDays(ymd: YMD, days: number): YMD {
  const base = Date.UTC(ymd.y, ymd.m - 1, ymd.d);
  const shifted = new Date(base + days * 86_400_000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekdayOf({ y, m, d }: YMD): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday .. 6 Saturday
}
