import { LegalDocScreen, LegalIndexScreen } from '@/features/legal/LegalScreen';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import {
  IconBell, IconBolt, IconCalendar, IconCash, IconCreditCard, IconDatabase, IconFileText, IconRepeat, IconTag, IconUser, IconWorld,
} from '@tabler/icons-react';
import type { TextKey } from '@/i18n/texts';
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
          <SettingsNav />
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
  // On a phone or tablet Legal is a pushed sub-screen of Ajustes, like the others.
  if (!desktop) return slug ? <LegalDocScreen inApp /> : <LegalIndexScreen inApp />;
  return <>{children}</>;
}

const NAV_ICON = { size: 15, stroke: 1.9 } as const;
const NAV: Array<{ to: string; label: TextKey; icon: React.ReactNode; tint: string; group?: TextKey }> = [
  { to: '/ajustes/cuenta', label: 'desk.profileAccount', icon: <IconUser {...NAV_ICON} />, tint: 'var(--q10)', group: 'set.account' },
  { to: '/ajustes/preferencias', label: 'desk.langTheme', icon: <IconWorld {...NAV_ICON} />, tint: 'var(--cat-servicios)', group: 'set.preferences' },
  { to: '/ajustes/moneda', label: 'settings.currency', icon: <IconCash {...NAV_ICON} />, tint: 'var(--positive)' },
  { to: '/ajustes/pagos', label: 'settings.howYouGetPaid', icon: <IconCalendar {...NAV_ICON} />, tint: 'var(--q25)', group: 'set.yourMoney' },
  { to: '/ajustes/recordatorios', label: 'settings.reminders', icon: <IconBell {...NAV_ICON} />, tint: 'var(--danger)' },
  { to: '/ajustes/categorias', label: 'categories.title', icon: <IconTag {...NAV_ICON} />, tint: 'var(--cat-hogar)', group: 'settings.organize' },
  { to: '/ajustes/metodos', label: 'methods.title', icon: <IconCreditCard {...NAV_ICON} />, tint: 'var(--q10)' },
  { to: '/ajustes/recurrentes', label: 'recurring.title', icon: <IconRepeat {...NAV_ICON} />, tint: 'var(--cat-suscripciones)' },
  {
    to: '/ajustes/presupuestos', label: 'budgets.title', tint: 'var(--cat-entretenimiento)',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden><path d="M5 20V11M12 20V4M19 20v-7" /></svg>,
  },
  { to: '/ajustes/atajos', label: 'set.shortcuts', icon: <IconBolt {...NAV_ICON} />, tint: 'var(--q25)', group: 'set.advanced' },
  { to: '/ajustes/datos', label: 'settings.yourData', icon: <IconDatabase {...NAV_ICON} />, tint: 'var(--text-muted)' },
  { to: '/ajustes/legal', label: 'settings.legal', icon: <IconFileText {...NAV_ICON} />, tint: 'var(--text-muted)' },
];

/**
 * The desktop list of Ajustes (§9g 2c): plain rows under small group
 * titles, the open one on --surface-sunken. No cards, values or chevrons —
 * the detail is right beside it.
 */
function SettingsNav() {
  const t = useT();
  const { pathname } = useLocation();
  return (
    <nav aria-label={t('desk.settingsNav')} style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 250 }}>
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <div key={item.to} style={{ display: 'contents' }}>
            {item.group && (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', padding: '14px 12px 6px' }}>{t(item.group)}</div>
            )}
            <Link
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className="row-hover"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 12px', borderRadius: 10,
                background: active ? 'var(--surface-sunken)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: 14, textDecoration: 'none',
              }}
            >
              <span aria-hidden style={{
                width: 26, height: 26, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center',
                background: 'var(--surface-sunken)', color: item.tint,
              }}>
                {item.icon}
              </span>
              {t(item.label)}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
