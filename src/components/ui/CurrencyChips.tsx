import { useLayoutEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/language';
import { CURRENCIES, flagOf } from '@/lib/currencies';

/**
 * Currency of one transaction (redesign §9b): the quick ones (3 by default,
 * with flags) and "Más" for the rest. A currency picked from "Más" stays as
 * a fourth chip. The row is centred when it fits and scrolls from the left
 * when it doesn't (`justify-content: safe center`).
 */
export function CurrencyChips({ value, quick, onChange, align = 'center' }: {
  value: string;
  /** Already includes the main currency (see quickCurrencyList). */
  quick: string[];
  onChange: (code: string) => void;
  /** 'start' in the desktop form: left-aligned and wrapping, under its label. */
  align?: 'center' | 'start';
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const shown = expanded
    ? CURRENCIES.map((c) => c.code)
    : quick.includes(value) ? quick : [...quick, value];

  // Opening "Más" makes the row wider than the sheet; re-centre it so the
  // chips don't jump to one side under the finger.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row && expanded) row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2;
  }, [expanded]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={t('form.currency')}
      style={{
        display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12,
        justifyContent: align === 'start' ? 'flex-start' : 'safe center',
        flexWrap: align === 'start' ? 'wrap' : 'nowrap',
      }}
    >
      {shown.map((code) => {
        const active = code === value;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => { onChange(code); setExpanded(false); }}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 12px 0 8px', borderRadius: 18, cursor: 'pointer',
              border: `1px solid ${active ? 'var(--q10)' : 'var(--line)'}`,
              background: active ? 'var(--q10-soft)' : 'var(--paper)',
              color: active ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>{flagOf(code)}</span>{code}
          </button>
        );
      })}
      {!expanded && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          style={{
            flex: 'none', height: 36, padding: '0 12px', borderRadius: 18, cursor: 'pointer',
            border: '1px dashed var(--line-strong)', background: 'none', color: 'var(--text-muted)',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {t('form.moreCurrencies')}
        </button>
      )}
    </div>
  );
}
