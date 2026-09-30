import { useRef, useState } from 'react';
import { getSupabase } from '@/data/supabase/client';
import { buttonStyle, linkStyle, inputStyle, MIN_PASSWORD, translateError } from './authStyles';
import { useTurnstile } from './useTurnstile';
import { Logo } from '@/components/ui/Logo';
import { useT } from '@/i18n/language';

type Mode = 'entrar' | 'crear' | 'olvide';

/**
 * Account with email and password. It used to be a magic link, which on an
 * iPhone is awkward (you have to leave to the mail app and come back) and on top of
 * that opens the link in Safari, not the installed app — which has its own
 * storage, so the session landed on the wrong side.
 *
 * With email+password you sign in on any device, and that's what
 * makes the data follow you: signing in pulls everything down from the cloud
 * (see useCloudSync).
 *
 * Changing the password does NOT live here: it lives in NewPasswordScreen, above
 * AuthGate, because the recovery link arrives with a session already open.
 */
export function SignInScreen() {
  const t = useT();
  const [mode, setModo] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [key, setClave] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaBox);
  // Undefined when there's no captcha configured: Supabase ignores it then.
  const captchaToken = captcha.token ?? undefined;
  const waitingForCaptcha = captcha.enabled && !captcha.token;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (waitingForCaptcha) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = await getSupabase();

      if (mode === 'crear') {
        if (key.length < MIN_PASSWORD) throw new Error(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
        const { data, error: err } = await supabase.auth.signUp({ email, password: key, options: { captchaToken } });
        if (err) throw err;
        // If the project requires confirming the email, there's no session yet.
        if (!data.session) {
          setNotice(t('auth.accountCreated'));
          setModo('entrar');
        }
        return;
      }

      if (mode === 'entrar') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password: key, options: { captchaToken } });
        if (err) throw err;
        return;
      }

      // forgot
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
        captchaToken,
      });
      if (err) throw err;
      setNotice(`Te enviamos un enlace a ${email}. Ábrelo y te va a pedir la contraseña nueva.`);
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
      // Spent either way: a wrong password must not leave the button stuck.
      captcha.reset();
    }
  }

  const needsPassword = mode !== 'olvide';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--gap-l)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Logo size={76} tile />
        </div>
        <h1 className="figures" style={{ textAlign: 'center', fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.022em', margin: '0 0 4px' }}>
          Step up
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 'var(--text-base)' }}>
          {mode === 'crear' ? t('auth.createSubtitle')
            : mode === 'olvide' ? t('auth.forgotSubtitle')
            : t('auth.signInSubtitle')}
        </p>

        {mode !== 'olvide' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <TabButton isActive={mode === 'entrar'} onClick={() => { setModo('entrar'); setError(''); }}>
              {t('auth.iHaveAccount')}
            </TabButton>
            <TabButton isActive={mode === 'crear'} onClick={() => { setModo('crear'); setError(''); }}>
              {t('auth.createAccount')}
            </TabButton>
          </div>
        )}

        <form onSubmit={send}>
          <input
            type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
            aria-label="Correo"
            style={inputStyle}
          />
          {needsPassword && (
            <input
              type="password" required
              autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
              minLength={mode === 'entrar' ? undefined : MIN_PASSWORD}
              value={key} onChange={(e) => setClave(e.target.value)}
              placeholder={mode === 'entrar' ? t('auth.yourPassword') : t('auth.passwordMin').replace('{n}', String(MIN_PASSWORD))}
              aria-label={t('auth.password')}
              style={inputStyle}
            />
          )}

          {captcha.enabled && <div ref={captchaBox} style={{ minHeight: 65, marginBottom: 10 }} />}

          <button type="submit" disabled={busy || waitingForCaptcha} style={buttonStyle}>
            {busy ? t('auth.oneMoment')
              : mode === 'crear' ? t('auth.createAccount')
              : mode === 'olvide' ? t('auth.sendLink')
              : t('auth.signIn')}
          </button>
        </form>

        {mode === 'entrar' && (
          <button type="button" onClick={() => { setModo('olvide'); setError(''); }} style={linkStyle}>
            {t('auth.forgotPassword')}
          </button>
        )}
        {mode === 'olvide' && (
          <button type="button" onClick={() => { setModo('entrar'); setError(''); setNotice(''); }} style={linkStyle}>
            {t('auth.backToSignIn')}
          </button>
        )}

        {error && <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>{error}</p>}
        {notice && <p style={{ color: 'var(--positive-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>{notice}</p>}
      </div>
    </div>
  );
}

/* The tabs can't be named the same as the submit button ("Entrar"):
   two controls with the same accessible name leave a screen reader
   with no way to tell them apart. */
function TabButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={isActive}
      style={{
        flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)',
        border: `1px solid ${isActive ? 'var(--q10)' : 'var(--line-strong)'}`,
        background: isActive ? 'var(--q10)' : 'var(--surface)',
        color: isActive ? 'var(--on-accent)' : 'var(--text)',
        fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
