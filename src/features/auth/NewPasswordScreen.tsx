import { IconKey } from '@tabler/icons-react';
import { useState } from 'react';
import { getSupabase } from '@/data/supabase/client';
import { exitRecovery } from './recovery';
import { buttonStyle, linkStyle, inputStyle, MIN_PASSWORD, translateError } from './authStyles';
import { useT } from '@/i18n/language';

/**
 * Shown when opening the "forgot my password" link, BEFORE letting
 * the user into the app.
 *
 * The link opens a session on its own, so without this screen the effect
 * was going straight in and not being able to change anything — which is
 * exactly what the user came to do. See recovery.ts.
 */
export function NewPasswordScreen() {
  const t = useT();
  const [key, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const matches = key.length > 0 && key === repetir;
  const canSubmit = key.length >= MIN_PASSWORD && matches && !busy;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const supabase = await getSupabase();
      const { error: err } = await supabase.auth.updateUser({ password: key });
      if (err) throw err;
      setListo(true);
      // A breather so the message gets read before the app shows up.
      setTimeout(exitRecovery, 1200);
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    // Signing out on purpose: the recovery session opened without
    // anyone typing a password. Leaving it open would be an unlocked
    // door for whoever has the email link.
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } finally {
      exitRecovery();
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--gap-l)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <p style={{ textAlign: 'center', margin: '0 0 10px', color: 'var(--q10)' }}>
          <IconKey size={38} stroke={1.6} aria-hidden />
        </p>
        <h1 style={{ textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 700, margin: '0 0 4px' }}>
          {t('auth.newPassword')}
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 'var(--text-base)' }}>
          {t('auth.chooseFromNowOn')}
        </p>

        {listo ? (
          <p role="status" style={{ textAlign: 'center', color: 'var(--positive-text)', fontWeight: 600 }}>
            {t('auth.passwordUpdated')}
          </p>
        ) : (
          <form onSubmit={save}>
            <input
              type="password" required autoFocus autoComplete="new-password" minLength={MIN_PASSWORD}
              value={key} onChange={(e) => setClave(e.target.value)}
              placeholder={t('auth.newPasswordMin').replace('{n}', String(MIN_PASSWORD))}
              aria-label={t('auth.newPassword')}
              style={inputStyle}
            />
            <input
              type="password" required autoComplete="new-password"
              value={repetir} onChange={(e) => setRepetir(e.target.value)}
              placeholder={t('auth.repeatIt')}
              aria-label={t('auth.repeatPassword')}
              style={{
                ...inputStyle,
                borderColor: repetir.length > 0 && !matches ? 'var(--danger)' : 'var(--line-strong)',
              }}
            />
            {repetir.length > 0 && !matches && (
              <p style={{ margin: '-4px 0 10px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>
                {t('auth.passwordsDoNotMatch')}
              </p>
            )}

            <button type="submit" disabled={!canSubmit} style={{ ...buttonStyle, opacity: canSubmit ? 1 : 0.5 }}>
              {busy ? t('action.saving') : t('auth.savePassword')}
            </button>
          </form>
        )}

        {!listo && (
          <button type="button" onClick={cancel} style={linkStyle}>
            {t('auth.cancelAndSignIn')}
          </button>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
