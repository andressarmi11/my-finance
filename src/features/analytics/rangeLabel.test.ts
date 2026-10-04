import { afterEach, describe, expect, it } from 'vitest';
import { setMonthNames } from '@/components/ui/MonthNav';
import { setShortMonthNames } from '@/lib/formatShortDate';
import { describeRange, heroRangeLabel, rangeDays, shortRangeLabel, widestRangeLabel } from './rangeLabel';

function inLanguage(language: 'es' | 'en') {
  setMonthNames(language);
  setShortMonthNames(language);
}
afterEach(() => inLanguage('es'));

const PAY = [10, 25];

describe('period labels follow the language and capitalise months', () => {
  it('Spanish', () => {
    inLanguage('es');
    expect(describeRange('mes', '2026-08-14', PAY)).toBe('Agosto 2026');
    expect(describeRange('trimestre', '2026-11-02', PAY)).toBe('Oct – Dic 2026');
    expect(describeRange('año', '2026-03-01', PAY)).toBe('2026');
    expect(describeRange('quincena', '2026-09-26', PAY)).toBe('25 Sep – 9 Oct');
  });

  it('English — no Spanish left behind', () => {
    inLanguage('en');
    expect(describeRange('mes', '2026-08-14', PAY)).toBe('August 2026');
    expect(describeRange('trimestre', '2026-11-02', PAY)).toBe('Oct – Dec 2026');
    expect(describeRange('año', '2026-03-01', PAY)).toBe('2026');
    expect(describeRange('quincena', '2026-09-26', PAY)).toBe('Sep 25 – Oct 9');
  });

  it('every label starts with a capital or a digit', () => {
    for (const language of ['es', 'en'] as const) {
      inLanguage(language);
      for (let m = 1; m <= 12; m++) {
        const day = `2026-${String(m).padStart(2, '0')}-15`;
        for (const range of ['mes', 'trimestre', 'quincena'] as const) {
          const label = describeRange(range, day, PAY);
          expect(label).toMatch(/^(\p{Lu}|\d)/u);
          // Every month word is capitalised, not only the first.
          for (const word of label.match(/\p{L}+/gu) ?? []) expect(word[0]).toBe(word[0]!.toUpperCase());
        }
      }
    }
  });
});

describe('the reserved width sample has the shape of the widest label', () => {
  it('uses a deliberately wide month for the short-month ranges', () => {
    expect(widestRangeLabel('trimestre')).toBe('Mmm – Mmm 0000');
    expect(widestRangeLabel('quincena')).toBe('00 Mmm – 00 Mmm');
    expect(widestRangeLabel('año')).toBe('0000');
  });
});

describe('paid on the 30th, the month is named like on Inicio, with its real days', () => {
  it('October 4th is "Octubre", 30 Sep – 29 Oct', () => {
    inLanguage('es');
    expect(describeRange('mes', '2026-10-04', [30])).toBe('Octubre 2026');
    expect(shortRangeLabel('mes', '2026-10-04', [30])).toBe('Oct 2026');
    expect(heroRangeLabel('mes', '2026-10-04', [30])).toBe('Octubre');
    expect(rangeDays('mes', '2026-10-04', [30])).toBe('30 Sep – 29 Oct');
    expect(describeRange('trimestre', '2026-10-04', [30])).toBe('Oct – Dic 2026');
  });

  it('calendar months need no days line', () => {
    expect(rangeDays('mes', '2026-10-04', [1])).toBe('');
    expect(rangeDays('quincena', '2026-10-04', [10, 25])).toBe('');
  });
});
