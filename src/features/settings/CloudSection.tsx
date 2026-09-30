import { useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { syncBidirectional } from '@/data/sync/syncService';
import { lastSynced, markSynced } from '@/data/sync/lastSynced';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { fill } from '@/lib/dateLabels';

/**
 * The account's sync, as two rows of Perfil's "Cuenta" group (redesign
 * §9e): the state ("Sincronizado · hace 2 min") and "Sincronizar ahora".
 * Sync already runs on its own (see useCloudSync); this is the "right now"
 * button. Only with Supabase configured. Signing out lives in LogoutSheet.
 */
export function CloudSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(lastSynced);
  const t = useT();

  if (!isSupabaseConfigured()) return null;

  async function syncNow() {
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      const r = await syncBidirectional();
      markSynced();
      setAt(Date.now());
      setMessage(
        t('cloud.syncResult')
          .replace('{pushed}', String(r.pushed))
          .replace('{pulled}', String(r.pulled))
          .replace('{deleted}', r.deleted ? t('cloud.syncDeleted').replace('{n}', String(r.deleted)) : ''),
      );
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : t('cloud.couldNotSync'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', minHeight: 54 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: failed ? 'var(--danger)' : 'var(--positive)' }} />
        <span style={{ flex: 1, fontSize: 'var(--text-md)' }}>{failed ? t('cloud.syncFailed') : t('cloud.syncedOk')}</span>
        {at && !failed && <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-faint)' }}>{ago(at, t)}</span>}
      </div>
      <button
        type="button"
        onClick={syncNow}
        disabled={busy}
        style={{
          width: '100%', minHeight: 54, padding: '0 14px', border: 'none', borderTop: '1px solid var(--line)',
          background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'var(--text-md)',
          color: 'var(--q10-text)', fontWeight: 600,
        }}
      >
        {busy ? t('cloud.syncing') : t('cloud.syncNow')}
      </button>
      {message && (
        <p role="status" style={{ margin: 0, padding: '0 14px 12px', fontSize: 'var(--text-sm)', color: failed ? 'var(--danger-text)' : 'var(--text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
}

/** "ahora mismo", "hace 2 min", "hace 3 h", "hace 2 d". */
export function ago(at: number, t: (k: TextKey) => string, now = Date.now()): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return t('set.agoNow');
  if (min < 60) return fill(t('set.agoMin'), { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return fill(t('set.agoHours'), { n: h });
  return fill(t('set.agoDays'), { n: Math.floor(h / 24) });
}
