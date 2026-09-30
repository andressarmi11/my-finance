import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';

/** Supabase's minimum; below it the password can't be used at all. */
const MIN_LENGTH = 8;

/**
 * How strong a password is, in the four steps the meter shows:
 *  0 empty · 1 "Muy corta" (under 8) · 2 "Débil" · 3 "Buena" · 4 "Fuerte".
 *
 * From 8 characters on it scores length (12 or more) and how many kinds of
 * character it mixes (lowercase, uppercase, digits, symbols). A rough guide,
 * not an entropy estimate: it's there so "12345678" doesn't read as fine.
 */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  if (pw.length < MIN_LENGTH) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  let score = 0;
  if (pw.length >= 12) score++;
  if (kinds >= 2) score++;
  if (kinds >= 3) score++;
  if (kinds >= 4) score++;
  if (score >= 3) return 4;
  if (score === 2) return 3;
  return 2;
}

const LABEL: Record<1 | 2 | 3 | 4, TextKey> = {
  1: 'login.strengthTooShort',
  2: 'login.strengthWeak',
  3: 'login.strengthGood',
  4: 'login.strengthStrong',
};
const BAR: Record<1 | 2 | 3 | 4, string> = { 1: 'var(--danger)', 2: 'var(--q25)', 3: 'var(--positive)', 4: 'var(--positive)' };
const TEXT: Record<1 | 2 | 3 | 4, string> = { 1: 'var(--danger-text)', 2: 'var(--q25-text)', 3: 'var(--positive-text)', 4: 'var(--positive-text)' };

/** Four segments that fill with the strength, and its name at the right. */
export function PasswordStrength({ value }: { value: string }) {
  const t = useT();
  const level = passwordStrength(value);
  const label = level ? t(LABEL[level]) : '';
  return (
    <div
      role="meter"
      aria-label={t('login.strength')}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={level}
      aria-valuetext={label || undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 2px 0' }}
    >
      <span style={{ flex: 1, display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: level && i <= level ? BAR[level] : 'var(--line)',
              transition: 'background var(--dur-fast) var(--ease-spring-out)',
            }}
          />
        ))}
      </span>
      <span style={{ minWidth: 70, textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 600, color: level ? TEXT[level] : 'var(--text-faint)' }}>
        {label}
      </span>
    </div>
  );
}
