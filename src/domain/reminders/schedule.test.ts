import { describe, expect, it } from 'vitest';
import {
  calculateReminderTime, effectiveReminderRule, generalReminderRule, parseHHMM, planReminder, reminderInstant,
} from './schedule';
import type { Reminder, ReminderRule } from '../types';

describe('calculateReminderTime', () => {
  it('subtracts the configured days and pins the time to 9am Colombia (14:00 UTC)', () => {
    expect(calculateReminderTime('2026-09-20', 1)).toBe('2026-09-19T14:00:00.000Z');
  });

  it('with 0 days ahead, it reminds on the same day', () => {
    expect(calculateReminderTime('2026-09-20', 0)).toBe('2026-09-20T14:00:00.000Z');
  });

  it('crosses the month and the year correctly', () => {
    expect(calculateReminderTime('2026-01-01', 2)).toBe('2025-12-30T14:00:00.000Z');
  });
});

const days = (n: number, time = '09:00'): ReminderRule => ({ mode: 'days', days: n, time, sameDay: { kind: 'hours', value: 1 } });
const hours = (n: number): ReminderRule => ({ mode: 'sameDay', days: 1, time: '09:00', sameDay: { kind: 'hours', value: n } });
const minutes = (n: number): ReminderRule => ({ mode: 'sameDay', days: 1, time: '09:00', sameDay: { kind: 'minutes', value: n } });
const at = (hhmm: string): ReminderRule => ({ mode: 'sameDay', days: 1, time: '09:00', sameDay: { kind: 'at', value: hhmm } });

describe('parseHHMM', () => {
  it('reads valid times', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('09:30')).toBe(570);
    expect(parseHHMM('23:59')).toBe(1439);
  });
  it('rejects anything else', () => {
    for (const bad of ['24:00', '9:00', '12:60', '', 'nope', 900, null, undefined]) {
      expect(parseHHMM(bad)).toBeNull();
    }
  });
});

describe('generalReminderRule', () => {
  it('without settings.reminder, derives N days before at 09:00 from the old setting', () => {
    expect(generalReminderRule({ reminderDefaultDaysBefore: 3 })).toEqual({
      mode: 'days', days: 3, time: '09:00', sameDay: { kind: 'hours', value: 1 },
    });
  });
  it('settings.reminder wins over the old setting', () => {
    expect(generalReminderRule({ reminderDefaultDaysBefore: 3, reminder: hours(2) })).toEqual(hours(2));
  });
});

describe('effectiveReminderRule (override precedence)', () => {
  it('null or absent = the general one', () => {
    expect(effectiveReminderRule(days(2), null)).toEqual(days(2));
    expect(effectiveReminderRule(days(2), undefined)).toEqual(days(2));
  });
  it("'none' = no reminder, even if the general one exists", () => {
    expect(effectiveReminderRule(days(2), 'none')).toBeNull();
  });
  it("the transaction's own rule beats the general one", () => {
    expect(effectiveReminderRule(days(2), at('08:00'))).toEqual(at('08:00'));
  });
});

