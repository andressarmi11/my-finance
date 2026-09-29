import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { savePushSubscription, removePushSubscription } from '@/data/supabase/pushSubscriptions';
import { supportsPush } from '@/lib/platform';
import { urlBase64ToUint8Array } from '@/lib/vapid';
import { translate } from '@/i18n/language';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('default');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured() || !vapidPublicKey) { setState('unconfigured'); return; }
    if (!supportsPush()) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    if (Notification.permission !== 'granted') { setState('default'); return; }

    // Permission granted is not the same as subscribed. A device whose
    // subscription never reached the server (the first attempt failed,
    // or iOS dropped it) showed "turn off" and nothing else: no way to
    // register again, and no reminder would ever arrive. Check the real
    // subscription; if it exists, re-save it — that repairs those devices.
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!subscription) { setState('default'); return; }
        setState('granted');
        void savePushSubscription(subscription).catch(() => { /* next visit retries */ });
      })
      .catch(() => setState('default'));
  }, []);

  async function subscribe() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'default'); return; }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      await savePushSubscription(subscription);
      setState('granted');
    } catch (e) {
      setError(e instanceof Error ? e.message : translate('push.couldNotTurnOn'));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState('default');
    } catch (e) {
      setError(e instanceof Error ? e.message : translate('push.couldNotTurnOff'));
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, error, subscribe, unsubscribe };
}
