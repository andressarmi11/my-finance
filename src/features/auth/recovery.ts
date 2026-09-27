import { useSyncExternalStore } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/data/supabase/client';

/**
 * "Change password" mode, the one that activates when opening the
 * "forgot my password" link.
 *
 * It has two traps, and both were hit:
 *
 * 1. The recovery link OPENS A SESSION. Since AuthGate showed the app
 *    as soon as there was a session, you'd go straight in and it would never ask for the
 *    new password. That's why this state is checked BEFORE the session.
 *
 * 2. supabase-js processes the token and clears the URL while building the client.
 *    Subscribing to onAuthStateChange inside getSupabase()'s .then()
 *    arrives too late: the PASSWORD_RECOVERY event has already happened. That's why the URL
 *    is read when the module loads, synchronously, before anything else runs.
 */

/** Is this URL a recovery link? Pure, so it can be tested. */
export function isRecoveryUrl(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  // Implicit flow: the token comes in the fragment (#access_token=...&type=recovery).
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  if (fragment.get('type') === 'recovery') return true;
  // PKCE flow: ?code=...&type=recovery
  return url.searchParams.get('type') === 'recovery';
}

let inRecovery =
  typeof window !== 'undefined' && isRecoveryUrl(window.location.href);

const listeners = new Set<() => void>();

function notify() {
  for (const o of listeners) o();
}

export function enterRecovery(): void {
  if (inRecovery) return;
  inRecovery = true;
  notify();
}

/** Called when done changing the password, or when cancelling. */
export function exitRecovery(): void {
  if (!inRecovery) return;
  inRecovery = false;
  // Without this, reloading the page re-enters recovery mode
  // because the token is still in the URL.
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname);
  }
  notify();
}

/** Second path in case the URL already came clean: the supabase-js event. */
if (isSupabaseConfigured() && typeof window !== 'undefined') {
  void getSupabase().then((supabase) => {
    supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') enterRecovery();
    });
  });
}

export function useRecoveryMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => inRecovery,
    () => false, // in SSR there's never a recovery
  );
}
