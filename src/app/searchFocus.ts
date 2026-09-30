/**
 * ⌘K / Ctrl+K on desktop (§9g): focus the Movimientos search in Inicio's
 * header. The shortcut lives in AppLayout (it works from any screen), the
 * input in Inicio — which may not be mounted yet when the keys are pressed.
 * So the request is left here, and Inicio takes it when it mounts, or
 * right away through the event if it's already on screen.
 */
export const SEARCH_INPUT_ID = 'desktop-search';
const EVENT = 'stepup:focus-search';

let pending = false;

export function requestSearchFocus(): void {
  const input = document.getElementById(SEARCH_INPUT_ID);
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
    return;
  }
  pending = true;
  window.dispatchEvent(new Event(EVENT));
}

/** True once if a focus was requested before the input existed. */
export function consumeSearchFocus(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function onSearchFocusRequest(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** The shortcut itself: ⌘K on a Mac, Ctrl+K elsewhere. */
export function isSearchShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
}
