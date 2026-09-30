import { beforeEach, describe, expect, it } from 'vitest';

/* The vitest environment is 'node' (see vite.config.ts), so there is no
   localStorage. It's mocked here instead of adding jsdom as a dependency
   for a single test file. */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

beforeEach(() => store.clear());

import { toggleHidden, readChartLayout, readCollapsed, saveCollapsed, move, DEFAULT_ORDER, type ChartId } from './chartLayout';

describe('mover', () => {
  const order: ChartId[] = ['spend-by-category', 'budgets', 'fixed-vs-variable'];

  it('moves a chart up one position', () => {
    expect(move(order, 'budgets', -1)).toEqual(['budgets', 'spend-by-category', 'fixed-vs-variable']);
  });

  it('moves a chart down one position', () => {
    expect(move(order, 'budgets', 1)).toEqual(['spend-by-category', 'fixed-vs-variable', 'budgets']);
  });

  it('the first one cannot move up and the last one cannot move down', () => {
    expect(move(order, 'spend-by-category', -1)).toEqual(order);
    expect(move(order, 'fixed-vs-variable', 1)).toEqual(order);
  });

  it("doesn't crash with an id that isn't there", () => {
    expect(move(order, 'by-method', -1)).toEqual(order);
  });
});

describe('alternarOculto', () => {
  it('hides and shows again', () => {
    const one = toggleHidden([], 'by-method');
    expect(one).toEqual(['by-method']);
    expect(toggleHidden(one, 'by-method')).toEqual([]);
  });
});

describe('leerDisposicion', () => {
  it('with nothing saved returns the factory order', () => {
    localStorage.clear();
    expect(readChartLayout().order).toEqual(DEFAULT_ORDER);
  });

  /* The case that matters as the app evolves: someone arranged their
     order months ago and a new chart got added afterward. Without
     reconciling, that chart would stay invisible forever. */
  it("appends at the end the charts that weren't there when it was saved", () => {
    localStorage.setItem('step-up:analytics-layout',
      JSON.stringify({ order: ['by-method', 'spend-by-category'], hiddenIds: [] }));
    const { order } = readChartLayout();
    expect(order.slice(0, 2)).toEqual(['by-method', 'spend-by-category']);
    expect(order).toHaveLength(DEFAULT_ORDER.length);
    expect(new Set(order)).toEqual(new Set(DEFAULT_ORDER));
  });

  it('discards ids that no longer exist', () => {
    localStorage.setItem('step-up:analytics-layout',
      JSON.stringify({ order: ['fantasma', 'budgets'], hiddenIds: ['otro-fantasma'] }));
    const d = readChartLayout();
    expect(d.order).not.toContain('fantasma');
    expect(d.hiddenIds).toEqual([]);
  });

  it("corrupt JSON doesn't break the screen", () => {
    localStorage.setItem('step-up:analytics-layout', '{roto');
    expect(readChartLayout().order).toEqual(DEFAULT_ORDER);
  });
});

describe('ids from before the redesign', () => {
  it('map onto the new cards, in the order the user had', () => {
    localStorage.setItem('step-up:analytics-layout', JSON.stringify({
      order: ['debit-vs-credit', 'distribution', 'budgets', 'balance-by-category', 'income-vs-expenses', 'fixed-vs-variable'],
      hiddenIds: [],
    }));
    expect(readChartLayout().order).toEqual(['by-method', 'spend-by-category', 'budgets', 'fixed-vs-variable']);
  });

  it('a merged card stays visible unless everything it replaced was hidden', () => {
    localStorage.setItem('step-up:analytics-layout', JSON.stringify({ order: [], hiddenIds: ['distribution'] }));
    expect(readChartLayout().hiddenIds).toEqual([]);
    localStorage.setItem('step-up:analytics-layout', JSON.stringify({ order: [], hiddenIds: ['distribution', 'balance-by-category', 'debit-vs-credit'] }));
    expect(readChartLayout().hiddenIds).toEqual(['spend-by-category', 'by-method']);
  });
});

describe('folded cards', () => {
  it('survive a save and read, and ignore junk', () => {
    saveCollapsed(['budgets', 'by-method']);
    expect(readCollapsed()).toEqual(['budgets', 'by-method']);
    localStorage.setItem('analytics.collapsed', '{roto');
    expect(readCollapsed()).toEqual([]);
  });
});
