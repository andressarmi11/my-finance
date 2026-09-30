import { describe, expect, it } from 'vitest';
import { clamp, formatClock, reminderPreview, sameDayOption, stepTime } from './reminderRuleText';
import type { ReminderRule } from '@/domain/types';

const rule = (over: Partial<ReminderRule>): ReminderRule => ({
  mode: 'days', days: 1, time: '09:00', sameDay: { kind: 'hours', value: 1 }, ...over,
});

describe('stepTime', () => {
  it('moves half an hour', () => {
    expect(stepTime('09:00', 1)).toBe('09:30');
    expect(stepTime('09:30', 1)).toBe('10:00');
    expect(stepTime('09:00', -1)).toBe('08:30');
  });
  it('snaps an off-grid time to the next slot in that direction', () => {
    expect(stepTime('07:45', 1)).toBe('08:00');
    expect(stepTime('07:45', -1)).toBe('07:30');
    expect(stepTime('07:10', -1)).toBe('07:00');
  });
  it('clamps at 00:00 and 23:30 without wrapping', () => {
    expect(stepTime('00:00', -1)).toBe('00:00');
    expect(stepTime('23:30', 1)).toBe('23:30');
    expect(stepTime('23:45', 1)).toBe('23:30');
  });
  it('an invalid time steps from 09:00', () => {
    expect(stepTime('nope', 1)).toBe('09:30');
  });
});

describe('clamp', () => {
  it('keeps within range', () => {
    expect(clamp(0, 1, 7)).toBe(1);
    expect(clamp(9, 1, 7)).toBe(7);
    expect(clamp(3, 1, 7)).toBe(3);
  });
});

describe('formatClock', () => {
  it('12-hour clock with the suffix of each language', () => {
    expect(formatClock('08:00', 'es')).toBe('8:00 a. m.');
    expect(formatClock('08:00', 'en')).toBe('8:00 a.m.');
    expect(formatClock('13:30', 'es')).toBe('1:30 p. m.');
    expect(formatClock('00:00', 'en')).toBe('12:00 a.m.');
    expect(formatClock('12:00', 'es')).toBe('12:00 p. m.');
  });
});

describe('sameDayOption', () => {
  it('tells "1 hour" from "N hours"', () => {
    expect(sameDayOption(rule({ sameDay: { kind: 'hours', value: 1 } }))).toBe('oneHour');
    expect(sameDayOption(rule({ sameDay: { kind: 'hours', value: 2 } }))).toBe('hours');
    expect(sameDayOption(rule({ sameDay: { kind: 'minutes', value: 30 } }))).toBe('minutes');
    expect(sameDayOption(rule({ sameDay: { kind: 'at', value: '08:00' } }))).toBe('at');
  });
});

describe('reminderPreview', () => {
  it('days mode: tomorrow / in N days / today, at the rule time', () => {
    expect(reminderPreview(rule({ days: 1, time: '09:00' }))).toEqual({ at: '09:00', lead: { kind: 'tomorrow' } });
    expect(reminderPreview(rule({ days: 3, time: '18:30' }))).toEqual({ at: '18:30', lead: { kind: 'inDays', n: 3 } });
    expect(reminderPreview(rule({ days: 0 }))).toEqual({ at: '09:00', lead: { kind: 'today' } });
  });
  it('same day: counted back from 09:00, or at the exact time', () => {
    const sd = (sameDay: ReminderRule['sameDay']) => rule({ mode: 'sameDay', sameDay });
    expect(reminderPreview(sd({ kind: 'hours', value: 1 }))).toEqual({ at: '08:00', lead: { kind: 'inHours', n: 1 } });
    expect(reminderPreview(sd({ kind: 'minutes', value: 30 }))).toEqual({ at: '08:30', lead: { kind: 'inMinutes', n: 30 } });
    expect(reminderPreview(sd({ kind: 'at', value: '07:00' }))).toEqual({ at: '07:00', lead: { kind: 'today' } });
    expect(reminderPreview(sd({ kind: 'hours', value: 12 }))).toEqual({ at: '21:00', lead: { kind: 'inHours', n: 12 } });
  });
});
