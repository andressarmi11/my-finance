import { Outlet } from 'react-router-dom';
import { TabBar } from '@/components/ui/TabBar';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { InboxBanner } from '@/features/inbox/InboxBanner';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { AuthGate } from '@/features/auth/AuthGate';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { useCloudSync } from '@/data/sync/useCloudSync';
import { useMoneyFormat } from './useMoneyFormat';
import { useTheme } from './useTheme';

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

  return (
    <OnboardingGate waiting={!firstSyncDone}>
      {/* 100dvh, not 100%: on iOS a % height resolves against the large
          viewport and ignores that the Safari bar appears and disappears, so
          short screens ended up without scroll and with the bottom bar floating
          above the toolbar. dvh follows the real viewport. */}
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <main
          style={{
            flex: 1,
            // No global brand bar any more (redesign §8): Inicio has its own
            // header and the other screens their large title. So the notch
            // is padded here.
            paddingTop: 'calc(var(--safe-top) + var(--gap-l))',
            // 12 gap + 62 floating tab bar + breathing room: nothing ends up
            // under the pill or the +.
            paddingBottom: 'calc(var(--safe-bottom) + 110px)',
          }}
        >
          <InstallBanner />
          <InboxBanner />
          {/* No LegalFooter here: legal lives in Ajustes → Legal and in
              LegalLayout, not under every screen. */}
          <Outlet />
        </main>
        <TabBar />
        <PullToRefresh />
        <SyncIndicator status={status} error={error} onReintentar={() => void sync(true)} />
      </div>
    </OnboardingGate>
  );
}
