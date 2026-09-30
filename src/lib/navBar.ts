import { useEffect, useState } from 'react';

/**
 * How see-through the floating tab bar is (BARRA.md): Settings.navBar.
 *
 * Kept in localStorage, not in the synced Settings: like the language, it's
 * a property of this screen, not of the account. It's applied in main.tsx
 * before React paints, so the bar never flashes another style.
 *
 * Only the phone's tab bar (and the tablet rail's +) reads it; the desktop
 * sidebar doesn't.
 */
export interface NavBarSettings {
  /** 15..100. 100 = solid. */
  opacity: number;
  /** The + takes the bar's glass instead of solid --q10. */
  fabGlass: boolean;
}

export const NAV_BAR_DEFAULT: NavBarSettings = { opacity: 88, fabGlass: false };
export const NAV_BAR_MIN = 15;

/** The three shortcuts: they set the opacity (and Glass/Solid the +). */
export const NAV_PRESETS = { solid: 100, translucent: 88, glass: 40 } as const;
export type NavPreset = keyof typeof NAV_PRESETS;

/** At or below this it's Glass: stronger blur, light edge, top highlight. */
const GLASS_MAX = 55;

const STORAGE_KEY = 'stepup.navBar';
const CHANGE_EVENT = 'stepup:navbar';

export function clampOpacity(n: number): number {
  if (!Number.isFinite(n)) return NAV_BAR_DEFAULT.opacity;
  return Math.max(NAV_BAR_MIN, Math.min(100, Math.round(n)));
}

/** The shortcut an opacity corresponds to, or null for a slider value in between. */
export function presetOf(opacity: number): NavPreset | null {
  const hit = (Object.keys(NAV_PRESETS) as NavPreset[]).find((k) => NAV_PRESETS[k] === opacity);
  return hit ?? null;
}

/** Choosing a shortcut: Glass turns the + glass too, Solid turns it off. */
export function applyPreset(current: NavBarSettings, preset: NavPreset): NavBarSettings {
  return {
    opacity: NAV_PRESETS[preset],
    fabGlass: preset === 'glass' ? true : preset === 'solid' ? false : current.fabGlass,
  };
}

export function readNavBar(): NavBarSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NAV_BAR_DEFAULT;
    const v = JSON.parse(raw) as Partial<NavBarSettings>;
    return { opacity: clampOpacity(Number(v.opacity)), fabGlass: v.fabGlass === true };
  } catch {
    return NAV_BAR_DEFAULT;
  }
}

export function saveNavBar(next: NavBarSettings): void {
  const clean = { opacity: clampOpacity(next.opacity), fabGlass: next.fabGlass };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch { /* private mode: this session only */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: clean }));
}

/**
 * The CSS the bar and the + read (--nav-*, --fab-*). Pure: the colours are
 * tokens, so light and dark come from tokens.css, not from here.
 *
 *  100      solid surface, no backdrop-filter
 *  56–99    translucent: blur(20px) saturate(140%)
 *  ≤55      glass: blur(26px) saturate(180%), light edge, top highlight
 *
 * `reducedTransparency` (prefers-reduced-transparency: reduce) forces 100.
 */
export function navBarVars(s: NavBarSettings, opts: { reducedTransparency?: boolean } = {}): Record<string, string> {
  const o = opts.reducedTransparency ? 100 : clampOpacity(s.opacity);
  const solid = o >= 100;
  const glass = o <= GLASS_MAX;
  const bg = solid ? 'var(--surface)' : `color-mix(in srgb, var(--surface) ${o}%, transparent)`;
  const filter = solid ? 'none' : glass ? 'blur(26px) saturate(180%)' : 'blur(20px) saturate(140%)';
  const border = glass ? 'var(--nav-glass-border)' : 'var(--line-strong)';
  const shadow = glass
    ? 'inset 0 1px 0 var(--nav-glass-highlight), 0 10px 30px var(--nav-glass-drop)'
    : 'var(--shadow-3)';
  const fabGlass = s.fabGlass && !solid;
  return {
    '--nav-bg': bg,
    '--nav-filter': filter,
    '--nav-border': border,
    '--nav-shadow': shadow,
    '--nav-active': solid ? 'var(--line-strong)' : `color-mix(in srgb, var(--line-strong) ${Math.max(o, 60)}%, transparent)`,
    // Over whatever shows through, the idle tabs need more contrast than --text-faint.
    '--nav-ink': glass ? 'var(--text-muted)' : 'var(--text-faint)',
    '--fab-bg': fabGlass ? bg : 'var(--q10)',
    '--fab-color': fabGlass ? 'var(--q10)' : 'var(--on-accent)',
    '--fab-border': fabGlass ? border : 'transparent',
    '--fab-shadow': fabGlass ? shadow : '0 10px 30px color-mix(in srgb, var(--q10) 35%, transparent)',
    '--fab-filter': fabGlass ? filter : 'none',
  };
}

function reducedTransparency(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  } catch {
    return false;
  }
}

/** Writes the variables on <html>. Called before the first paint and on every change. */
export function applyNavBar(s: NavBarSettings = readNavBar()): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(navBarVars(s, { reducedTransparency: reducedTransparency() }))) {
    root.style.setProperty(k, v);
  }
}

/** The setting, live: the Ajustes screen changes it, the bar follows. */
export function useNavBar(): [NavBarSettings, (next: NavBarSettings) => void] {
  const [value, setValue] = useState<NavBarSettings>(readNavBar);
  useEffect(() => {
    const onChange = () => setValue(readNavBar());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return [value, saveNavBar];
}

/**
 * The variables for the current setting, applied to <html> and returned (the
 * settings preview draws them inline). Follows prefers-reduced-transparency
 * as it changes.
 */
export function useNavBarStyle(): Record<string, string> {
  const [settings] = useNavBar();
  const [reduced, setReduced] = useState(reducedTransparency);
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia('(prefers-reduced-transparency: reduce)'); } catch { return; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  const vars = navBarVars(settings, { reducedTransparency: reduced });
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    // Serialized so the effect runs when a value changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(vars)]);
  return vars;
}
