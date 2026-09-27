import type { ReactNode } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from './useSession';
import { SignInScreen } from './SignInScreen';
import { NewPasswordScreen } from './NewPasswordScreen';
import { useRecoveryMode } from './recovery';

/**
 * If Supabase isn't configured, it just lets things through (the app stays 100%
 * local). If it IS configured, it requires a session before showing the app.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) return <>{children}</>;
  return <AuthGateInner>{children}</AuthGateInner>;
}

function AuthGateInner({ children }: { children: ReactNode }) {
  const { loading, session } = useSession();
  const recovering = useRecoveryMode();

  // BEFORE the session, on purpose: the "forgot my password" link
  // opens a session on its own, so checking for the session first
  // sent you straight into the app and never let you change the password — which is
  // exactly what you came to do. See recovery.ts.
  if (recovering) return <NewPasswordScreen />;

  if (loading) return null;
  if (!session) return <SignInScreen />;
  return <>{children}</>;
}
