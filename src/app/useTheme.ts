import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localRepository } from '@/data/local/localRepository';

/**
 * Applies the saved theme to <html>. 'system' = removes the attribute.
 *
 * A change after the first paint cross-fades (redesign §9e): the root gets
 * `theme-switching` for a moment, which index.css turns into a 350ms
 * transition on background, text and border colours. Not on first load —
 * opening the app must not fade in from the other theme.
 */
export function useTheme() {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const theme = settings?.theme ?? 'system';
  // Until Settings has loaded the theme is a placeholder: the real one
  // arriving is not a "change".
  const loaded = settings !== undefined;
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const animate = loaded && applied.current !== null && applied.current !== theme;
    if (loaded) applied.current = theme;
    if (animate) root.classList.add('theme-switching');
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    if (!animate) return;
    const id = window.setTimeout(() => root.classList.remove('theme-switching'), 400);
    return () => {
      window.clearTimeout(id);
      root.classList.remove('theme-switching');
    };
  }, [theme, loaded]);

  return theme;
}
