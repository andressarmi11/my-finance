import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './vapid';

describe('urlBase64ToUint8Array', () => {
  it('decodes a known base64url into the right bytes', () => {
    // "hola" en utf-8 = [104,111,108,97]; en base64 = "aG9sYQ==";
    // in base64url (no padding, - instead of +, _ instead of /) = "aG9sYQ"
    const result = urlBase64ToUint8Array('aG9sYQ');
    expect(Array.from(result)).toEqual([104, 111, 108, 97]);
  });

  it("handles base64url's - and _ characters correctly", () => {
    // bytes [251, 255, 191] -> standard base64 "+/+/" doesn't apply here;
    // we check with a real case: base64 "Pj4-Pw" contains a "-" that has
    // to become a "+" before decoding.
    const withDash = urlBase64ToUint8Array('Pj4-Pw');
    const standardEquivalent = Uint8Array.from(atob('Pj4+Pw=='), (c) => c.charCodeAt(0));
    expect(Array.from(withDash)).toEqual(Array.from(standardEquivalent));
  });
});
