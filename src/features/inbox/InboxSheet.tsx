import { IconBolt, IconCalendar, IconMessage, IconMicrophone, type IconProps } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { closeEntry, type InboxEntry } from '@/data/supabase/inbox';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { describeParsed } from '@/domain/nlp/describe';
import { interpretText } from '@/domain/nlp/interpret';
import type { Transaction } from '@/domain/types';
import { haptic } from '@/lib/haptic';
import { nowISO, todayISO } from '@/lib/todayISO';
import { EMPTY } from '@/lib/empty';
import { useT } from '@/i18n/language';
import { dateLabel, fill } from '@/lib/dateLabels';
import { formatMoney } from '@/domain/money/format';

const ICON_SOURCE: Record<string, ComponentType<IconProps>> = {
  sms: IconMessage,
  dictation: IconMicrophone,
  atajo: IconBolt,
};

/**
 * What arrived on its own, waiting for a tap.
 *
 * Confirming instead of saving directly is on purpose: what comes in here was
 * written by a bank, not the user. A misread amount that gets saved without
 * anyone looking at it is worse than typing it in.
 */
export function InboxSheet({ entradas, onClose, onCambio }: {
  entradas: InboxEntry[];
  onClose: () => void;
  onCambio: () => void;
}) {
  const t = useT();
  const [processing, setProcesando] = useState<string | null>(null);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const cats = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const methodRows = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? EMPTY;
  const today = todayISO();
  const categoryIds = useMemo(() => cats.map((c) => c.id), [cats]);

  function interpret(entrada: InboxEntry) {
    // Same interpretation as quick entry and the Shortcut link.
    const { parsed, categoryId, paymentMethodId, fromLearning } = interpretText(entrada.text, today, {
      conceptIndex,
      categoryIds,
      methodRows,
      defaultMethodId: settings.defaultPaymentMethodId ?? null,
    });
    const desc = describeParsed(parsed, {
      today, categoryId, cats, paymentMethodId, methodRows,
      learned: fromLearning,
    });
    return { parsed, categoryId, paymentMethodId, desc };
  }

  async function record(entrada: InboxEntry) {
    const { parsed, categoryId, paymentMethodId } = interpret(entrada);
    if (parsed.amount == null || !parsed.concept) return;

    setProcesando(entrada.id);
    try {
      const method = methodRows.find((m) => m.id === paymentMethodId);
      const cycle = method?.type === 'credit'
        ? calculateCreditCardCycle(parsed.date, method.cutoffDay, method.paymentDay)
        : null;
      const now = nowISO();
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: parsed.type,
        concept: parsed.concept,
        amount: parsed.amount,
        date: parsed.date,
        categoryId,
        paymentMethodId,
        status: parsed.yaOcurrio ? 'paid' : 'pending',
        quincenaKey: null,
        cycleCutoffDate: cycle?.cycleCutoff,
        cyclePaymentDate: cycle?.paymentDate,
        createdAt: now,
        updatedAt: now,
      };
      await localRepository.saveTransaction(tx);
      await closeEntry(entrada.id, 'done');
      haptic('medium');
      onCambio();
    } finally {
      setProcesando(null);
    }
  }

  async function descartar(entrada: InboxEntry) {
    setProcesando(entrada.id);
    try {
      await closeEntry(entrada.id, 'discarded');
      haptic('light');
      onCambio();
    } finally {
      setProcesando(null);
    }
  }

  const dialogRef = useDialogo(onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('inbox.ariaLabel')}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '88vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 14px' }} />
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>{t('inbox.title')}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('inbox.checkAmount')}
        </p>

        {entradas.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>{t('inbox.nothingPending')}</p>
        )}

        {entradas.map((e) => {
          const { parsed, desc } = interpret(e);
          const full = parsed.amount != null && parsed.concept.length > 0;
          const busy = processing === e.id;
          // Future-dated: it will NOT count today, and the user has to know,
          // or "Anotar" reads as "it's already been charged".
          const scheduled = !parsed.yaOcurrio;
          const income = parsed.type === 'income';
          return (
            <div
              key={e.id}
              style={{
                border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
                padding: '12px 14px', marginBottom: 10, background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                {(() => { const I = ICON_SOURCE[e.origen] ?? IconBolt; return <I size={17} stroke={1.75} aria-hidden />; })()}
                <span style={{ flex: 1, fontSize: 'var(--text-md)', fontWeight: 600 }}>{desc.summary}</span>
              </div>
              {scheduled && full && (
                <>
                  <p
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 0 6px', padding: '4px 10px',
                      borderRadius: 999, background: 'var(--q10-soft)', color: 'var(--q10-text)',
                      fontSize: 'var(--text-sm)', fontWeight: 700,
                    }}
                  >
                    <IconCalendar size={15} stroke={2} aria-hidden />
                    {fill(t(income ? 'inbox.expected' : 'inbox.scheduled'), { date: dateLabel(parsed.date, t) })}
                  </p>
                  <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    {fill(t(income ? 'inbox.notCountedToday' : 'inbox.notTakenToday'), { date: dateLabel(parsed.date, t, 'long') })}
                  </p>
                </>
              )}
              {desc.missing && (
                <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>
                  {desc.missing} {t('inbox.couldNotRead')}
                </p>
              )}
              {desc.note && !desc.missing && (
                <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{desc.note}</p>
              )}
              <details style={{ marginBottom: 10 }}>
                <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', cursor: 'pointer' }}>
                  {t('inbox.seeOriginal')}
                </summary>
                <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                  {e.text}
                </p>
              </details>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => record(e)}
                  aria-label={scheduled && full
                    ? fill(t('inbox.scheduleAria'), { amount: formatMoney(parsed.amount ?? 0), date: dateLabel(parsed.date, t, 'long') })
                    : undefined}
                  disabled={!full || busy}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none',
                    background: full ? 'var(--q10)' : 'var(--surface-sunken)',
                    color: full ? '#fff' : 'var(--text-faint)',
                    fontWeight: 700, cursor: full ? 'pointer' : 'not-allowed',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {busy ? '…' : t(scheduled ? 'inbox.schedule' : 'inbox.record')}
                </button>
                <button
                  type="button"
                  onClick={() => descartar(e)}
                  disabled={busy}
                  style={{
                    flex: 'none', minWidth: 110, minHeight: 44, borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--line-strong)', background: 'var(--surface)',
                    color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {t('inbox.discard')}
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', marginTop: 8, minHeight: 44, borderRadius: 'var(--radius-s)',
            border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)',
            fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
          }}
        >
          {t('action.close')}
        </button>
      </div>
    </div>
  );
}
