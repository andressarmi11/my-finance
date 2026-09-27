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

import { toggleHidden, readChartLayout, move, DEFAULT_ORDER, type ChartId } from './chartLayout';

describe('mover', () => {
  const order: ChartId[] = ['balance-by-category', 'budgets', 'distribution'];

  it('moves a chart up one position', () => {
    expect(move(order, 'budgets', -1)).toEqual(['budgets', 'balance-by-category', 'distribution']);
  });

  it('moves a chart down one position', () => {
    expect(move(order, 'budgets', 1)).toEqual(['balance-by-category', 'distribution', 'budgets']);
  });

  it('the first one cannot move up and the last one cannot move down', () => {
    expect(move(order, 'balance-by-category', -1)).toEqual(order);
    expect(move(order, 'distribution', 1)).toEqual(order);
  });

  it("doesn't crash with an id that isn't there", () => {
    expect(move(order, 'debit-vs-credit', -1)).toEqual(order);
  });
});

describe('alternarOculto', () => {
  it('hides and shows again', () => {
    const one = toggleHidden([], 'distribution');
    expect(one).toEqual(['distribution']);
    expect(toggleHidden(one, 'distribution')).toEqual([]);
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
      JSON.stringify({ order: ['distribution', 'balance-by-category'], hiddenIds: [] }));
    const { order } = readChartLayout();
    expect(order.slice(0, 2)).toEqual(['distribution', 'balance-by-category']);
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
