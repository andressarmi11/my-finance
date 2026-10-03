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

/**
 * Hand-off from "Eliminar cuenta": the login screen says the account is
 * gone. sessionStorage, like the email above: it survives the wipe's reload.
 */
export const ACCOUNT_DELETED_KEY = 'login.accountDeleted';

/** Whether the account was just deleted. Read-only: safe to call twice. */
export function readAccountDeleted(): boolean {
  try {
    return sessionStorage.getItem(ACCOUNT_DELETED_KEY) === '1';
  } catch {
    return false;
  }
}

export function forgetAccountDeleted(): void {
  try { sessionStorage.removeItem(ACCOUNT_DELETED_KEY); } catch { /* private mode */ }
}
