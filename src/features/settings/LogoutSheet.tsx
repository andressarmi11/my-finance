import { useState } from 'react';
import { IconCheck, IconLogout } from '@tabler/icons-react';
import { getSupabase } from '@/data/supabase/client';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { BottomSheet } from './ui';
import { clearLocalDevice } from './clearLocalDevice';
import { SIGNED_OUT_EMAIL_KEY } from '@/features/auth/signedOut';

/**
 * ¿Cerrar sesión? (redesign §9f). The data stays in the account; the
 * optional checkbox also wipes this device (clearLocalDevice), for a phone
 * that isn't yours. Signing out makes AuthGate show the login screen.
 */
export function LogoutSheet({ email, onClose }: { email: string; onClose: () => void }) {
  const t = useT();
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const supabase = await getSupabase();
      const { error: err } = await supabase.auth.signOut();
      if (err) throw err;
      // §9f: the login screen comes back with this email already typed and
      // a green notice. sessionStorage: it survives the wipe's reload (which
      // clears localStorage) and dies with the tab.
      try { sessionStorage.setItem(SIGNED_OUT_EMAIL_KEY, email); } catch { /* private mode */ }
      // After signOut, never before: a failed sign-out must not leave the
      // user logged in with an empty phone.
      if (wipe) {
        await clearLocalDevice();
        // The login screen already showed (and consumed) it for a moment
        // before this reload: leave it again for the fresh page.
        try { sessionStorage.setItem(SIGNED_OUT_EMAIL_KEY, email); } catch { /* private mode */ }
        // A fresh start: nothing in memory from the account survives either
        // (open queries, module caches), and the login screen loads blank.
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <BottomSheet label={t('set.logoutQuestion')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '6px 0 4px' }}>
        <span aria-hidden style={{
          width: 56, height: 56, borderRadius: 28, display: 'grid', placeItems: 'center',
          background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)',
        }}>
          <IconLogout size={26} stroke={1.9} />
        </span>
        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>{t('set.logoutQuestion')}</h2>
        <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {email ? fill(t('set.logoutBody'), { email }) : t('set.logoutBodyNoEmail')}
        </p>
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, background: 'var(--paper)',
        borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={wipe}
          onChange={(e) => setWipe(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        />
        <span aria-hidden style={{
          width: 22, height: 22, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center',
          border: `2px solid ${wipe ? 'var(--danger)' : 'var(--line-strong)'}`,
          background: wipe ? 'var(--danger)' : 'transparent', color: 'var(--on-accent)',
        }}>
          {wipe && <IconCheck size={13} stroke={3.2} />}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 'var(--text-md)', fontWeight: 600 }}>{t('set.wipeDevice')}</span>
          <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('set.wipeDeviceHint')}</span>
        </span>
      </label>

      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        style={{
          marginTop: 14, width: '100%', height: 52, borderRadius: 16, border: 'none', background: 'var(--danger)',
          color: 'var(--on-accent)', fontWeight: 700, fontSize: 'var(--text-md)', cursor: 'pointer',
        }}
      >
        {busy ? t('auth.oneMoment') : t('cloud.signOut')}
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 8, width: '100%', height: 50, borderRadius: 16, border: 'none', background: 'var(--surface-sunken)',
          color: 'var(--text)', fontWeight: 600, fontSize: 'var(--text-md)', cursor: 'pointer',
        }}
      >
        {t('action.cancel')}
      </button>
    </BottomSheet>
  );
}
