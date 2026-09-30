import { useSyncExternalStore } from 'react';

/**
 * The three layouts of the redesign (§9g):
 *  - 'phone'   < 760 px: floating tab bar, bottom sheets.
 *  - 'tablet'  760–1099 px: side rail, sheets as centered dialogs.
 *  - 'desktop' ≥ 1100 px: sidebar + two-column screens.
 * One component tree for all three: this only picks the arrangement, and CSS
 * media queries in index.css do the rest wherever they can.
 */
export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export const TABLET_MIN = 760;
export const DESKTOP_MIN = 1100;

export function breakpointFor(width: number): Breakpoint {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'phone';
}

const QUERIES = [`(min-width: ${TABLET_MIN}px)`, `(min-width: ${DESKTOP_MIN}px)`];

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

function snapshot(): Breakpoint {
  if (typeof window === 'undefined') return 'phone';
  return breakpointFor(window.innerWidth);
}

/** Re-renders only when the layout crosses a breakpoint, not on every resize. */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, snapshot, () => 'phone');
}
