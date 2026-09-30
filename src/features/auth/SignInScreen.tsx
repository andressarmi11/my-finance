import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck, IconEye, IconEyeOff, IconLock, IconMail } from '@tabler/icons-react';
import { getSupabase } from '@/data/supabase/client';
import { MIN_PASSWORD, translateError } from './authStyles';
import { useTurnstile } from './useTurnstile';
import { forgetSignedOutEmail, readSignedOutEmail } from './signedOut';
import { Logo } from '@/components/ui/Logo';
import { Segmented } from '@/components/ui/Segmented';
import { PasswordStrength, passwordStrength } from '@/components/ui/PasswordStrength';
import { useBreakpoint } from '@/app/useBreakpoint';
import { useT } from '@/i18n/language';
import { BrandPanel } from './BrandPanel';

type Mode = 'entrar' | 'crear' | 'olvide';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 *
 * Layout (§9f, §9g 2d): on a phone or tablet, only the form, left-aligned and
 * without a card. On a desktop the screen splits: the brand panel with a
 * sample-data preview on the left, the very same form at 400px on the right.
 */
export function SignInScreen() {
  const desktop = useBreakpoint() === 'desktop';

  if (desktop) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <BrandPanel />
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          <div style={{ width: 400, maxWidth: '100%' }}>
            <SignInForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        maxWidth: 440, margin: '0 auto',
        padding: 'calc(var(--safe-top) + 56px) 24px calc(var(--safe-bottom) + 28px)',
      }}
    >
      <SignInForm />
    </div>
  );
}

