import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPreset, clampOpacity, NAV_BAR_DEFAULT, navBarVars, presetOf, readNavBar, saveNavBar } from './navBar';

describe('navBarVars (BARRA.md)', () => {
  it('100: solid, no backdrop-filter', () => {
    const v = navBarVars({ opacity: 100, fabGlass: false });
    expect(v['--nav-bg']).toBe('var(--surface)');
    expect(v['--nav-filter']).toBe('none');
    expect(v['--nav-border']).toBe('var(--line-strong)');
  });

  it('88: translucent, blur 20', () => {
    const v = navBarVars({ opacity: 88, fabGlass: false });
    expect(v['--nav-bg']).toBe('color-mix(in srgb, var(--surface) 88%, transparent)');
    expect(v['--nav-filter']).toBe('blur(20px) saturate(140%)');
    expect(v['--nav-active']).toBe('color-mix(in srgb, var(--line-strong) 88%, transparent)');
  });

  it('40: glass — stronger blur, light edge, top highlight', () => {
    const v = navBarVars({ opacity: 40, fabGlass: false });
    expect(v['--nav-filter']).toBe('blur(26px) saturate(180%)');
    expect(v['--nav-border']).toBe('var(--nav-glass-border)');
    expect(v['--nav-shadow']).toContain('inset 0 1px 0 var(--nav-glass-highlight)');
    // The active pill never gets fainter than 60 %.
    expect(v['--nav-active']).toContain('60%');
  });

  it('with prefers-reduced-transparency it is solid whatever was chosen', () => {
    const v = navBarVars({ opacity: 40, fabGlass: true }, { reducedTransparency: true });
    expect(v['--nav-filter']).toBe('none');
    expect(v['--nav-bg']).toBe('var(--surface)');
    expect(v['--fab-bg']).toBe('var(--q10)');
  });

  it('the + takes the glass only when asked and the bar is not solid', () => {
    expect(navBarVars({ opacity: 40, fabGlass: true })['--fab-color']).toBe('var(--q10)');
    expect(navBarVars({ opacity: 40, fabGlass: false })['--fab-bg']).toBe('var(--q10)');
    expect(navBarVars({ opacity: 100, fabGlass: true })['--fab-bg']).toBe('var(--q10)');
  });
});

describe('presets and the slider', () => {
  it('a shortcut sets the opacity; Glass turns the + on, Solid off, Translucent keeps it', () => {
    expect(applyPreset({ opacity: 70, fabGlass: false }, 'glass')).toEqual({ opacity: 40, fabGlass: true });
    expect(applyPreset({ opacity: 40, fabGlass: true }, 'solid')).toEqual({ opacity: 100, fabGlass: false });
    expect(applyPreset({ opacity: 40, fabGlass: true }, 'translucent')).toEqual({ opacity: 88, fabGlass: true });
  });

  it('a value between shortcuts selects none', () => {
    expect(presetOf(88)).toBe('translucent');
    expect(presetOf(63)).toBeNull();
  });

  it('the slider stays within 15–100', () => {
    expect(clampOpacity(3)).toBe(15);
    expect(clampOpacity(140)).toBe(100);
    expect(clampOpacity(Number.NaN)).toBe(88);
  });
});

describe('persistence', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to Translúcida, 88 %, the + solid', () => {
    expect(readNavBar()).toEqual(NAV_BAR_DEFAULT);
  });

  it('saves and reads back, cleaning bad values', () => {
    saveNavBar({ opacity: 40, fabGlass: true });
    expect(readNavBar()).toEqual({ opacity: 40, fabGlass: true });
    store.set('stepup.navBar', '{"opacity":"x"}');
    expect(readNavBar()).toEqual({ opacity: 88, fabGlass: false });
  });
});
