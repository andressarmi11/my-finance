import { useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from '@/features/auth/useSession';
import { syncBidirectional } from '@/data/sync/syncService';
import { useT } from '@/i18n/language';

/**
 * Only shows up if the project has Supabase configured. Sync
 * already runs on its own (see useCloudSync); this is the "right now" button and the
 * place to see which account you're on and sign out.
 */
export function CloudSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { session } = useSession();
  const t = useT();

  if (!isSupabaseConfigured()) return null;

  async function syncNow() {
    setBusy(true);
    setMessage('');
    try {
      const r = await syncBidirectional();
      setMessage(
        t('cloud.syncResult')
          .replace('{pushed}', String(r.pushed))
          .replace('{pulled}', String(r.pulled))
          .replace('{deleted}', r.deleted ? t('cloud.syncDeleted').replace('{n}', String(r.deleted)) : ''),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('cloud.couldNotSync'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('cloud.title')}</h2>

      {session && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          {t('cloud.signedInAs')} <strong>{session.user.email}</strong>. {t('cloud.sameDataAnywhere')}
        </p>
      )}

      <button type="button" onClick={syncNow} disabled={busy} style={{ ...btnStyle, width: '100%', marginBottom: 8 }}>
        {busy ? t('cloud.syncing') : t('cloud.syncNow')}
      </button>

      <button
        type="button"
        onClick={() => { void getSupabase().then((supabase) => supabase.auth.signOut()); }}
        style={{ ...btnStyle, width: '100%', color: 'var(--danger-text)' }}
      >
        {t('cloud.signOut')}
      </button>

      {message && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>{message}</p>}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
};
