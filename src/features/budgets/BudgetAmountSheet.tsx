import { useEffect, useMemo, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { Field, FieldGroup } from '@/components/ui/Field';
import { MoreOptions } from '@/components/ui/MoreOptions';
import { MonthChipGrid } from '@/components/ui/MonthChipGrid';
import { monthName } from '@/components/ui/MonthNav';
import { parseMoney } from '@/domain/money/format';
import { rollingMonths, type YearMonth } from '@/domain/budget/months';
import { listCategoryBudgets } from '@/data/local/budgetMonths';
import type { Category } from '@/domain/types';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor } from '@/domain/seed/categoryColor';

type Preset = 'this' | 'three' | 'year' | 'pick';
const keyOf = (m: YearMonth) => `${m.year}-${m.month}`;

/**
 * Budget for ONE category, for the month being viewed by default. The
 * multi-month choice hides behind "More options": most people set one month.
 * The amount is PER MONTH, not a total to split.
 */
export function BudgetAmountSheet({ category, viewed, currentAmount, onSave, onRemove, onCancel }: {
  category: Category;
  /** The month the screen is showing: the default target and the first chip. */
  viewed: YearMonth;
  /** The viewed month's budget, 0 = none yet (this is what makes it "edit"). */
  currentAmount: number;
  onSave: (months: YearMonth[], amount: number) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const editing = currentAmount > 0;
  const [text, setText] = useState(editing ? String(Math.round(currentAmount)) : '');
  const [preset, setPreset] = useState<Preset>('this');
  const window12 = useMemo(() => rollingMonths({ year: viewed.year, month: viewed.month }, 12), [viewed.year, viewed.month]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set([keyOf(viewed)]));
  const [withBudget, setWithBudget] = useState<Set<string>>(new Set());
  const amount = parseMoney(text);

  useEffect(() => {
    let alive = true;
    listCategoryBudgets(category.id, window12).then((rows) => {
      if (alive) setWithBudget(new Set(rows.map((b) => `${b.year}-${b.month}`)));
    });
    return () => { alive = false; };
  }, [category.id, window12]);

  function choose(p: Preset) {
    setPreset(p);
    if (p === 'this') setSelected(new Set([keyOf(viewed)]));
    if (p === 'three') setSelected(new Set(window12.slice(0, 3).map(keyOf)));
    if (p === 'year') setSelected(new Set(window12.map(keyOf)));
  }
  function toggle(key: string) {
    // Touching a chip means "I'm choosing", whatever preset was on.
    setPreset('pick');
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  const months = window12.filter((m) => selected.has(keyOf(m)));
  // Editing the viewed month replaces it by definition; only announce the OTHER ones.
  const replaced = months.filter((m) => withBudget.has(keyOf(m)) && !(editing && keyOf(m) === keyOf(viewed))).length;
  // 0 on a NEW budget means nothing; on an existing one it means "remove".
  const canSave = amount !== null && (editing ? amount >= 0 : amount > 0) && months.length > 0;
  const saveLabel = months.length === 1 ? t('budgets.saveForOne') : fill(t('budgets.saveForN'), { n: months.length });
  const presets: Array<[Preset, string]> = [
    ['this', t('budgets.thisMonth')], ['three', t('budgets.threeMonths')],
    ['year', t('budgets.wholeYear')], ['pick', t('budgets.pick')],
  ];

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog" aria-label={editing ? t('budgets.editTitle') : fill(t('budgets.dialogLabel'), { name: category.name })}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, margin: '0 0 14px' }}>
          <CategoryAvatar icon={category.icon} color={categoryColor(category)} size={28} />
          {editing ? `${t('budgets.editTitle')} · ${category.name}` : category.name}
        </p>
        <Field label={t('budgets.monthly')} htmlFor="presupuesto-monto">
          <input
            id="presupuesto-monto"
            autoFocus value={text} onChange={(e) => setText(e.target.value.replace(/-/g, ''))} placeholder="$ 0" inputMode="numeric" className="figures"
            style={{ width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 6, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18 }}
          />
        </Field>
        {preset === 'this' && (
          <p style={{ margin: '0 0 8px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {fill(t('budgets.onlyFor'), { month: monthName(viewed.month), monthLower: monthName(viewed.month).toLowerCase() })}
          </p>
        )}

        <MoreOptions>
          <FieldGroup label={t('budgets.whichMonths')} id="presupuesto-meses" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
            {presets.map(([p, label]) => (
              <button key={p} type="button" onClick={() => choose(p)} aria-pressed={preset === p} style={segmentStyle(preset === p)}>{label}</button>
            ))}
          </FieldGroup>
          <MonthChipGrid
            items={window12.map((m) => ({ key: keyOf(m), month: m.month, year: m.year }))}
            selected={selected}
            onToggle={toggle}
          />
        </MoreOptions>

        {replaced > 0 && (
          <p role="status" style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 'var(--radius-s)', background: 'var(--q10-soft)', color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
            {replaced === 1 ? t('budgets.replacesOne') : fill(t('budgets.replacesMany'), { n: replaced })}
          </p>
        )}
        {months.length === 0 && (
          <p role="status" style={{ margin: '0 0 10px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{t('budgets.pickOne')}</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (amount === null) return;
            // Saving 0 must not look saved: it goes through the same confirmation as Remove.
            if (amount === 0) onRemove(); else onSave(months, amount);
          }}
          disabled={!canSave}
          style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: canSave ? 'var(--text)' : 'var(--surface-sunken)', color: canSave ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          {saveLabel}
        </button>
        {editing && (
          <button type="button" onClick={onRemove} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 'var(--radius-s)', border: '1px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' }}>
            {t('budgets.remove')}
          </button>
        )}
      </div>
    </div>
  );
}

function segmentStyle(active: boolean): React.CSSProperties {
  return { minHeight: 'var(--tap)', padding: '0 2px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 };
}
