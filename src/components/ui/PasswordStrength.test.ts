import { describe, expect, it } from 'vitest';
import { passwordStrength } from './PasswordStrength';

describe('passwordStrength', () => {
  it('is 0 for an empty password', () => {
    expect(passwordStrength('')).toBe(0);
  });

  it('is 1 (too short) under 8 characters, whatever it mixes', () => {
    expect(passwordStrength('a')).toBe(1);
    expect(passwordStrength('Ab1!xyz')).toBe(1);
  });

  it('is 2 (weak) at 8+ characters of one kind', () => {
    expect(passwordStrength('abcdefgh')).toBe(2);
    expect(passwordStrength('12345678')).toBe(2);
  });

  it('is still weak with only two kinds and short', () => {
    expect(passwordStrength('abcdefg1')).toBe(2);
  });

  it('is 3 (good) with three kinds, or with length and two kinds', () => {
    expect(passwordStrength('Abcdefg1')).toBe(3);
    expect(passwordStrength('abcdefghijk1')).toBe(3);
  });

  it('is 4 (strong) mixing all four kinds, or long and three kinds', () => {
    expect(passwordStrength('Abcdef1!')).toBe(4);
    expect(passwordStrength('test-password-123')).toBe(4);
  });

  it('length alone is not enough for good', () => {
    expect(passwordStrength('abcdefghijklmnop')).toBe(2);
  });
});
