import { describe, expect, it } from 'vitest';
import { addDays, clampDay, daysInMonth, parseISO, shiftMonth, toISO } from './dates';

describe('daysInMonth', () => {
  it('recognises leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29); // leap year
    expect(daysInMonth(2026, 2)).toBe(28); // not a leap year
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('clampDay', () => {
  it('never produces a non-existent day', () => {
    expect(clampDay(2026, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 31)).toBe(29);
    expect(clampDay(2026, 4, 31)).toBe(30);
    expect(clampDay(2026, 1, 15)).toBe(15);
  });
});

describe('shiftMonth', () => {
  it('crosses a year boundary forward', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
  });
  it('crosses a year boundary backward', () => {
    expect(shiftMonth(2027, 1, -1)).toEqual({ y: 2026, m: 12 });
  });
  it('advances several months at once', () => {
    expect(shiftMonth(2026, 10, 4)).toEqual({ y: 2027, m: 2 });
  });
});

describe('addDays / toISO / parseISO', () => {
  it('crosses a month boundary correctly', () => {
    expect(toISO(addDays(parseISO('2026-01-31'), 1))).toBe('2026-02-01');
  });
  it('crosses a year boundary correctly', () => {
    expect(toISO(addDays(parseISO('2026-12-31'), 1))).toBe('2027-01-01');
  });
  it('subtracts days without producing day 0', () => {
    expect(toISO(addDays(parseISO('2026-03-01'), -1))).toBe('2026-02-28');
  });
  it('parseISO/toISO are inverses', () => {
    expect(toISO(parseISO('2026-09-17'))).toBe('2026-09-17');
  });
});
