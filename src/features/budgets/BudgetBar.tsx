import { formatMoney } from '@/domain/money/format';
import { useT } from '@/i18n/language';

/**
 * The budget bar: the grey track IS the budgeted amount and the fill IS
 * what's been spent. It reads without a legend, because the empty part
 * means "what you have left" — the same metaphor as a fuel tank.
 *
 * Three decisions that aren't cosmetic:
 *
 * 1. Going over budget does NOT pin the bar at 100%. It splits: the part up
 *    to the cap keeps the status colour and the overflow is drawn
 *    separately, hatched. A bar full at 100% looks the same 1% over as it
 *    does 80% over, and that's exactly the difference that matters.
 * 2. There's a "today" marker on the bar: where you should be if you spent
 *    evenly across the month. Without it, 60% spent says nothing — it
 *    depends on whether it's the 5th or the 25th.
 * 3. The text says how much is LEFT, not how much was spent. That's the
 *    question the person came to ask.
 */
export function BudgetBar({ spent, budgeted, status, monthProgress }: {
  spent: number;
  budgeted: number;
  status: 'ok' | 'warning' | 'exceeded';
  /** 0..1 — how far into the month we are. Draws the pace marker. */
  monthProgress?: number;
}) {
  const t = useT();
  const color = STATE_COLOR[status];
  const ratio = budgeted > 0 ? spent / budgeted : 0;
  const within = Math.min(1, ratio);
  const exceeded = Math.max(0, ratio - 1);
  // The overflow is shown up to a cap: past double, the bar has already
  // said everything it had to say and stretching it only shrinks the rest.
  const overflowWidth = Math.min(exceeded, 1);
  const left = budgeted - spent;

  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(ratio * 100)}% del presupuesto`}
        style={{
          position: 'relative',
          display: 'flex',
          height: 10,
          borderRadius: 5,
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            width: `${within * 100}%`,
            background: color,
            transition: 'width var(--dur-med, 240ms) var(--ease-spring-out, ease-out)',
          }}
        />
        {overflowWidth > 0 && (
          <span
            style={{
              width: `${overflowWidth * 100}%`,
              // Hatched: the overflow isn't "more budget", it's another thing.
              backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 4px, color-mix(in srgb, ${color} 45%, transparent) 4px 8px)`,
            }}
          />
        )}

        {/* No pace marker once you're over: at that point the question is
            no longer "am I on pace" but "by how much did I go over", and the
            marker lands inside the hatched part where it only adds noise. */}
        {status !== 'exceeded' && monthProgress !== undefined && monthProgress > 0 && monthProgress < 1 && (
          <span
            aria-hidden
            title={t('budgets.whereYouShouldBe')}
            style={{
              position: 'absolute',
              left: `${monthProgress * 100}%`,
              top: -2,
              bottom: -2,
              width: 2,
              borderRadius: 1,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--text) 35%, transparent)',
            }}
          />
        )}
      </div>

      <p style={{ margin: '7px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {left >= 0 ? (
          <>Te quedan <strong style={{ color: 'var(--text)' }}>{formatMoney(left)}</strong></>
        ) : (
          <span style={{ color: 'var(--danger-text)' }}>
            {t('budgets.overBy')} <strong>{formatMoney(Math.abs(left))}</strong>
          </span>
        )}
      </p>
    </>
  );
}

const STATE_COLOR: Record<'ok' | 'warning' | 'exceeded', string> = {
  ok: 'var(--positive)',
  warning: 'var(--q25)',
  exceeded: 'var(--danger)',
};
