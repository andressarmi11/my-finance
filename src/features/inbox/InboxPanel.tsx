import { useEffect, useRef } from 'react';
import { formatMoney } from '@/domain/money/format';
import { useDialogo } from '@/components/ui/useDialogo';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { AllDone, InboxFields, NavPill } from './InboxFields';
import { queueTone } from './review';
import type { InboxReview } from './useInboxReview';

const DOT: Record<ReturnType<typeof queueTone>, string> = {
  ok: 'var(--positive)',
  future: 'var(--q10)',
  missing: 'var(--danger)',
};

/**
 * The review on desktop (BANDEJA-WEB.md, prototype 4a): a 480 px panel on
 * the right, full height, so the table stays visible behind it. The whole
 * queue on top (click to jump), the same editable card as the phone with the
 * original message always open, and a fixed foot with the keys.
 *
 * Keyboard: ⏎ records, ⌫ discards (not while typing), ↑/↓ move always,
 * ←/→ move when not in a field, Esc closes.
 */
export function InboxPanel({ review }: { review: InboxReview }) {
  const t = useT();
  const panelRef = useDialogo(review.close);
  const d = review.current;
  const acceptRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // The latest review for the key handler, without re-binding it each render.
  const live = useRef(review);
  useEffect(() => { live.current = review; });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const r = live.current;
      if (!r.current) return;
      const target = e.target as HTMLElement | null;
      const inField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const onOtherButton = target instanceof HTMLButtonElement && target !== acceptRef.current;
      if (e.key === 'Enter' && !onOtherButton) {
        e.preventDefault();
        r.accept();
      } else if (e.key === 'Backspace' && !inField) {
        e.preventDefault();
        r.discard();
      } else if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && !inField)) {
        e.preventDefault();
        r.move(1);
      } else if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && !inField)) {
        e.preventDefault();
        r.move(-1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ⏎ records, so focus starts on "Anotar" — or on the amount when that's
  // what's missing — never on ✕. After useDialogo's own initial focus.
  const entryId = d?.entry.id;
  const missingAmount = d?.missing === 'amount';
  useEffect(() => {
    if (!entryId) return;
    const id = setTimeout(() => (missingAmount ? amountRef.current : acceptRef.current)?.focus(), 0);
    return () => clearTimeout(id);
    // Only when the entry changes, never while the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  return (
    <div
      role="dialog"
      aria-label={t('inbox.navTitle')}
      aria-description={t('inbox.shortcutsHint')}
      className="dialog-wide"
      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
    >
      <div
        onClick={review.close}
        style={{
          position: 'absolute', inset: 0, background: 'color-mix(in srgb, black 45%, transparent)',
          animation: 'fadeIn .25s ease-out',
        }}
      />
      <aside
        ref={panelRef as React.RefObject<HTMLElement>}
        data-testid="inbox-panel"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderLeft: '1px solid var(--line-strong)',
          boxShadow: '-30px 0 60px color-mix(in srgb, black 40%, transparent)',
          animation: 'inboxPanelIn .38s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <style>{'@keyframes inboxPanelIn { from { transform: translateX(105%); } to { transform: none; } }'}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 22px 0' }}>
          <h2 style={{ flex: 1, margin: 0, fontWeight: 700, fontSize: 20 }}>{t('inbox.navTitle')}</h2>
          {d && <NavPill review={review} radius={16} />}
          <button
            type="button"
            onClick={review.close}
            aria-label={t('action.close')}
            aria-keyshortcuts="Escape"
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', background: 'var(--surface-sunken)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {!d ? <AllDone review={review} compact /> : (
          <>
            <div style={{ padding: '12px 22px 0' }}>
              <div role="list" aria-label={t('inbox.navTitle')} style={{ background: 'var(--paper)', borderRadius: 14, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                {review.items.map((q, i) => {
                  const on = i === review.idx;
                  const missing = queueTone(q) === 'missing';
                  return (
                    <button
                      key={q.entry.id}
                      type="button"
                      role="listitem"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => review.goTo(i)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--line)', cursor: 'pointer', textAlign: 'left',
                        background: on ? 'var(--q10-soft)' : 'transparent', color: 'var(--text)',
                      }}
                    >
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, flex: 'none', background: DOT[queueTone(q)] }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q.concept || '—'}
                      </span>
                      <span
                        className="figures"
                        style={{
                          flex: 'none', fontSize: 13, fontWeight: 700,
                          color: missing && q.amount == null ? 'var(--danger-text)' : q.type === 'income' ? 'var(--positive-text)' : 'var(--text)',
                        }}
                      >
                        {q.amount == null ? t('inbox.missingAmountShort') : formatMoney(q.amount, q.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 0' }}>
              <InboxFields review={review} d={d} originalAlwaysOpen amountRef={amountRef} padding={18} />
            </div>

            <div style={{ padding: '14px 22px 20px', borderTop: '1px solid var(--line)', marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={review.discard}
                  disabled={review.busy}
                  aria-keyshortcuts="Backspace"
                  style={{
                    height: 46, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'none',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {t('inbox.discard')}
                  <kbd style={KBD}>⌫</kbd>
                </button>
                <button
                  ref={acceptRef}
                  type="button"
                  onClick={review.accept}
                  disabled={!review.canAccept}
                  aria-keyshortcuts="Enter"
                  style={{
                    height: 46, borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14,
                    cursor: review.canAccept ? 'pointer' : 'not-allowed',
                    background: review.canAccept ? 'var(--q10)' : 'var(--surface-sunken)',
                    color: review.canAccept ? 'var(--on-accent)' : 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {t(d.status === 'pending' ? 'inbox.schedule' : 'inbox.record')}
                  <kbd style={{ ...KBD, borderColor: 'currentColor', opacity: 0.6 }}>⏎</kbd>
                </button>
              </div>
              {review.bulkCount >= 2 && (
                <button
                  type="button"
                  onClick={review.acceptAll}
                  disabled={review.busy}
                  style={{
                    width: '100%', marginTop: 6, height: 36, border: 'none', background: 'none',
                    color: 'var(--q10-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {fill(t('inbox.recordAllComplete'), { n: review.bulkCount })}
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

const KBD: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 11, border: '1px solid var(--line-strong)', borderRadius: 5, padding: '0 5px',
};
