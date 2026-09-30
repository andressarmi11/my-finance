import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Cloudflare Turnstile on the sign-in screen: it's what keeps a script
 * from creating accounts or trying passwords in bulk.
 *
 * The site key is public and comes from the build. Without it (local
 * development, tests) there's no captcha and the screen works as before —
 * which is also why Supabase's captcha switch has to go on only after a
 * build WITH the key is live: with it on, every sign-in without a token
 * is rejected.
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window { turnstile?: Turnstile }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    // Let a later mount try again instead of caching the failure.
    s.onerror = () => { loading = null; reject(new Error('captcha')); };
    document.head.appendChild(s);
  });
  return loading;
}

export function useTurnstile(container: RefObject<HTMLDivElement | null>) {
  const [token, setToken] = useState<string | null>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !container.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widget.current = window.turnstile.render(container.current, {
          sitekey: SITE_KEY,
          size: 'flexible',
          theme: 'auto',
          language: 'auto',
          // Invisible unless Cloudflare needs a click: the screen shows its
          // own discreet "check passed" row instead (§9f).
          appearance: 'interaction-only',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
        });
      })
      .catch(() => { /* no network: the button stays waiting, Supabase would reject anyway */ });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [container]);

  /** A token works once: after any attempt, ask for a fresh one. */
  const reset = useCallback(() => {
    setToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  return { enabled: Boolean(SITE_KEY), token, reset };
}
