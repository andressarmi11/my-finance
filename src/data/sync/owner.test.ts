import { describe, expect, it } from 'vitest';
import { shouldWipe } from './owner';

/**
 * The full decision table. The case that matters is the third one:
 * without it, one person's transactions would end up uploaded to another
 * account using the same browser.
 */
describe('debeLimpiar — who owns the data on this device', () => {
  it('with no previous marker, does NOT wipe: it is someone who used the app without an account and is now signing up', () => {
    expect(shouldWipe(null, 'ana')).toBe(false);
  });

  it('the same person signing back in does NOT wipe', () => {
    expect(shouldWipe('ana', 'ana')).toBe(false);
  });

  it('another person DOES wipe', () => {
    expect(shouldWipe('ana', 'beto')).toBe(true);
  });

  it('distinguishes similar ids: starting the same is not enough', () => {
    expect(shouldWipe('user-1', 'user-10')).toBe(true);
    expect(shouldWipe('user-10', 'user-1')).toBe(true);
  });

  it('the empty string is a valid marker, not a "no marker"', () => {
    // If treated as absent, an empty id would adopt someone else's data.
    expect(shouldWipe('', 'ana')).toBe(true);
  });
});
