import { useDialogo } from '@/components/ui/useDialogo';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { AllDone, InboxFields, NavPill, Segments, useSwipe } from './InboxFields';
import type { InboxReview } from './useInboxReview';

/**
 * Review, one at a time, on a phone or tablet (BANDEJA.md 3b,
 * BANDEJA-WEB.md): ‹ N de M › and tappable segments to move without
 * deciding, a swipe on the card too, everything corrected in place, and
 * "Anotar" off while the amount or the concept is missing. The desktop
 * draws the same review as a side panel (InboxPanel).
 */
export function InboxSheet({ review }: { review: InboxReview }) {
  const t = useT();
  const dialogRef = useDialogo(review.close);
  const swipe = useSwipe((dir) => review.move(dir));
  const d = review.current;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('inbox.navTitle')}
      onClick={review.close}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, black 55%, transparent)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, background: 'var(--surface)', borderRadius: '28px 28px 0 0',
          // While the undo toast shows it sits over the bottom of the sheet,
          // so the sheet makes room for it and the buttons stay above it.
          padding: `10px 18px calc(var(--safe-bottom) + ${review.toast ? 88 : 30}px)`,
          maxHeight: '92vh', overflowY: 'auto',
          transition: 'padding-bottom .3s cubic-bezier(.22,1,.36,1)',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 12px' }} />
        {!d ? <AllDone review={review} /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ flex: 1, margin: 0, fontWeight: 700, fontSize: 18 }}>{t('inbox.navTitle')}</h2>
              <NavPill review={review} />
              <button
                type="button"
                onClick={review.close}
                aria-label={t('action.close')}
                style={{
                  width: 30, height: 30, borderRadius: 15, border: 'none', background: 'var(--surface-sunken)',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
            <Segments review={review} />

            <InboxFields review={review} d={d} swipe={swipe} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={review.discard}
                disabled={review.busy}
                style={{
                  height: 50, borderRadius: 14, border: '1px solid var(--line-strong)', background: 'none',
                  fontWeight: 600, fontSize: 15, cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                {t('inbox.discard')}
              </button>
              <button
                type="button"
                onClick={review.accept}
                disabled={!review.canAccept}
                style={{
                  height: 50, borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 15,
                  cursor: review.canAccept ? 'pointer' : 'not-allowed',
                  background: review.canAccept ? 'var(--q10)' : 'var(--surface-sunken)',
                  color: review.canAccept ? 'var(--on-accent)' : 'var(--text-dim)',
                }}
              >
                {t(d.status === 'pending' ? 'inbox.schedule' : 'inbox.record')}
              </button>
            </div>
            {review.bulkCount >= 2 && (
              <button
                type="button"
                onClick={review.acceptAll}
                disabled={review.busy}
                style={{
                  width: '100%', marginTop: 6, height: 40, border: 'none', background: 'none',
                  color: 'var(--q10-text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                {fill(t('inbox.recordAllComplete'), { n: review.bulkCount })}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
