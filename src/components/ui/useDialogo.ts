import { useEffect, useRef } from 'react';

/**
 * What a modal dialog needs to do with the keyboard, in a single place.
 *
 * The app has eleven modal sheets and none of them did this: with Tab, focus
 * would go to the buttons BEHIND the modal, which are still there and still
 * clickable. For someone navigating with a keyboard or a screen reader,
 * the modal doesn't exist: they type inside a window and focus shows up on
 * the screen underneath. Escape didn't close it either, and on close focus
 * would get lost at the top of the page instead of returning to the button
 * that opened it.
 *
 * Three things: trap the Tab, close with Escape, and return focus.
 */
const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * `activo` is needed for dialogs that are loose JSX inside a screen that
 * never unmounts: there the effect would only run once, when the screen
 * mounts, while the dialog doesn't exist yet. Ones that are their own
 * component mount and unmount on their own and don't need to pass it.
 */
export function useDialogo<T extends HTMLElement = HTMLDivElement>(
  onCerrar: () => void,
  activeRecognizer = true,
) {
  const ref = useRef<T>(null);
  // The callback lives in a ref: otherwise every render changes its identity
  // and the effect would remount, stealing focus while the user is
  // typing.
  const closeRef = useRef(onCerrar);
  useEffect(() => {
    closeRef.current = onCerrar;
  });

  useEffect(() => {
    if (!activeRecognizer) return;
    const node = ref.current;
    if (!node) return;

    // Where to return to on close: almost always the button that opened this.
    const previous = document.activeElement as HTMLElement | null;

    // Respects an autoFocus that already put focus inside; if there isn't one,
    // it moves it to the first control, and if there's none, to the container.
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>(FOCUSABLES);
      if (first) {
        first.focus();
      } else {
        node.tabIndex = -1;
        node.focus();
      }
    }

    function visibleNodes(node: HTMLElement): HTMLElement[] {
      // offsetParent discards what's hidden; a control inside a
      // collapsed section shouldn't receive focus.
      return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLES))
        .filter((el) => el.offsetParent !== null);
    }

    function onKeyDown(e: KeyboardEvent) {
      const current = ref.current;
      if (!current) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        // stopPropagation: with two modals open, Escape closes the top
        // one, not both at once.
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const list = visibleNodes(current);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }

      // Full control of Tab is taken here, not just the endpoints.
      //
      // Fixing only the first and last is enough in Chrome, but
      // not in Safari —which is where this app lives—: WebKit sends focus to
      // the <body> BETWEEN one control and the next, and that happens after this
      // event, so there's no way to fix it in time. By moving
      // focus by hand, the path is the same across every browser and
      // it never leaves the dialog, not even briefly.
      e.preventDefault();
      const actualIdx = list.indexOf(document.activeElement as HTMLElement);
      const next = actualIdx === -1
        ? 0
        : (actualIdx + (e.shiftKey ? -1 : 1) + list.length) % list.length;
      list[next]!.focus();
    }

    // In the capture phase: this way it arrives before any handler on the screen.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // isConnected: if whatever opened the modal is no longer in the DOM,
      // focusing it does nothing and throws focus to the body.
      if (previous?.isConnected) previous.focus();
    };
  }, [activeRecognizer]);

  return ref;
}
