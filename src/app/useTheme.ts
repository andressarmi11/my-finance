import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localRepository } from '@/data/local/localRepository';

/** Applies the saved theme to <html>. 'system' = removes the attribute. */
export function useTheme() {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const theme = settings?.theme ?? 'system';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return theme;
}
