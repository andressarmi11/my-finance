import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/ui/Screen';
import { getSupabase, isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from '@/features/auth/useSession';
import { translateError } from '@/features/auth/authStyles';
import { useTurnstile } from '@/features/auth/useTurnstile';
import { ACCOUNT_DELETED_KEY } from '@/features/auth/signedOut';
import { useT } from '@/i18n/language';
import { PasswordField } from './ChangePasswordScreen';
import { clearLocalDevice } from './clearLocalDevice';
import { card, noteStyle } from './ui';

/**
 * Eliminar cuenta, from Perfil. Apple (App Review 5.1.1(v)) and Google Play
 * require that an app that lets you create an account lets you delete it
 * from inside the app.
 *
 * Like Cambiar contraseña, it re-authenticates with the password first: an
 * unlocked phone left on a table must not be enough to wipe the account.
 * Then the delete_account RPC (migration 0021) deletes the auth user, and
 * every table goes with it through `on delete cascade`.
 *
 * After that the session's tokens point at a user that no longer exists,
 * so the sign-out is local only, and the device is wiped (clearLocalDevice)
 * and reloaded: keeping the data here would let the next sync upload it
 * into a new account, or leave it on a phone the user thinks is clean.
 */
export function DeleteAccountScreen() {
  const t = useT();
  const { session } = useSession();
  const email = session?.user.email ?? '';
  const available = isSupabaseConfigured() && !!email;

  return (
    <Screen title={t('set.deleteAccount')} subtitle={t('set.delIntro')} back={{ label: t('set.profile'), to: '/ajustes/cuenta' }}>
      {available
        ? <DeleteAccountForm email={email} />
        : <p role="note" style={{ ...noteStyle, marginTop: 0 }}>{t('set.delNeedsAccount')}</p>}
    </Screen>
  );
}

/**
 * Its own component so the captcha box exists on its first render: the
 * Turnstile hook renders into the box once, on mount, and the session
 * arrives a moment after the screen does.
 */
function DeleteAccountForm({ email }: { email: string }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaBox);
  const captchaToken = captcha.token ?? undefined;
  const waitingForCaptcha = captcha.enabled && !captcha.token;
  const canDelete = !busy && !waitingForCaptcha && password.length > 0;

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!canDelete) return;
    setBusy(true);
    setError('');
    try {
      const supabase = await getSupabase();
      const auth = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (auth.error) throw auth.error;
      const { error: err } = await supabase.rpc('delete_account');
      if (err) throw err;
      await supabase.auth.signOut({ scope: 'local' });
      await clearLocalDevice();
      // After the wipe, which clears localStorage but not sessionStorage.
      try { sessionStorage.setItem(ACCOUNT_DELETED_KEY, '1'); } catch { /* private mode */ }
      window.location.reload();
    } catch (e) {
      setError(translateError(e));
      setBusy(false);
      // A token works once, whatever happened.
      captcha.reset();
    }
  }

  const items = t('set.delItems').split('|');

  return (
    <>
      <div style={{ ...card, padding: '14px 16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>{t('set.delWhat')}</h2>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 'var(--text-base)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <p style={noteStyle}>{t('set.delDevice')}</p>
      <Link
        to="/ajustes/datos"
        style={{ display: 'block', marginTop: 10, color: 'var(--q10-text)', fontWeight: 600, fontSize: 'var(--text-base)', textAlign: 'center' }}
      >
        {t('set.delExportFirst')}
      </Link>

      <form onSubmit={remove}>
        <PasswordField id="del-pw" label={t('set.delConfirmPw')} placeholder={t('set.pwCurrentPlaceholder')}
          value={password} onChange={setPassword} autoComplete="current-password" />

        {captcha.enabled && <div ref={captchaBox} style={{ minHeight: 65, marginTop: 14 }} />}

        <button
          type="submit"
          disabled={!canDelete}
          style={{
            marginTop: 18, width: '100%', height: 52, borderRadius: 16, border: 'none', fontWeight: 700,
            fontSize: 'var(--text-md)', cursor: canDelete ? 'pointer' : 'not-allowed',
            background: canDelete ? 'var(--danger)' : 'var(--surface-sunken)',
            color: canDelete ? 'var(--on-accent)' : 'var(--text-faint)',
          }}
        >
          {busy ? t('auth.oneMoment') : t('set.delButton')}
        </button>
      </form>

      {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)', textAlign: 'center' }}>{error}</p>}
    </>
  );
}
