/** Hand-off from "Cerrar sesión" to the login screen (§9f): the email to pre-fill. */
export const SIGNED_OUT_EMAIL_KEY = 'login.signedOutEmail';

/** The email left by "Cerrar sesión", if any. Read-only: safe to call twice. */
export function readSignedOutEmail(): string {
  try {
    return sessionStorage.getItem(SIGNED_OUT_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Forget it once shown, so a later reload shows a clean form. */
export function forgetSignedOutEmail(): void {
  try { sessionStorage.removeItem(SIGNED_OUT_EMAIL_KEY); } catch { /* private mode */ }
}
