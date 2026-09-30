import { describe, expect, it } from 'vitest';
import { breakpointFor, DESKTOP_MIN, TABLET_MIN } from './useBreakpoint';

describe('breakpointFor', () => {
  it('phone below the tablet width', () => {
    expect(breakpointFor(320)).toBe('phone');
    expect(breakpointFor(TABLET_MIN - 1)).toBe('phone');
  });
  it('tablet from 760 up to 1099', () => {
    expect(breakpointFor(TABLET_MIN)).toBe('tablet');
    expect(breakpointFor(DESKTOP_MIN - 1)).toBe('tablet');
  });
  it('desktop from 1100', () => {
    expect(breakpointFor(DESKTOP_MIN)).toBe('desktop');
    expect(breakpointFor(1920)).toBe('desktop');
  });
});
