import { describe, expect, it } from 'vitest';
import { categoryColor, UNCATEGORIZED_COLOR } from './categoryColor';
import { DEFAULT_CATEGORIES } from './defaultCategories';

describe('categoryColor', () => {
  it('seeded categories are painted with their token, so dark mode works', () => {
    expect(categoryColor({ id: 'cat-hogar', color: '#C24976' })).toBe('var(--cat-hogar)');
    expect(categoryColor({ id: 'cat-ahorro', color: '#B54D98' })).toBe('var(--cat-ahorro)');
  });

  it('every seeded one has a token, except "Others"', () => {
    for (const c of DEFAULT_CATEGORIES) {
      // 'Others' is neutral grey on purpose: it isn't a topic, it's the
      // drawer for whatever doesn't fit, and it shouldn't compete for
      // attention in a chart.
      if (c.id === 'cat-otros') {
        expect(categoryColor(c)).toBe(c.color);
        continue;
      }
      expect(categoryColor(c), c.id).toBe(`var(--${c.id})`);
    }
  });

  it('a category the user created uses its own colour', () => {
    expect(categoryColor({ id: 'abc-123', color: '#FF00FF' })).toBe('#FF00FF');
  });

  it("with no category it doesn't invent a colour", () => {
    expect(categoryColor(null)).toBe(UNCATEGORIZED_COLOR);
    expect(categoryColor(undefined)).toBe(UNCATEGORIZED_COLOR);
  });
});

describe('category palette', () => {
  it('no two share a colour', () => {
    const colors = DEFAULT_CATEGORIES.map((c) => c.color.toUpperCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('none uses the reserved pay-period or status colours', () => {
    // Health used to be red (#E05B5B) and Savings green (#1E8E6A): a
    // category read as a status.
    const reserved = ['#007AFF', '#FF9500', '#34C759', '#FF3B30'];
    for (const c of DEFAULT_CATEGORIES) {
      expect(reserved).not.toContain(c.color.toUpperCase());
    }
  });

  it('todas tienen contraste >= 3:1 contra blanco (WCAG 1.4.11)', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
    };
    for (const c of DEFAULT_CATEGORIES) {
      if (c.id === 'cat-otros') continue; // gris neutro a propósito
      const ratio = (1.05) / (lum(c.color) + 0.05);
      expect(ratio, `${c.id} ${c.color}`).toBeGreaterThanOrEqual(3);
    }
  });
});
