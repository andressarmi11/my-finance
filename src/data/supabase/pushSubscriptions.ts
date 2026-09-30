import { getSupabase } from './client';
import { activeLanguage, translate } from '@/i18n/language';

export async function savePushSubscription(sub: globalThis.PushSubscription): Promise<void> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(translate('push.noActiveSession'));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error(translate('push.unexpectedSubscription'));
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: session.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
  // Which language the inbox notification is written in (migration 0018).
  // Apart and best-effort: before 0018 the column doesn't exist, and that
  // must not break subscribing.
  await supabase.from('push_subscriptions')
    .update({ language: activeLanguage() })
    .eq('endpoint', json.endpoint)
    .then(() => undefined, () => undefined);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}
