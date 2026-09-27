import { Outlet } from 'react-router-dom';
import { useTheme } from './useTheme';
import { LegalFooter } from '@/features/legal/LegalFooter';

/**
 * Minimal wrapper for the legal pages.
 *
 * Doesn't use AppLayout because AppLayout brings AuthGate and OnboardingGate,
 * and these pages need to be readable without an account and without having
 * finished the initial setup. It also doesn't carry a TabBar: they aren't
 * part of the app, they're documents.
 *
 * It does keep useTheme: a document in light mode when the phone is
 * in dark mode is blinding at night.
 */
export function LegalLayout() {
  useTheme();
  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(var(--safe-top) + var(--gap-l))',
        paddingBottom: 'calc(var(--safe-bottom) + var(--gap-xl))',
      }}
    >
      <Outlet />
      <LegalFooter />
    </div>
  );
}
