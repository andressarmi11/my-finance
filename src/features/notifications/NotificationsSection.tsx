import { isSupabaseConfigured } from '@/data/supabase/client';
import { isIOS, isStandalone } from '@/lib/platform';
import { usePushNotifications } from './usePushNotifications';
import { useT } from '@/i18n/language';
import { Switch } from '@/features/settings/ui';

/**
 * "Avisarme en este dispositivo" (redesign §9e): an iOS switch that
 * subscribes this device to push.
 *
 * This only makes sense if Supabase is configured (the scheduler lives on
 * the server) and the browser supports Push; otherwise it says why instead
 * of offering a switch that can't work. On iOS the PWA also has to be
 * installed on the home screen — if it isn't, we don't even try: we explain
 * why.
 */
export function NotificationsSection() {
  const { state, busy, error, subscribe, unsubscribe } = usePushNotifications();
  const t = useT();

  const label = t('set.notifyThisDevice');
  let note = '';
  if (!isSupabaseConfigured()) note = t('set.notifyNeedsAccount');
  else if (state === 'unsupported') note = t('set.notifyUnsupported');
  else if (isIOS() && !isStandalone()) note = t('notifications.installFirst');
  else if (state === 'unconfigured') note = t('notifications.pendingSetup');
  else if (state === 'denied') note = t('notifications.blocked');
  const usable = note === '';
  const on = state === 'granted';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', minHeight: 56 }}>
        <span style={{ flex: 1, fontSize: 'var(--text-md)' }}>{label}</span>
        <Switch
          label={label}
          on={usable && on}
          disabled={!usable || busy}
          onChange={(next) => { void (next ? subscribe() : unsubscribe()); }}
        />
      </div>
      {(note || busy || error) && (
        <p role="status" style={{ margin: 0, padding: '0 14px 12px', fontSize: 'var(--text-sm)', color: error ? 'var(--danger-text)' : 'var(--text-muted)', lineHeight: 1.45 }}>
          {error || (busy ? (on ? t('notifications.turningOff') : t('notifications.turningOn')) : note)}
        </p>
      )}
    </div>
  );
}
