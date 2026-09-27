import { describe, expect, it } from 'vitest';
import { isRecoveryUrl } from './recovery';

const BASE = 'https://andressarmi11.github.io/step-up/';

describe('esUrlDeRecuperacion', () => {
  it('recognizes the implicit flow, with the token in the fragment', () => {
    expect(isRecoveryUrl(
      `${BASE}#access_token=abc&expires_in=3600&refresh_token=xyz&token_type=bearer&type=recovery`,
    )).toBe(true);
  });

  it('recognizes the PKCE flow, with type in the query', () => {
    expect(isRecoveryUrl(`${BASE}?code=abc&type=recovery`)).toBe(true);
  });

  it("doesn't confuse the confirm-email link with the recovery one", () => {
    expect(isRecoveryUrl(`${BASE}#access_token=abc&type=signup`)).toBe(false);
    expect(isRecoveryUrl(`${BASE}#access_token=abc&type=magiclink`)).toBe(false);
  });

  it("a normal app URL doesn't trigger the mode", () => {
    expect(isRecoveryUrl(BASE)).toBe(false);
    expect(isRecoveryUrl(`${BASE}movimientos?nuevo=1&tipo=ingreso`)).toBe(false);
  });

  it("doesn't blow up on garbage", () => {
    expect(isRecoveryUrl('no-es-una-url')).toBe(false);
    expect(isRecoveryUrl('')).toBe(false);
  });
});
