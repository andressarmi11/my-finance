import { isSupabaseConfigured } from '@/data/supabase/client';
import { isIOS, isStandalone } from '@/lib/platform';
import { usePushNotifications } from './usePushNotifications';
import { useT } from '@/i18n/language';

/**
 * This only makes sense if Supabase is configured (the scheduler lives on
 * the server) and the browser supports Push. On iOS the PWA also has to be
 * installed on the home screen — if it isn't, we don't even try: we explain
 * why.
 */
export function NotificationsSection() {
  const { state, busy, error, subscribe, unsubscribe } = usePushNotifications();
  const t = useT();

  if (!isSupabaseConfigured()) return null;
  if (state === 'unsupported') return null;

  const iosNotInstalled = isIOS() && !isStandalone();

  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('notifications.title')}</h2>

      {iosNotInstalled ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('notifications.installFirst')}
        </p>
      ) : state === 'unconfigured' ? (
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t('notifications.pendingSetup')}</p>
      ) : state === 'denied' ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('notifications.blocked')}
        </p>
      ) : state === 'granted' ? (
        <button type="button" onClick={unsubscribe} disabled={busy} style={btnStyle}>
          {busy ? t('notifications.turningOff') : t('notifications.turnOffOnThisDevice')}
        </button>
      ) : (
        <button type="button" onClick={subscribe} disabled={busy} style={btnStyle}>
          {busy ? t('notifications.turningOn') : t('notifications.turnOn')}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 8 }}>{error}</p>}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
};
