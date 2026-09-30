/**
 * The pure half of ReminderRuleEditor: the stepper arithmetic, the clock
 * format and what the notification preview says. Kept apart from the
 * component so it's unit-tested (the test environment has no DOM).
 */
import { DEFAULT_REMINDER_TIME, parseHHMM } from '@/domain/reminders/schedule';
import type { ReminderRule } from '@/domain/types';

export const DAYS_RANGE = { min: 1, max: 7 } as const;
export const HOURS_RANGE = { min: 2, max: 12 } as const;
export const MINUTES_RANGE = { min: 5, max: 55, step: 5 } as const;
/** Time steppers move in half hours (§9f). */
export const TIME_STEP_MINUTES = 30;
const LAST_SLOT = 24 * 60 - TIME_STEP_MINUTES; // 23:30

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * One half-hour step up or down, clamped to 00:00-23:30 (no wrap: 23:30 + 30
 * min would be "the day before" for a reminder). A time off the grid
 * ('07:45') snaps to the next slot in that direction.
 */
export function stepTime(time: string, direction: 1 | -1): string {
  const m = parseHHMM(time) ?? parseHHMM(DEFAULT_REMINDER_TIME)!;
  const next = direction > 0
    ? Math.floor(m / TIME_STEP_MINUTES) * TIME_STEP_MINUTES + TIME_STEP_MINUTES
    : Math.ceil(m / TIME_STEP_MINUTES) * TIME_STEP_MINUTES - TIME_STEP_MINUTES;
  return hhmm(Math.min(LAST_SLOT, Math.max(0, next)));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** '08:00' → '8:00 a. m.' (es) / '8:00 a.m.' (en). An invalid time shows as 9:00. */
export function formatClock(time: string, language: 'es' | 'en'): string {
  const m = parseHHMM(time) ?? parseHHMM(DEFAULT_REMINDER_TIME)!;
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const am = h < 12;
  const suffix = language === 'es' ? (am ? 'a. m.' : 'p. m.') : (am ? 'a.m.' : 'p.m.');
  return `${h12}:${String(m % 60).padStart(2, '0')} ${suffix}`;
}

/** Which of the four same-day radios a rule is on. "1 hour" and "N hours" share kind 'hours'. */
export type SameDayOption = 'oneHour' | 'hours' | 'minutes' | 'at';
export function sameDayOption(rule: ReminderRule): SameDayOption {
  const { kind, value } = rule.sameDay;
  if (kind === 'hours') return value === 1 ? 'oneHour' : 'hours';
  return kind;
}

/**
 * What the preview notification says and when it would arrive, for a
 * transaction with no time of its own (so same-day counts from 09:00, as the
 * real schedule does).
 */
export type PreviewLead =
  | { kind: 'tomorrow' } | { kind: 'inDays'; n: number }
  | { kind: 'inHours'; n: number } | { kind: 'inMinutes'; n: number } | { kind: 'today' };
export function reminderPreview(rule: ReminderRule): { at: string; lead: PreviewLead } {
  const nine = parseHHMM(DEFAULT_REMINDER_TIME)!;
  if (rule.mode === 'days') {
    const days = Math.max(0, Math.floor(rule.days) || 0);
    const at = hhmm(parseHHMM(rule.time) ?? nine);
    if (days === 0) return { at, lead: { kind: 'today' } };
    return { at, lead: days === 1 ? { kind: 'tomorrow' } : { kind: 'inDays', n: days } };
  }
  const { kind, value } = rule.sameDay;
  if (kind === 'at') return { at: hhmm(parseHHMM(value) ?? nine), lead: { kind: 'today' } };
  const n = typeof value === 'number' && value >= 0 ? Math.floor(value) : kind === 'hours' ? 1 : 30;
  const back = kind === 'hours' ? n * 60 : n;
  // 10+ hours back from 09:00 is the evening before: wrap the clock, the
  // lead ("vence en 12 horas") already says how far ahead it is.
  const at = hhmm((((nine - back) % 1440) + 1440) % 1440);
  return { at, lead: kind === 'hours' ? { kind: 'inHours', n } : { kind: 'inMinutes', n } };
}
