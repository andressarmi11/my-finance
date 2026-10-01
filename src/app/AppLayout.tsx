import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from '@/components/ui/TabBar';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { InboxProvider } from '@/features/inbox/InboxProvider';
import { ToastHost } from '@/components/ui/Toast';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { AuthGate } from '@/features/auth/AuthGate';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { useCloudSync } from '@/data/sync/useCloudSync';
import { useMoneyFormat } from './useMoneyFormat';
import { useTheme } from './useTheme';
import { useBreakpoint } from './useBreakpoint';
import { Sidebar } from './Sidebar';
import { isSearchShortcut, requestSearchFocus } from './searchFocus';

/**
 * Order of the layers, and why that order:
 *   AuthGate       — without a session there's nothing to show.
 *   useCloudSync   — pulls the account data down BEFORE deciding anything else.
 *   OnboardingGate — only asks for the initial setup if, after pulling,
 *                    it's still missing. Otherwise a new phone would
 *                    ask for name and currency again every time.
 */
export function AppLayout() {
  useTheme();
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const { status, error, firstSyncDone, sync } = useCloudSync();
  useMoneyFormat();
  // One tree for every size (§9g): the phone gets the floating tab bar,
  // a tablet the same bar as a side rail, a desktop the sidebar.
  const breakpoint = useBreakpoint();
  const desktop = breakpoint === 'desktop';
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // ⌘K / Ctrl+K: the Movimientos search, which on desktop lives in Inicio.
  useEffect(() => {
    if (!desktop) return;
    function onKey(e: KeyboardEvent) {
      if (!isSearchShortcut(e)) return;
      e.preventDefault();
      if (pathname !== '/') navigate('/');
      requestSearchFocus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, pathname, navigate]);

  return (
    <OnboardingGate waiting={!firstSyncDone}>
      {/* The inbox (BANDEJA.md): no banner any more. Inicio shows its button
          and its card; a notification's ?revisar=<id> opens it from here. */}
      <InboxProvider>
        {/* 100dvh, not 100%: on iOS a % height resolves against the large
            viewport and ignores that the Safari bar appears and disappears, so
            short screens ended up without scroll and with the bottom bar floating
            above the toolbar. dvh follows the real viewport. */}
        <div className="app-shell" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          {desktop && <Sidebar status={status} />}
          <main
            className="app-main"
            style={{
              flex: 1,
              minWidth: 0,
              // No global brand bar any more (redesign §8): Inicio has its own
              // header and the other screens their large title. So the notch
              // is padded here.
              paddingTop: desktop ? 'calc(var(--safe-top) + 28px)' : 'calc(var(--safe-top) + var(--gap-l))',
              // Phone: 12 gap + 62 floating tab bar + breathing room, so
              // nothing ends up under the pill or the +. Wider screens have
              // no bar at the bottom.
              paddingBottom: breakpoint === 'phone' ? 'calc(var(--safe-bottom) + 110px)' : 'calc(var(--safe-bottom) + 36px)',
            }}
          >
            <InstallBanner />
            {/* No LegalFooter here: legal lives in Ajustes → Legal and in
                LegalLayout, not under every screen. */}
            <Outlet />
          </main>
          {!desktop && <TabBar />}
          <PullToRefresh />
          <SyncIndicator status={status} error={error} onReintentar={() => void sync(true)} />
          <ToastHost />
        </div>
      </InboxProvider>
    </OnboardingGate>
  );
}