function SignInForm() {
  const t = useT();
  const desktop = useBreakpoint() === 'desktop';
  const [mode, setModo] = useState<Mode>('entrar');
  // Just signed out: the email comes back typed, with a green notice (§9f).
  const [signedOutEmail] = useState(readSignedOutEmail);
  useEffect(() => { if (signedOutEmail) forgetSignedOutEmail(); }, [signedOutEmail]);
  const [email, setEmail] = useState(signedOutEmail);
  const [key, setClave] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => (signedOutEmail ? t('login.signedOut') : ''));
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaBox);
  // Undefined when there's no captcha configured: Supabase ignores it then.
  const captchaToken = captcha.token ?? undefined;
  const waitingForCaptcha = captcha.enabled && !captcha.token;

  const emailId = useId();
  const keyId = useId();
  const termsId = useId();

  const emailOk = EMAIL.test(email.trim());
  const valid = mode === 'olvide' ? emailOk
    : mode === 'crear' ? emailOk && passwordStrength(key) >= 2 && accepted
    : emailOk && key.length > 0;
  const disabled = busy || !valid || waitingForCaptcha;

  function switchTo(next: Mode) {
    setModo(next);
    setError('');
    if (next !== 'entrar') setNotice('');
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = await getSupabase();

      if (mode === 'crear') {
        if (key.length < MIN_PASSWORD) throw new Error(t('auth.passwordTooShort').replace('{n}', String(MIN_PASSWORD)));
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
      setNotice(t('login.linkSent').replace('{email}', email));
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
      // Spent either way: a wrong password must not leave the button stuck.
      captcha.reset();
    }
  }

  const title = mode === 'crear' ? t('login.titleSignUp') : mode === 'olvide' ? t('login.titleForgot') : t('login.titleSignIn');
  const subtitle = mode === 'crear' ? t('auth.createSubtitle') : mode === 'olvide' ? t('auth.forgotSubtitle') : t('auth.signInSubtitle');

  return (
    <>
      {!desktop && <Logo size={60} tile />}
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: desktop ? '0 0 6px' : '22px 0 6px' }}>
        {title}
      </h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.45 }}>{subtitle}</p>

      {mode !== 'olvide' && (
        <div style={{ marginTop: 26 }}>
          {/* The tabs can't be named like the submit button: two controls
              with the same accessible name leave a screen reader with no
              way to tell them apart. Hence "Ya tengo cuenta" ≠ "Entrar"
              and "Crear cuenta" ≠ "Crear mi cuenta". */}
          <Segmented
            label={t('login.modeGroup')}
            value={mode}
            onChange={(m) => switchTo(m)}
            options={[
              { value: 'entrar', label: t('auth.iHaveAccount') },
              { value: 'crear', label: t('auth.createAccount') },
            ]}
          />
        </div>
      )}

      <form onSubmit={send} noValidate>
        <FieldLabel htmlFor={emailId}>{t('login.email')}</FieldLabel>
        <FieldBox icon={<IconMail size={19} stroke={1.8} />}>
          <input
            id={emailId}
            type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')}
            style={bareInput}
          />
        </FieldBox>

        {mode !== 'olvide' && (
          <>
            <FieldLabel htmlFor={keyId}>{t('auth.password')}</FieldLabel>
            <FieldBox icon={<IconLock size={19} stroke={1.8} />}>
              <input
                id={keyId}
                type={showKey ? 'text' : 'password'} required
                autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
                value={key} onChange={(e) => setClave(e.target.value)}
                placeholder={mode === 'entrar' ? t('auth.yourPassword') : t('login.passwordAtLeast').replace('{n}', String(MIN_PASSWORD))}
                style={bareInput}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? t('login.hidePassword') : t('login.showPassword')}
                style={{ border: 'none', background: 'none', padding: 4, margin: -4, minWidth: 36, minHeight: 36, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', cursor: 'pointer', flex: 'none' }}
              >
                {showKey ? <IconEyeOff size={20} stroke={1.8} /> : <IconEye size={20} stroke={1.8} />}
              </button>
            </FieldBox>
          </>
        )}

        {mode === 'crear' && (
          <>
            <PasswordStrength value={key} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14 }}>
              <input
                id={termsId}
                type="checkbox" required checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ width: 20, height: 20, margin: '1px 0 0', flex: 'none', accentColor: 'var(--q10)', cursor: 'pointer' }}
              />
              <label htmlFor={termsId} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, cursor: 'pointer' }}>
                {t('login.acceptPrefix')}{' '}
                {/* A new tab: leaving would throw away what's typed. */}
                <Link to="/legal/terminos" target="_blank" rel="noopener" style={legalLink}>{t('login.terms')}</Link>
                {' '}{t('login.acceptJoin')}{' '}
                <Link to="/legal/privacidad" target="_blank" rel="noopener" style={legalLink}>{t('login.privacy')}</Link>
              </label>
            </div>
          </>
        )}

        {mode === 'entrar' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={() => switchTo('olvide')} style={textButton}>
              {t('auth.forgotPassword')}
            </button>
          </div>
        )}

        {captcha.enabled && (
          <div style={{ marginTop: 16 }}>
            <div
              role="status"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, background: 'var(--surface)', fontSize: 13, color: 'var(--text-muted)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20, height: 20, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center',
                  background: captcha.token ? 'var(--positive)' : 'var(--line-strong)', color: 'var(--paper)',
                  transition: 'background var(--dur-fast) var(--ease-spring-out)',
                }}
              >
                {captcha.token && <IconCheck size={12} stroke={3.4} />}
              </span>
              <span style={{ flex: 1 }}>{captcha.token ? t('login.captchaReady') : t('login.captchaPending')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Cloudflare</span>
            </div>
            {/* 'interaction-only': empty unless Cloudflare needs a click. */}
            <div ref={captchaBox} />
          </div>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{
            marginTop: 14, width: '100%', minHeight: 54, borderRadius: 16, border: 'none',
            background: disabled ? 'var(--surface-sunken)' : 'var(--q10)',
            color: disabled ? 'var(--text-faint)' : 'var(--on-accent)',
            fontWeight: 700, fontSize: 16, cursor: disabled ? 'default' : 'pointer',
            transition: 'background var(--dur-fast) var(--ease-spring-out), color var(--dur-fast) var(--ease-spring-out)',
          }}
        >
          {busy ? t('auth.oneMoment')
            : mode === 'crear' ? t('login.submitSignUp')
            : mode === 'olvide' ? t('auth.sendLink')
            : t('auth.signIn')}
        </button>
      </form>

      {error && <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 13, margin: '12px 0 0', textAlign: 'center', lineHeight: 1.45 }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--positive-text)', fontSize: 13, margin: '12px 0 0', textAlign: 'center', lineHeight: 1.45 }}>{notice}</p>}

      {mode === 'olvide' && (
        <button type="button" onClick={() => { switchTo('entrar'); setNotice(''); }} style={{ ...textButton, marginTop: 14, alignSelf: 'flex-start' }}>
          ‹ {t('auth.backToSignIn')}
        </button>
      )}

      <div style={{ flex: 1, minHeight: 24 }} />
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5 }}>
        {t('login.footer')}
      </p>
    </>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', margin: '16px 2px 6px', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
      {children}
    </label>
  );
}

/** The input's frame: icon on the left, whatever else (the eye) on the right. */
function FieldBox({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="login-field"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 14px',
        borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line-strong)',
      }}
    >
      <span aria-hidden style={{ display: 'flex', color: 'var(--text-faint)', flex: 'none' }}>{icon}</span>
      {children}
    </div>
  );
}

const bareInput: CSSProperties = {
  flex: 1, minWidth: 0, minHeight: 50, border: 'none', background: 'none', outline: 'none',
  color: 'var(--text)', fontSize: 16, padding: 0,
};

const textButton: CSSProperties = {
  border: 'none', background: 'none', padding: '6px 0', minHeight: 'var(--tap)',
  color: 'var(--q10)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};

const legalLink: CSSProperties = { color: 'var(--q10)', fontWeight: 600, textDecoration: 'none' };
