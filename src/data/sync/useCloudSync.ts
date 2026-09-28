import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../supabase/client';
import { useSession } from '@/features/auth/useSession';
import { syncBidirectional } from './syncService';
import { ensureOwner } from './owner';
import { translate } from '@/i18n/language';

export type SyncStatus = 'inactivo' | 'sincronizando' | 'ok' | 'error';

const MIN_ENTRE_SYNCS_MS = 60_000;

/**
 * Force a push from outside the React tree.
 *
 * Needed because the automatic sync only runs on entry, on returning to
 * the app, and on leaving it — and the initial setup gets completed in
 * between. The push that uploads Settings happens ON ENTRY, i.e. before
 * the setup exists, so it uploaded onboardedAt = null; after that,
 * nothing pushed it again until the browser fired a visibilitychange,
 * which, if the tab gets closed abruptly, might never arrive. The
 * result: every login on a new device asked for name, currency and
 * categories all over again.
 */
let currentForceSync: (() => void) | null = null;

export function requestSync(): void {
  currentForceSync?.();
}

/**
 * Syncs on its own, without the user touching a button.
 *
 * When: on login, on returning to the app (visibilitychange), and on
 * leaving it. That's the cycle that makes "I open the app on another
 * device and everything's there" true — with only the manual buttons in
 * Settings, forgetting once was enough to lose a whole day's work.
 *
 * The manual buttons still exist to force a sync.
 */
export function useCloudSync() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const [status, setStatus] = useState<SyncStatus>('inactivo');
  const [error, setError] = useState('');
  // The first pull has to finish before deciding whether to show the
  // initial setup: otherwise a new device asks for it again even though
  // the account is already configured in the cloud.
  const [firstSyncDone, setPrimeraHecha] = useState(!isSupabaseConfigured());
  const lastRef = useRef(0);
  const runningRef = useRef(false);

  const sync = useCallback(async (forzar = false) => {
    if (!isSupabaseConfigured() || !userId) return;
    if (runningRef.current) return;

    runningRef.current = true;
    try {
      // FIRST thing, even with no network: if what's stored on this
      // device belongs to another account, it gets wiped before the app
      // shows it or push uploads it to the wrong account. It's local,
      // needs no internet, and can't be left behind any return.
      await ensureOwner(userId);

      if (!forzar && Date.now() - lastRef.current < MIN_ENTRE_SYNCS_MS) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      setStatus('sincronizando');
      setError('');
      await syncBidirectional();
      lastRef.current = Date.now();
      setStatus('ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : translate('sync.couldNotSync'));
      setStatus('error');
    } finally {
      runningRef.current = false;
      // On EVERY exit path, including the "no network" one: otherwise the
      // loading screen stays forever, and an offline-first app becomes
      // unusable exactly when there's no internet.
      setPrimeraHecha(true);
    }
  }, [userId]);

  // Register the manual trigger while this hook is mounted.
  useEffect(() => {
    const mine = () => void sync(true);
    currentForceSync = mine;
    // Compare identity, not "something is set": if this hook ever gets
    // mounted in two places, the first one's cleanup would erase the
    // callback the second one just registered, and "Sync now" would go
    // silent with no visible error.
    return () => {
      if (currentForceSync === mine) currentForceSync = null;
    };
  }, [sync]);

  // When the session starts: pull everything before the user sees anything.
  useEffect(() => {
    if (!userId) {
      setStatus('inactivo');
      setPrimeraHecha(true); // no account, nothing to pull
      return;
    }
    void sync(true);
  }, [userId, sync]);

  // On returning to the app and on leaving it. The second one is what
  // saves the "added three expenses and closed" case: without this they
  // stayed only here.
  useEffect(() => {
    if (!userId) return;
    function onVisibility() {
      void sync(document.visibilityState === 'hidden');
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [userId, sync]);

  return { status, error, firstSyncDone, sync };
}
