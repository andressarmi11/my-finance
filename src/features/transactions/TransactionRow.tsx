import { useT } from '@/i18n/language';
import { IconCheck } from '@tabler/icons-react';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import type { Category, PaymentMethod, Transaction } from '@/domain/types';
import { formatMoney } from '@/domain/money/format';
import { shortDay } from '@/lib/formatShortDate';
import { fill } from '@/lib/dateLabels';
import { formatRate } from '@/lib/currencies';

function shortDate(iso: string): string {
  return shortDay(iso);
}

/**
 * Transaction row. The amount goes on the SAME line as the concept, and
 * the status below it, on the right: the amount and status used to have
 * their own column and stole width from the text, so almost every
 * concept and subtitle came out truncated ("Zapatos (…)", "Débi…").
 */
export function TransactionRow({
  tx, category, paymentMethod, onTogglePaid, onOpen, selected, onSeleccionar,
}: {
  tx: Transaction;
  category: Category | undefined;
  paymentMethod: PaymentMethod | undefined;
  onTogglePaid: () => void;
  onOpen: () => void;
  /** With a value, the row is in selection mode: the circle selects
   *  instead of marking paid, and tapping the row also selects instead of opening the form. */
  selected?: boolean;
  onSeleccionar?: () => void;
}) {
  const t = useT();
  const inSelection = onSeleccionar !== undefined;
  const isIncome = tx.type === 'income';
  const isPaid = tx.status === 'paid';
  const isCredit = paymentMethod?.type === 'credit';

  // In selection mode the circle is blue (select); outside of it, green
  // (already paid). Two meanings, two colors.
  const marked = inSelection ? Boolean(selected) : isPaid;
  const brandColor = inSelection ? 'var(--q10)' : 'var(--positive)';

  const meta = [category?.name, shortDate(tx.date), paymentMethod?.name].filter(Boolean).join(' · ');

  const statusLabel =
    isPaid ? (isIncome ? t('status.received') : t('status.paid'))
    : tx.status === 'scheduled' ? t('status.scheduled')
    : tx.status === 'cancelled' ? t('status.cancelled')
    : t('status.pending');

  const statusColor =
    isPaid ? 'var(--positive)'
    : tx.status === 'cancelled' ? 'var(--text-faint)'
    : tx.status === 'scheduled' ? 'var(--committed)'
    : 'var(--text-faint)';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
        background: inSelection && selected ? 'color-mix(in srgb, var(--q10) 8%, transparent)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={inSelection ? onSeleccionar : onTogglePaid}
        aria-pressed={inSelection ? Boolean(selected) : isPaid}
        aria-label={inSelection
          ? t(selected ? 'transactions.removeFrom' : 'transactions.selectOne').replace('{c}', tx.concept)
          // The concept is put inside the label on purpose: with twenty
          // rows, twenty buttons named "Mark as paid" tell a screen
          // reader user nothing.
          : t('transactions.markAs')
              .replace('{c}', tx.concept)
              .replace('{state}', isPaid
                ? t(isIncome ? 'transactions.stateNotReceived' : 'transactions.statePending')
                : t(isIncome ? 'transactions.stateReceived' : 'transactions.statePaid'))}
        style={{
          width: 26, height: 26, minWidth: 26, borderRadius: 13, flex: 'none',
          // In selection mode the circle is blue (select), outside of it it's
          // green (already paid). Two meanings, two colors.
          border: `1.5px solid ${marked ? brandColor : 'var(--line-strong)'}`,
          background: marked ? brandColor : 'transparent',
          color: marked ? 'var(--on-accent)' : 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
          transition: 'all var(--dur-fast) var(--ease-spring-out)',
        }}
      >
        <IconCheck size={14} stroke={3} aria-hidden />
      </button>

      <button
        type="button"
        onClick={inSelection ? onSeleccionar : onOpen}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)',
        }}
      >
        <CategoryAvatar
          icon={category?.icon ?? (isIncome ? 'salary' : 'other')}
          color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
          size={38}
        />

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                flex: 1, minWidth: 0, fontSize: 'var(--text-md)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: tx.status === 'cancelled' ? 'line-through' : undefined,
              }}
            >
              {tx.concept}
            </span>
            <span
              className="figures"
              style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-md)', color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}
            >
              {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
            </span>
          </span>

          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
            <span
              style={{
                flex: 1, minWidth: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {meta}
            </span>
            <span style={{ flex: 'none', fontSize: 'var(--text-xs)', color: statusColor, fontWeight: 600 }}>
              {statusLabel}
            </span>
          </span>

          {/* Entered in another currency: the original, as a note. */}
          {tx.currency && tx.originalAmount != null && tx.fxRate != null && (
            <span className="figures" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 1 }}>
              {fill(t('form.originalNote'), {
                original: formatMoney(tx.originalAmount, tx.currency),
                currency: tx.currency,
                rate: formatRate(tx.fxRate),
              })}
            </span>
          )}

          {isCredit && tx.cyclePaymentDate && (
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--q25-text)', marginTop: 1 }}>
              {t('transactions.paidOnShort')} {shortDate(tx.cyclePaymentDate)}
              {/* The number lives in its own field, not inside the concept:
                  putting "Nevera 3/12" in the text would poison the
                  conceptIndex that feeds the form's autocomplete. */}
              {tx.installmentCount && tx.installmentCount > 1
                ? ` · ${t('transactions.installmentOf').replace('{n}', String(tx.installmentNumber)).replace('{total}', String(tx.installmentCount))}`
                : ''}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

/** The desktop table (§9g): check · concept + category · date · method · status · amount. */
export const TABLE_COLUMNS = '32px minmax(0, 1fr) 90px 100px 96px 140px';

/**
 * The same transaction as a table row, for Movimientos embedded in Inicio on
 * desktop. Same buttons and names as the phone row — the circle marks it
 * paid (or selects it while selecting) and the concept opens the form — so
 * nothing about what a row does changes with the width.
 */
export function TransactionTableRow({
  tx, category, paymentMethod, onTogglePaid, onOpen, selected, onSeleccionar,
}: Parameters<typeof TransactionRow>[0]) {
  const t = useT();
  const inSelection = onSeleccionar !== undefined;
  const isIncome = tx.type === 'income';
  const isPaid = tx.status === 'paid';
  const marked = inSelection ? Boolean(selected) : isPaid;
  const brandColor = inSelection ? 'var(--q10)' : 'var(--positive)';
  const primary = inSelection ? onSeleccionar : onOpen;

  const statusLabel =
    isPaid ? (isIncome ? t('status.received') : t('status.paid'))
    : tx.status === 'scheduled' ? t('status.scheduled')
    : tx.status === 'cancelled' ? t('status.cancelled')
    : t('status.pending');
  const statusColor =
    isPaid ? 'var(--positive-text)'
    : tx.status === 'scheduled' ? 'var(--committed)'
    : 'var(--text-faint)'; // pending and cancelled: grey, as in the prototype

  return (
    // The whole row is a mouse target; keyboard and screen readers use the
    // two real buttons inside it.
    <div
      className="row-hover"
      data-testid="tx-table-row"
      onClick={primary}
      style={{
        display: 'grid', gridTemplateColumns: TABLE_COLUMNS, gap: 12, alignItems: 'center',
        padding: 8, borderRadius: 12, background: selected ? 'var(--q10-soft)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (inSelection) onSeleccionar?.(); else onTogglePaid(); }}
        aria-pressed={inSelection ? Boolean(selected) : isPaid}
        aria-label={inSelection
          ? t(selected ? 'transactions.removeFrom' : 'transactions.selectOne').replace('{c}', tx.concept)
          : t('transactions.markAs')
              .replace('{c}', tx.concept)
              .replace('{state}', isPaid
                ? t(isIncome ? 'transactions.stateNotReceived' : 'transactions.statePending')
                : t(isIncome ? 'transactions.stateReceived' : 'transactions.statePaid'))}
        style={{
          width: 24, height: 24, borderRadius: 12, padding: 0,
          border: `1.5px solid ${marked ? brandColor : 'var(--line-strong)'}`,
          background: marked ? brandColor : 'transparent',
          color: marked ? 'var(--on-accent)' : 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          transition: 'all var(--dur-fast) var(--ease-spring-out)',
        }}
      >
        <IconCheck size={14} stroke={2.6} aria-hidden />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); primary?.(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: 0,
          border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
        }}
      >
        <CategoryAvatar
          icon={category?.icon ?? (isIncome ? 'salary' : 'other')}
          color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
          size={36}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: tx.status === 'cancelled' ? 'line-through' : undefined,
          }}>
            {tx.concept}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {category?.name ?? t('analytics.noCategory')}
            {tx.currency && tx.originalAmount != null && tx.fxRate != null
              ? ` · ${fill(t('form.originalNote'), { original: formatMoney(tx.originalAmount, tx.currency), currency: tx.currency, rate: formatRate(tx.fxRate) })}`
              : ''}
          </span>
        </span>
      </button>

      <span className="figures" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{shortDate(tx.date)}</span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {paymentMethod?.name ?? '—'}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
      <span className="figures" style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}>
        {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
      </span>
    </div>
  );
}
