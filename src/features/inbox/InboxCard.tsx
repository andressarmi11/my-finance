import { IconBolt } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { useT } from '@/i18n/language';
import { EMPTY } from '@/lib/empty';
import { fill } from '@/lib/dateLabels';
import { useInboxContext } from './InboxProvider';
import { useSourceLine } from './InboxFields';

/**
 * "4 por revisar" on Inicio, between the flow grid and "Falta este mes"
 * (BANDEJA.md). Only while something waits: at most two rows, then
 * "Revisar los N".
 */
export function InboxCard({ style }: { style?: React.CSSProperties }) {
  const t = useT();
  const { enabled, items, openAt } = useInboxContext();
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const sourceLine = useSourceLine();
  if (!enabled || items.length === 0) return null;
  const n = items.length;

  return (
    <section
      aria-label={t('inbox.reviewTitle')}
      style={{
        background: 'var(--surface)', borderRadius: 20, overflow: 'hidden',
        border: '1px solid color-mix(in srgb, var(--q25) 20%, var(--line))', ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 10px' }}>
        <span
          aria-hidden
          style={{
            width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center',
            background: 'color-mix(in srgb, var(--q25) 14%, transparent)', color: 'var(--q25)',
          }}
        >
          <IconBolt size={17} stroke={2} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
            {n === 1 ? t('inbox.pendingOne') : fill(t('inbox.pendingMany'), { n })}
          </h2>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{t('inbox.cardNote')}</span>
        </span>
      </div>

      {items.slice(0, 2).map((d) => {
        const cat = categories.find((c) => c.id === d.categoryId);
        const income = d.type === 'income';
        const noAmount = d.amount == null;
        const meta = d.missing === 'amount' ? t('inbox.missingAmountRow')
          : d.missing === 'concept' ? t('inbox.missingConceptRow')
          : sourceLine(d, false);
        return (
          <button
            key={d.entry.id}
            type="button"
            onClick={() => openAt(d.entry.id)}
            className="row-hover"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              border: 'none', borderTop: '1px solid var(--line)', background: 'none', cursor: 'pointer',
              textAlign: 'left', color: 'var(--text)',
            }}
          >
            <CategoryAvatar
              icon={cat?.icon ?? (income ? 'salary' : 'other')}
              color={cat ? categoryColor(cat) : UNCATEGORIZED_COLOR}
              size={36}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.concept || '—'}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: d.missing ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                {meta}
              </span>
            </span>
            <span
              className="figures"
              style={{
                flex: 'none', fontWeight: 700, fontSize: 15,
                color: noAmount ? 'var(--danger-text)' : income ? 'var(--positive-text)' : 'var(--text)',
              }}
            >
              {noAmount ? t('inbox.noAmount') : `${income ? '+ ' : ''}${formatMoney(d.amount!, d.currency)}`}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => openAt()}
        className="row-hover"
        style={{
          width: '100%', height: 46, border: 'none', borderTop: '1px solid var(--line)', background: 'none',
          color: 'var(--q10-text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        {n > 2 ? fill(t('inbox.reviewAll'), { n }) : t('inbox.review')}
      </button>
    </section>
  );
}
