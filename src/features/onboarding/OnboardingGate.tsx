import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localRepository } from '@/data/local/localRepository';
import { OnboardingScreen } from './OnboardingScreen';
import { Logo } from '@/components/ui/Logo';
import { useT } from '@/i18n/language';

/**
 * Shows the initial setup the first time, and never again.
 *
 * `waiting` is set by AppShell while it pulls the account data down: without
 * it, a new device would ask for name and currency again during
 * the second the first sync takes.
 */
export function OnboardingGate({ waiting, children }: { waiting: boolean; children: ReactNode }) {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);

  /**
   * The last known settings are kept around.
   *
   * useLiveQuery returns undefined while it re-queries, and that happens
   * on ANY write to Dexie — for example the recurring-rule materialization
   * that runs on startup. Without this, that instant would render
   * <Cargando/>, unmounting OnboardingScreen and with it its local state:
   * you'd be on step 3 and go back to step 1, with the name already typed.
   *
   * It only covers the gap between queries; the first time `settings` really
   * is undefined and the loading screen shows up as it should.
   */
  // State adjustment DURING render, not in a useEffect: the effect
  // runs after painting, so it would arrive a render late and the gap
  // —exactly the one that needs covering— would still unmount the screen. React
  // supports calling a component's own setter during render: it retries
  // before committing anything.
  const [lastKnown, setUltimaConocida] = useState(settings);
  if (settings && settings !== lastKnown) setUltimaConocida(settings);
  const currentPlan = settings ?? lastKnown;

  /**
   * Once the initial setup is ON SCREEN, it never gets removed.
   *
   * `waiting` turns true every time a sync cycle starts, not
   * just the first one. Without this lock, a sync triggered mid
   * process —coming back to the tab, for example— would show <Cargando/>,
   * unmount OnboardingScreen and with it the step you were on: you'd be back at
   * the first one with the name already typed.
   *
   * What `waiting` does protect is preserved: on a new device,
   * BEFORE showing anything, it waits for the account to come down so it doesn't
   * ask for name and currency again.
   */
  const needsSetup = !!currentPlan && currentPlan.onboardedAt === null;
  const [alreadyShown, setYaSeMostro] = useState(false);
  if (needsSetup && !alreadyShown) setYaSeMostro(true);

  if (!currentPlan) return <Loading />;
  if (waiting && !alreadyShown) return <Loading />;
  if (needsSetup) return <OnboardingScreen settings={currentPlan} />;
  return <>{children}</>;
}

function Loading() {
  const t = useT();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Logo size={44} tile />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{t('home.loadingYourData')}</p>
      </div>
    </div>
  );
}
