import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { listPending, type InboxEntry } from '@/data/supabase/inbox';
import { useSession } from '@/features/auth/useSession';

/**
 * What automations left waiting for confirmation.
 *
 * It reloads on entry and on returning to the app — which is exactly when
 * something might have arrived, because the Shortcut runs with the app closed.
 */
export function useInbox() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [pending, setPendientes] = useState<InboxEntry[]>([]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId) {
      setPendientes([]);
      return;
    }
    try {
      setPendientes(await listPending());
    } catch {
      // Without a connection there's no inbox to show; it's not an error that
      // deserves interrupting anyone.
      setPendientes([]);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!userId) return;
    function onBack() {
      if (document.visibilityState === 'visible') void reload();
    }
    document.addEventListener('visibilitychange', onBack);
    return () => document.removeEventListener('visibilitychange', onBack);
  }, [userId, reload]);

  return { pending, reload };
}
