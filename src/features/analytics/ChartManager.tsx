import { useT } from '@/i18n/language';
import { useState } from 'react';
import {
  IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconX,
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
          width: '100%', height: 48, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 4, margin: '0 0 14px',
          borderRadius: 16, border: '1px solid var(--line-strong)',
          background: 'transparent', color: 'var(--text-muted)',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
        className="row-hover"
      >
        {t('analytics.organize')}
        {hiddenCount > 0 && (
          <span> · {hiddenCount} {hiddenCount === 1 ? t('analytics.hidden') : t('analytics.hiddenPl')}</span>
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
          borderRadius: '28px 28px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 19 }}>{t('analytics.organize')}</span>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label={t('action.close')}
            style={{
              width: 30, height: 30, borderRadius: 15, border: 'none', display: 'grid',
              placeItems: 'center', background: 'var(--surface-sunken)',
              color: 'var(--text-muted)', cursor: 'pointer', flex: 'none',
            }}
          >
            <IconX size={15} stroke={2} aria-hidden />
          </button>
        </div>
        <p style={{ margin: '2px 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>{t('analytics.organizeNote')}</p>

        <ul className="divided" style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--paper)', borderRadius: 16, overflow: 'hidden' }}>
          {layout.order.map((id, i) => {
            const hidden = layout.hiddenIds.includes(id);
            return (
              <li
                key={id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 14px',
                  opacity: hidden ? 0.45 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }}>
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
            width: '100%', height: 46, marginTop: 14,
            borderRadius: 14, border: '1px solid var(--line-strong)',
            background: 'none', color: 'var(--text-muted)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
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
