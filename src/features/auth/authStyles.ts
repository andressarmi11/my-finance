/** Styles shared by the account screens (sign in, new password). */
export const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 'var(--tap)', padding: '0 14px', marginBottom: 10,
  borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};

export const buttonStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
  background: 'var(--q10)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
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
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('user already registered')) return 'Ese correo ya tiene cuenta. Entra en vez de crearla.';
  if (m.includes('email not confirmed')) return 'Falta confirmar el correo. Revisa tu bandeja.';
  if (m.includes('password should be at least')) return `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  if (m.includes('new password should be different')) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  if (m.includes('auth session missing') || m.includes('session_not_found')) {
    return 'El enlace ya venció. Pide uno nuevo desde "¿Olvidaste tu contraseña?".';
  }
  if (m.includes('token has expired') || m.includes('otp_expired')) {
    return 'El enlace ya venció. Pide uno nuevo desde "¿Olvidaste tu contraseña?".';
  }
  if (m.includes('unable to validate email')) return 'Ese correo no parece válido.';
  if (m.includes('for security purposes') || m.includes('rate limit')) {
    return 'Demasiados intentos seguidos. Espera un momento.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Revisa tu internet.';
  return raw;
}
