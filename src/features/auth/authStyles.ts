import { translate } from '@/i18n/language';
/** Styles shared by the account screens (sign in, new password). */
export const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 'var(--tap)', padding: '0 14px', marginBottom: 10,
  borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};

export const buttonStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
  background: 'var(--q10)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
};

export const linkStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 12, minHeight: 'var(--tap)',
  background: 'none', border: 'none', color: 'var(--q10)',
  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
};

export const MIN_PASSWORD = 8;

/** Supabase's messages come in English and are cryptic for whoever uses the app. */
export function translateError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return translate('auth.wrongCredentials');
  if (m.includes('user already registered')) return translate('auth.emailTaken');
  if (m.includes('email not confirmed')) return translate('auth.confirmEmailFirst');
  if (m.includes('password should be at least')) return translate('auth.passwordTooShort').replace('{n}', String(MIN_PASSWORD));
  if (m.includes('new password should be different')) return translate('auth.passwordMustDiffer');
  if (m.includes('auth session missing') || m.includes('session_not_found')) {
    return translate('auth.linkExpired');
  }
  if (m.includes('token has expired') || m.includes('otp_expired')) {
    return translate('auth.linkExpired');
  }
  if (m.includes('unable to validate email')) return translate('auth.invalidEmail');
  if (m.includes('for security purposes') || m.includes('rate limit')) {
    return translate('auth.tooManyAttempts');
  }
  if (m.includes('failed to fetch') || m.includes('network')) return translate('auth.offline');
  return raw;
}
