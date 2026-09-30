import { IconX } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { useDialogo } from '@/components/ui/useDialogo';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { localRepository } from '@/data/local/localRepository';
import type { Transaction } from '@/domain/types';
import type { Outstanding } from '@/domain/totals/outstanding';
import { formatMoney } from '@/domain/money/format';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { compareISO } from '@/domain/dates';
import { shortDay } from '@/lib/formatShortDate';
import { EMPTY } from '@/lib/empty';
import { useT } from '@/i18n/language';
import { relevantDate } from './upcoming';

/**
 * Breakdown of "Falta pagar" (prototype 1a, "Desglose"): the total, how it
 * splits into pending / scheduled / on card, and what's in it.
 *
 * Receives the breakdown ALREADY computed, with disjoint sets. It used to
 * receive three overlapping lists and sum them again here, so it showed
 * more money than the number that opened it and listed the same
 * transaction twice. See domain/totals/outstanding.ts.
 */
export function ToPaySheet({
  toPay,
  onClose,
}: {
  toPay: Outstanding;
  onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const { pending, scheduled, onCard } = toPay;
  const rows = useMemo(
    () => [...pending, ...scheduled, ...onCard].sort((a, b) => compareISO(relevantDate(a), relevantDate(b))),
    [pending, scheduled, onCard],
  );

  const go = (to: string) => { navigate(to); onClose(); };

  const dialogRef = useDialogo(onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('toPay.dialog')}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--surface)',
          borderRadius: '28px 28px 0 0',
          padding: '10px 20px calc(var(--safe-bottom) + 30px)',
          maxHeight: 'calc(100% - 54px)',
          overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{t('toPay.thisMonth')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            style={{
              width: 30, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer',
              background: 'var(--surface-sunken)', color: 'var(--text-muted)', display: 'grid', placeItems: 'center',
            }}
          >
            <IconX size={15} stroke={2} aria-hidden />
          </button>
        </div>
        <div
          className="figures"
          style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--danger-text)', marginTop: 2 }}
        >
          {formatMoney(toPay.amount)}
        </div>

        {/* The three kinds, each a way into its own list. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '16px 0' }}>
          <Stat
            count={pending.length}
            label={t('toPay.pendingRow')}
            title={t('toPay.pendingHelp')}
            onClick={() => go('/movimientos?estado=pending')}
          />
          <Stat
            count={scheduled.length}
            label={t('toPay.scheduledRow')}
            title={t('toPay.scheduledHelp')}
            onClick={() => go('/movimientos?estado=scheduled')}
          />
          <Stat
            count={onCard.length}
            label={t('toPay.onCardRow')}
            title={t('toPay.onCardHelp')}
            onClick={() => go('/tarjeta')}
          />
        </div>

        <div className="divided" style={{ background: 'var(--paper)', borderRadius: 18, overflow: 'hidden' }}>
          {rows.map((tx) => <Row key={tx.id} tx={tx} category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined} />)}
          {rows.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--positive-text)', fontSize: 14, fontWeight: 600 }}>
              {t('toPay.allPaid')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ count, label, title, onClick }: { count: number; label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="row-hover"
      style={{
        border: 'none', borderRadius: 14, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface-sunken)', color: 'var(--text)',
      }}
    >
      <span className="figures" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: count === 0 ? 'var(--text-faint)' : 'var(--text)' }}>
        {count}
      </span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    </button>
  );
}

function Row({ tx, category }: { tx: Transaction; category: import('@/domain/types').Category | undefined }) {

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
      <CategoryAvatar
        icon={category?.icon ?? 'other'}
        color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
        size={34}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.concept}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{shortDay(relevantDate(tx))}</span>
      </span>
      <span className="figures" style={{ flex: 'none', fontWeight: 700, fontSize: 15 }}>{formatMoney(tx.amount)}</span>
    </div>
  );
}
