import { Outlet } from 'react-router-dom';
import { TabBar } from '@/components/ui/TabBar';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { InboxBanner } from '@/features/inbox/InboxBanner';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { LegalFooter } from '@/features/legal/LegalFooter';
import { Logo } from '@/components/ui/Logo';
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
        <BrandBar />
        <main
          style={{
            flex: 1,
            // The top safe-area is already absorbed by BrandBar, which sits flush.
            paddingTop: 'var(--gap-l)',
            // 61 bar + 14 + 56 FAB + breathing room: nothing ends up under the tab bar or the +.
            paddingBottom: 'calc(var(--safe-bottom) + 148px)',
          }}
        >
          <InstallBanner />
          <InboxBanner />
          <Outlet />
          <LegalFooter />
        </main>
        <TabBar />
        <PullToRefresh />
        <SyncIndicator status={status} error={error} onReintentar={() => void sync(true)} />
      </div>
    </OnboardingGate>
  );
}

/**
 * Brand bar. It's the iOS pattern: a thin, translucent bar that always says
 * where you're standing, with each screen's large title underneath
 * (Screen.tsx), which does change. Without it the app name was only visible
 * at sign-in and then disappeared.
 *
 * sticky and not fixed: when the keyboard shrinks the viewport, fixed hovers
 * over the content; sticky moves with the document scroll.
 * It eats the --safe-top so the blur reaches the notch instead of
 * leaving a strip of background above it.
 */
function BrandBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        // Above the content and the tab bar (40), below the
        // modals (50-70): an open sheet has to cover it.
        zIndex: 30,
        paddingTop: 'var(--safe-top)',
        background: 'color-mix(in srgb, var(--paper) 78%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          height: 48,
          padding: '0 var(--gap-l)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <Logo size={22} />
        <span
          className="figures"
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            letterSpacing: '-0.015em',
            color: 'var(--text)',
          }}
        >
          Step up
        </span>
      </div>
    </header>
  );
}
