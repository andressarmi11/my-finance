import { useT } from '@/i18n/language';
import { IconCheck } from '@tabler/icons-react';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import type { Category, PaymentMethod, Transaction } from '@/domain/types';
import { formatMoney } from '@/domain/money/format';
import { formatShortDate } from '@/lib/formatShortDate';

function shortDate(iso: string): string {
  const { day, month } = formatShortDate(iso);
  return `${day} ${month}`;
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
    : tx.status === 'cancelled' ? 'Cancelado'
    : t('status.pending');

  const statusColor =
    isPaid ? 'var(--positive)'
    : tx.status === 'cancelled' ? 'var(--text-faint)'
    : tx.status === 'scheduled' ? 'var(--committed)'
    : 'var(--text-faint)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
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
          color: marked ? '#fff' : 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
          transition: 'all var(--dur-fast) var(--ease-spring-out)',
        }}
      >
        <IconCheck size={15} stroke={2.6} aria-hidden />
      </button>

      <button
        type="button"
        onClick={inSelection ? onSeleccionar : onOpen}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)',
        }}
      >
        <CategoryAvatar
          icon={category?.icon ?? (isIncome ? 'salary' : 'other')}
          color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
          size={36}
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
