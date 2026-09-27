import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/data/supabase/client';

export type SessionState = { loading: boolean; session: Session | null };

/** If Supabase isn't configured, it resolves right away as "no session, not loading". */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: isSupabaseConfigured(), session: null });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let unsubscribe: (() => void) | undefined;

    void getSupabase().then((supabase) => {
      supabase.auth.getSession().then(({ data }) => {
        setState({ loading: false, session: data.session });
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        setState({ loading: false, session });
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
    });

    return () => unsubscribe?.();
  }, []);

  return state;
}