describe('reminderInstant', () => {
  describe('matches calculateReminderTime for the default rule (identical behaviour)', () => {
    const dates = ['2026-09-20', '2026-01-01', '2026-03-01', '2024-03-01', '2026-12-31', '2027-01-07', '2026-10-01'];
    for (let n = 0; n <= 7; n += 1) {
      it(`reminderDefaultDaysBefore = ${n}`, () => {
        const general = generalReminderRule({ reminderDefaultDaysBefore: n });
        for (const date of dates) {
          expect(reminderInstant({ date }, general)).toBe(calculateReminderTime(date, n));
          // A time on the transaction doesn't move a days-mode reminder.
          expect(reminderInstant({ date, time: '18:45' }, general)).toBe(calculateReminderTime(date, n));
          expect(reminderInstant({ date, reminder: null }, general)).toBe(calculateReminderTime(date, n));
        }
      });
    }
  });

  describe("mode 'days'", () => {
    it('N days before at the rule time', () => {
      expect(reminderInstant({ date: '2026-09-20' }, days(2, '07:30'))).toBe('2026-09-18T12:30:00.000Z');
    });
    it('an evening time lands on the next UTC day', () => {
      expect(reminderInstant({ date: '2026-09-20' }, days(1, '20:00'))).toBe('2026-09-20T01:00:00.000Z');
    });
    it('crosses the month', () => {
      expect(reminderInstant({ date: '2026-10-01' }, days(1, '09:00'))).toBe('2026-09-30T14:00:00.000Z');
    });
    it('crosses February in a leap year and in a common one', () => {
      expect(reminderInstant({ date: '2024-03-01' }, days(1))).toBe('2024-02-29T14:00:00.000Z');
      expect(reminderInstant({ date: '2026-03-01' }, days(1))).toBe('2026-02-28T14:00:00.000Z');
    });
    it('crosses the year', () => {
      expect(reminderInstant({ date: '2027-01-03' }, days(7, '08:00'))).toBe('2026-12-27T13:00:00.000Z');
    });
    it('a 23:30 reminder on Dec 31st is already next year in UTC', () => {
      expect(reminderInstant({ date: '2027-01-01' }, days(1, '23:30'))).toBe('2027-01-01T04:30:00.000Z');
    });
    it('bad data falls back to 0 days / 09:00', () => {
      expect(reminderInstant({ date: '2026-09-20' }, { ...days(1), time: 'x' })).toBe('2026-09-19T14:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20' }, { ...days(1), days: -3 })).toBe('2026-09-20T14:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20' }, { ...days(1), days: Number.NaN })).toBe('2026-09-20T14:00:00.000Z');
    });
  });

  describe("mode 'sameDay' · hours", () => {
    it('counts back from the transaction time', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '15:00' }, hours(2))).toBe('2026-09-20T18:00:00.000Z');
    });
    it('without a time, counts back from 09:00', () => {
      expect(reminderInstant({ date: '2026-09-20' }, hours(1))).toBe('2026-09-20T13:00:00.000Z');
    });
    it('an invalid time counts as 09:00', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '25:00' }, hours(1))).toBe('2026-09-20T13:00:00.000Z');
    });
    it('crossing midnight backwards lands on the previous day (and previous year)', () => {
      expect(reminderInstant({ date: '2027-01-01', time: '00:30' }, hours(1))).toBe('2027-01-01T04:30:00.000Z');
      expect(reminderInstant({ date: '2027-01-01', time: '00:30' }, hours(6))).toBe('2026-12-31T23:30:00.000Z');
    });
    it('crosses the month backwards', () => {
      expect(reminderInstant({ date: '2026-10-01', time: '02:00' }, hours(12))).toBe('2026-09-30T19:00:00.000Z');
    });
    it('0 hours = at the transaction time', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '10:15' }, hours(0))).toBe('2026-09-20T15:15:00.000Z');
    });
    it('a non-numeric value falls back to 1 hour', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '10:00' }, { ...hours(1), sameDay: { kind: 'hours', value: '02:00' } }))
        .toBe('2026-09-20T14:00:00.000Z');
    });
  });

  describe("mode 'sameDay' · minutes", () => {
    it('counts back from the transaction time', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '10:00' }, minutes(30))).toBe('2026-09-20T14:30:00.000Z');
      expect(reminderInstant({ date: '2026-09-20', time: '10:00' }, minutes(5))).toBe('2026-09-20T14:55:00.000Z');
    });
    it('without a time, counts back from 09:00', () => {
      expect(reminderInstant({ date: '2026-09-20' }, minutes(45))).toBe('2026-09-20T13:15:00.000Z');
    });
    it('more than 60 minutes still works', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '10:00' }, minutes(90))).toBe('2026-09-20T13:30:00.000Z');
    });
    it('crosses midnight backwards', () => {
      expect(reminderInstant({ date: '2026-03-01', time: '00:10' }, minutes(20))).toBe('2026-03-01T04:50:00.000Z');
    });
    it('a bad value falls back to 30 minutes', () => {
      expect(reminderInstant({ date: '2026-09-20', time: '10:00' }, minutes(-5))).toBe('2026-09-20T14:30:00.000Z');
    });
  });

  describe("mode 'sameDay' · at", () => {
    it('that clock time on the day, whatever the transaction time', () => {
      expect(reminderInstant({ date: '2026-09-20' }, at('08:00'))).toBe('2026-09-20T13:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20', time: '06:00' }, at('08:00'))).toBe('2026-09-20T13:00:00.000Z');
    });
    it('late evening is the next UTC day, also across month and year', () => {
      expect(reminderInstant({ date: '2026-09-30' }, at('21:00'))).toBe('2026-10-01T02:00:00.000Z');
      expect(reminderInstant({ date: '2026-12-31' }, at('19:00'))).toBe('2027-01-01T00:00:00.000Z');
    });
    it('midnight', () => {
      expect(reminderInstant({ date: '2026-09-20' }, at('00:00'))).toBe('2026-09-20T05:00:00.000Z');
    });
    it('an invalid clock time falls back to 09:00', () => {
      expect(reminderInstant({ date: '2026-09-20' }, { ...at('08:00'), sameDay: { kind: 'at', value: 8 } })).toBe('2026-09-20T14:00:00.000Z');
    });
  });

  describe('the mode decides, not the unused fields', () => {
    it("'days' ignores sameDay, 'sameDay' ignores days/time", () => {
      expect(reminderInstant({ date: '2026-09-20' }, { mode: 'days', days: 1, time: '09:00', sameDay: { kind: 'at', value: '06:00' } }))
        .toBe('2026-09-19T14:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20' }, { mode: 'sameDay', days: 5, time: '18:00', sameDay: { kind: 'at', value: '06:00' } }))
        .toBe('2026-09-20T11:00:00.000Z');
    });
  });

  describe('override precedence', () => {
    const general = days(1);
    it('null / absent uses the general rule', () => {
      expect(reminderInstant({ date: '2026-09-20', reminder: null }, general)).toBe('2026-09-19T14:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20' }, general)).toBe('2026-09-19T14:00:00.000Z');
    });
    it("'none' gives no reminder", () => {
      expect(reminderInstant({ date: '2026-09-20', reminder: 'none' }, general)).toBeNull();
      expect(reminderInstant({ date: '2026-09-20', time: '10:00', reminder: 'none' }, hours(1))).toBeNull();
    });
    it("the transaction's own rule beats the general one", () => {
      expect(reminderInstant({ date: '2026-09-20', time: '15:00', reminder: hours(1) }, general)).toBe('2026-09-20T19:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20', reminder: days(3, '10:00') }, hours(1))).toBe('2026-09-17T15:00:00.000Z');
    });
    it("a general same-day rule uses each transaction's time", () => {
      const g = hours(2);
      expect(reminderInstant({ date: '2026-09-20', time: '12:00' }, g)).toBe('2026-09-20T15:00:00.000Z');
      expect(reminderInstant({ date: '2026-09-20', time: '20:00' }, g)).toBe('2026-09-20T23:00:00.000Z');
    });
  });
});

