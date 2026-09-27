/**
 * Haptic feedback helper for the iOS PWA (supported from iOS 16.4+).
 * On devices without support it's a silent no-op.
 */

type Intensity = 'light' | 'medium' | 'heavy';

const durations: Record<Intensity, number> = {
  light: 10,
  medium: 20,
  heavy: 30,
};

export function haptic(intensity: Intensity = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(durations[intensity]);
  }
}
