import { useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Logo } from '@/components/ui/Logo';
import { TABS } from '@/components/ui/TabBar';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { isSupabaseConfigured } from '@/data/supabase/client';
import type { SyncStatus } from '@/data/sync/useCloudSync';
import { calculatePeriod, normalizePayDays } from '@/domain/period/period';
import { useSession } from '@/features/auth/useSession';
import { Avatar } from '@/features/settings/SettingsScreen';
import { formatRangeLabel, periodGroupLabel } from '@/features/transactions/groupByPeriod';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { todayISO } from '@/lib/todayISO';

/** Whole days from `a` to `b` (ISO dates), counting calendar days only. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The desktop sidebar (≥1100px, §9g): the brand, the same three tabs as the
 * tab bar, the pay period you're in with how far along it is, and the
 * account with its sync state. Everything it shows comes from the same
 * sources as the phone: TABS, calculatePeriod and useCloudSync.
 */
export function Sidebar({ status }: { status: SyncStatus }) {
  const t = useT();
  const { pathname } = useLocation();
  const { session } = useSession();
  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const today = todayISO();

  const period = useMemo(() => {
    const payDays = normalizePayDays(settings.payDays);
    const p = calculatePeriod(today, payDays);
    const total = daysBetween(p.start, p.end) + 1;
    const day = daysBetween(p.start, today) + 1;
    return {
      label: periodGroupLabel(payDays, p.index, p.key),
      range: formatRangeLabel(p.start, p.end),
      day,
      total,
      colorVar: p.index % 2 === 0 ? '--q25' : '--q10',
    };
  }, [today, settings.payDays]);

  const cloud = isSupabaseConfigured() && !!session;
  const name = settings.displayName.trim();
  const statusText = !cloud ? t('set.localOnlyShort')
    : status === 'sincronizando' ? t('cloud.syncing')
    : status === 'error' ? t('cloud.syncFailed')
    : t('cloud.syncedOk');
  const statusColor = !cloud ? 'var(--text-faint)'
    : status === 'error' ? 'var(--danger-text)'
    : status === 'sincronizando' ? 'var(--text-muted)'
    : 'var(--positive-text)';

  return (
    <aside
      aria-label={t('desk.sidebar')}
      style={{
        position: 'sticky', top: 0, height: '100dvh',
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: 'calc(var(--safe-top) + 22px) 16px 22px',
        borderRight: '1px solid var(--line)', background: 'var(--paper)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px 22px' }}>
        <Logo size={26} />
        <span className="figures" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Step up</span>
      </div>

      <nav aria-label={t('nav.mainNavigation')} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className="row-hover"
            style={({ isActive }) => {
              const active = isActive || (tab.to === '/' && pathname.startsWith('/movimientos'));
              return {
                display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px',
                borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                background: active ? 'var(--surface-sunken)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
              };
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={tab.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t(tab.key)}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* The pay period you're in, and how far along it is. */}
      <section
        aria-label={t('desk.activePeriod')}
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: `var(${period.colorVar})` }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: `var(${period.colorVar}-text)` }}>{period.label}</span>
        </div>
        <div className="figures" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {period.range} · {fill(t('desk.dayOf'), { n: period.day, total: period.total })}
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={period.total}
          aria-valuenow={period.day}
          aria-label={fill(t('desk.dayOf'), { n: period.day, total: period.total })}
          style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 10, overflow: 'hidden' }}
        >
          <div style={{ width: `${Math.round((period.day / period.total) * 100)}%`, height: '100%', borderRadius: 3, background: `var(${period.colorVar})` }} />
        </div>
      </section>

      <Link
        to="/ajustes/cuenta"
        className="row-hover"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', marginTop: 8,
          borderRadius: 12, textDecoration: 'none', color: 'var(--text)',
        }}
      >
        <Avatar name={name} size={36} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || t('set.profile')}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: statusColor }}>{statusText}</span>
        </span>
      </Link>
    </aside>
  );
}
