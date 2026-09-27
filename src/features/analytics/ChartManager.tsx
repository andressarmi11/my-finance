import { useT } from '@/i18n/language';
import { useState } from 'react';
import {
  IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconLayoutGrid, IconX,
} from '@tabler/icons-react';
import { useDialogo } from '@/components/ui/useDialogo';
import {
  toggleHidden, saveChartLayout, move, DEFAULT_ORDER,
  type ChartLayout, type ChartId,
} from './chartLayout';

/**
 * Choosing which charts are shown and in what order.
 *
 * Arrows rather than dragging: drag-and-drop in a short list inside a modal
 * sheet on mobile is fragile —it competes with the sheet's scroll and with
 * the gesture that closes it— and it's also unreachable by keyboard and by
 * screen reader. Two buttons per row do the same job, work with any input,
 * and there's nothing that can be dropped in the wrong place.
 */
export function ChartManager({ layout, titles, onChange }: {
  layout: ChartLayout;
  titles: Record<ChartId, string>;
  onChange: (d: ChartLayout) => void;
}) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const dialogRef = useDialogo(() => setAbierto(false), abierto);

  const hiddenCount = layout.hiddenIds.length;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          width: '100%', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 14,
          borderRadius: 'var(--radius-s)', border: '1px dashed var(--line-strong)',
          background: 'var(--surface)', color: 'var(--text-muted)',
          fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
        }}
      >
        <IconLayoutGrid size={17} stroke={1.75} aria-hidden />
        {t('analytics.organize')}
        {hiddenCount > 0 && (
          <span style={{ color: 'var(--text-faint)' }}>· {hiddenCount} {hiddenCount === 1 ? t('analytics.hidden') : t('analytics.hiddenPl')}</span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('analytics.organize')}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 60,
      }}
      onClick={() => setAbierto(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label={t('action.close')}
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', display: 'grid',
              placeItems: 'center', background: 'var(--surface-sunken)',
              color: 'var(--text-muted)', cursor: 'pointer', flex: 'none',
            }}
          >
            <IconX size={17} stroke={2.2} aria-hidden />
          </button>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{t('analytics.organize')}</span>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {layout.order.map((id, i) => {
            const hidden = layout.hiddenIds.includes(id);
            return (
              <li
                key={id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
                  borderBottom: '1px solid var(--line)', opacity: hidden ? 0.55 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--text-base)' }}>
                  {titles[id]}
                </span>

                <IconBtn
                  label={`${t('analytics.moveUp')} ${titles[id]}`}
                  disabled={i === 0}
                  onClick={() => onChange({ ...layout, order: move(layout.order, id, -1) })}
                >
                  <IconArrowUp size={17} stroke={2} />
                </IconBtn>
                <IconBtn
                  label={`${t('analytics.moveDown')} ${titles[id]}`}
                  disabled={i === layout.order.length - 1}
                  onClick={() => onChange({ ...layout, order: move(layout.order, id, 1) })}
                >
                  <IconArrowDown size={17} stroke={2} />
                </IconBtn>
                <IconBtn
                  label={`${hidden ? t('analytics.show') : t('analytics.hide')} ${titles[id]}`}
                  onClick={() => onChange({ ...layout, hiddenIds: toggleHidden(layout.hiddenIds, id) })}
                >
                  {hidden
                    ? <IconEyeOff size={17} stroke={1.9} color="var(--text-faint)" />
                    : <IconEye size={17} stroke={1.9} />}
                </IconBtn>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            const base = { order: DEFAULT_ORDER, hiddenIds: [] };
            saveChartLayout(base);
            onChange(base);
          }}
          style={{
            width: '100%', minHeight: 'var(--tap)', marginTop: 14,
            borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text-muted)',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          {t('analytics.originalOrder')}
        </button>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
        borderRadius: 10, border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: disabled ? 'var(--line-strong)' : 'var(--text-muted)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
