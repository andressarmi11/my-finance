import { useRef, useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { Screen } from '@/components/ui/Screen';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { getSupabase, isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from '@/features/auth/useSession';
import { MIN_PASSWORD, translateError } from '@/features/auth/authStyles';
import { useTurnstile } from '@/features/auth/useTurnstile';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';

/**
 * Cambiar contraseña (redesign §9f, §11 item 5), from Perfil. Until now a
 * password could only change through the recovery link.
 *
 * It re-authenticates with the CURRENT password first (signInWithPassword):
 * an unlocked phone left on a table must not be enough to take over the
 * account. Then auth.updateUser({ password }). Errors go through the same
 * translateError as the login screen. With the captcha on, Supabase asks
 * for a Turnstile token on that sign-in and on the reset link too, so this
 * screen carries its own widget.
 */
export function ChangePasswordScreen() {
  const t = useT();
  const { session } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useTurnstile(captchaBox);
  const captchaToken = captcha.token ?? undefined;
  const waitingForCaptcha = captcha.enabled && !captcha.token;

  const email = session?.user.email ?? '';
  const available = isSupabaseConfigured() && !!email;
  const matches = repeat.length > 0 && next === repeat;
  const canSave = available && !busy && !waitingForCaptcha && current.length > 0 && next.length >= MIN_PASSWORD && matches;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = await getSupabase();
      const auth = await supabase.auth.signInWithPassword({ email, password: current, options: { captchaToken } });
      if (auth.error) throw auth.error;
      const { error: err } = await supabase.auth.updateUser({ password: next });
      if (err) throw err;
      setCurrent('');
      setNext('');
      setRepeat('');
      setNotice(t('set.pwChanged'));
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
      // A token works once, whatever happened.
      captcha.reset();
    }
  }

  async function sendReset() {
    if (!email) return;
    setError('');
    setNotice('');
    try {
      const supabase = await getSupabase();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
        captchaToken,
      });
      if (err) throw err;
      setNotice(fill(t('set.pwResetSent'), { email }));
    } catch (e) {
      setError(translateError(e));
    } finally {
      captcha.reset();
    }
  }

  return (
    <Screen title={t('set.changePassword')} subtitle={fill(t('set.pwIntro'), { n: MIN_PASSWORD })} back={{ label: t('set.profile'), to: '/ajustes/cuenta' }}>
      {!available && <p role="note" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t('set.pwNeedsAccount')}</p>}
      <form onSubmit={save}>
        <PasswordField id="pw-actual" label={t('set.pwCurrent')} placeholder={t('set.pwCurrentPlaceholder')}
          value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="pw-nueva" label={t('auth.newPassword')} placeholder={fill(t('set.pwMinPlaceholder'), { n: MIN_PASSWORD })}
          value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordStrength value={next} />
        <PasswordField id="pw-repetir" label={t('set.pwRepeat')} placeholder={t('set.pwRepeatPlaceholder')}
          value={repeat} onChange={setRepeat} autoComplete="new-password" />
        <p
          aria-live="polite"
          style={{
            margin: '8px 2px 0', height: 16, fontSize: 'var(--text-xs)', fontWeight: 600,
            color: matches ? 'var(--positive-text)' : 'var(--danger-text)',
          }}
        >
          {repeat ? (matches ? t('set.pwMatch') : t('set.pwNoMatch')) : ''}
        </p>

        {captcha.enabled && <div ref={captchaBox} style={{ minHeight: 65, marginTop: 14 }} />}

        <button
          type="submit"
          disabled={!canSave}
          style={{
            marginTop: 18, width: '100%', height: 52, borderRadius: 16, border: 'none', fontWeight: 700,
            fontSize: 'var(--text-md)', cursor: canSave ? 'pointer' : 'not-allowed',
            background: canSave ? 'var(--q10)' : 'var(--surface-sunken)',
            color: canSave ? 'var(--on-accent)' : 'var(--text-faint)',
          }}
        >
          {busy ? t('auth.oneMoment') : t('auth.savePassword')}
        </button>
      </form>

      {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)', textAlign: 'center' }}>{error}</p>}
      {notice && <p role="status" style={{ margin: '12px 0 0', fontSize: 'var(--text-sm)', color: 'var(--positive-text)', textAlign: 'center' }}>{notice}</p>}

      {available && (
        <button
          type="button"
          onClick={sendReset}
          disabled={waitingForCaptcha}
          style={{ marginTop: 12, width: '100%', minHeight: 'var(--tap)', border: 'none', background: 'none', color: 'var(--q10-text)', fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer' }}
        >
          {t('set.pwForgot')}
        </button>
      )}
    </Screen>
  );
}

function PasswordField({ id, label, placeholder, value, onChange, autoComplete }: {
  id: string; label: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoComplete: string;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)', margin: '0 2px 6px' }}>
        {label}
      </label>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 14px', borderRadius: 14,
        background: 'var(--surface)', border: '1px solid var(--line-strong)',
      }}>
        <IconLock aria-hidden size={19} stroke={1.8} style={{ color: 'var(--text-faint)', flex: 'none' }} />
        <input
          id={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 16 }}
        />
      </span>
    </div>
  );
}