describe('planReminder', () => {
  const at9 = '2026-09-19T14:00:00.000Z';
  const stored = (over: Partial<Reminder> = {}): Reminder => ({
    id: 'tx-1', transactionId: 'tx-1', remindAt: at9, status: 'scheduled', updatedAt: '2026-09-01T00:00:00.000Z', ...over,
  });

  it('creates a scheduled one when there is none', () => {
    expect(planReminder('tx-1', undefined, at9)).toEqual({
      id: 'tx-1', transactionId: 'tx-1', remindAt: at9, status: 'scheduled', updatedAt: '',
    });
  });
  it('moves it when the instant changes, even if already sent', () => {
    expect(planReminder('tx-1', stored(), '2026-09-18T14:00:00.000Z')).toMatchObject({ status: 'scheduled', remindAt: '2026-09-18T14:00:00.000Z' });
    expect(planReminder('tx-1', stored({ status: 'sent' }), '2026-09-18T14:00:00.000Z')).toMatchObject({ status: 'scheduled' });
  });
  it('same instant: writes nothing (never re-arms a sent one)', () => {
    expect(planReminder('tx-1', stored(), at9)).toBeNull();
    expect(planReminder('tx-1', stored({ status: 'sent' }), at9)).toBeNull();
    expect(planReminder('tx-1', stored({ status: 'failed' }), at9)).toBeNull();
  });
  it('same instant but dismissed (back from "none"): scheduled again', () => {
    expect(planReminder('tx-1', stored({ status: 'dismissed' }), at9)).toMatchObject({ status: 'scheduled' });
  });
  it("'none' dismisses a scheduled one and leaves history alone", () => {
    expect(planReminder('tx-1', stored(), null)).toMatchObject({ status: 'dismissed', remindAt: at9, updatedAt: '' });
    expect(planReminder('tx-1', stored({ status: 'sent' }), null)).toBeNull();
    expect(planReminder('tx-1', undefined, null)).toBeNull();
  });
});
