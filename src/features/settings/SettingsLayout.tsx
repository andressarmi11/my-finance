import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBreakpoint } from '@/app/useBreakpoint';
import { Screen, SettingsPanelContext } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { useT } from '@/i18n/language';
import { SettingsScreen } from './SettingsScreen';
import { LanguageOptions } from './LanguageSheet';
import { ThemeOptions } from './ThemeSheet';
import { card } from './ui';

/**
 * Ajustes (§7, §9g 2c). On a phone or a tablet every /ajustes/* route is its
 * own screen, pushed over the list. On desktop the list stays on the left
 * (250px, the same groups and rows) and the route renders on the right, so
 * moving between settings never loses your place.
 */
export function SettingsLayout() {
  const t = useT();
  const desktop = useBreakpoint() === 'desktop';
  if (!desktop) return <Outlet />;
  return (
    <div className="screen screen-wide">
      <h1 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>{t('settings.title')}</h1>
      <div
        data-testid="settings-columns"
        style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: 24, alignItems: 'start' }}
      >
        <div style={{ position: 'sticky', top: 16 }}>
          <SettingsScreen asNav />
        </div>
        <div style={{ minWidth: 0 }}>
          <SettingsPanelContext.Provider value>
            <Outlet />
          </SettingsPanelContext.Provider>
        </div>
      </div>
    </div>
  );
}

/** /ajustes: the grouped list on a phone; on desktop, the first panel (Perfil). */
export function SettingsIndex() {
  const desktop = useBreakpoint() === 'desktop';
  if (desktop) return <Navigate to="/ajustes/cuenta" replace />;
  return <SettingsScreen />;
}

/**
 * Idioma y tema share one panel on desktop (§9g 2c). On a phone they're two
 * sheets opened from the list, so this route sends you back there.
 */
export function PreferencesScreen() {
  const t = useT();
  const desktop = useBreakpoint() === 'desktop';
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (!desktop) return <Navigate to="/ajustes" replace />;
  if (!settings) return null;
  return (
    <Screen title={t('desk.langTheme')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section aria-label={t('settings.language')} style={{ ...card, padding: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('settings.language')}</h2>
          <LanguageOptions />
        </section>
        <section aria-label={t('settings.theme')} style={{ ...card, padding: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('settings.theme')}</h2>
          <p style={{ margin: '2px 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>{t('desk.themeNote')}</p>
          <div style={{ maxWidth: 480 }}>
            <ThemeOptions settings={settings} />
          </div>
        </section>
      </div>
    </Screen>
  );
}

/** /ajustes/legal: on a phone the documents live at /legal, outside the app. */
export function LegalRedirect({ children }: { children: React.ReactNode }) {
  const desktop = useBreakpoint() === 'desktop';
  const { slug } = useParams<{ slug: string }>();
  if (!desktop) return <Navigate to={slug ? `/legal/${slug}` : '/legal'} replace />;
  return <>{children}</>;
}
