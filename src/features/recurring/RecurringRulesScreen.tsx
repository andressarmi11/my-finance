import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { localRepository } from '@/data/local/localRepository';
import { materializeRecurringRules } from '@/data/local/materialize';
import { saveRecurringRule } from '@/data/local/recurringEdit';
import { useDialogo } from '@/components/ui/useDialogo';
import { fill } from '@/lib/dateLabels';
import { monthName } from '@/components/ui/MonthNav';
import { formatMoney } from '@/domain/money/format';
import type { RecurringRule } from '@/domain/types';
import { RecurringRuleForm } from './RecurringRuleForm';
import { EMPTY } from '@/lib/empty';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';

const FREQ_LABEL: Record<RecurringRule['frequency'], TextKey> = {
  monthly: 'recurring.monthly', weekly: 'recurring.weekly',
  biweekly: 'recurring.biweekly', yearly: 'recurring.yearly', custom: 'recurring.custom',
};

export function RecurringRulesScreen() {
  const navigate = useNavigate();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const rules = useLiveQuery(() => localRepository.listRecurringRules(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState('');

  // The notice clears itself: it reports something already done, it asks nothing.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  /** "Ene, Jun, Dic · día 5", "Cada 2 meses · día 15", or the plain frequency. */
  function describe(r: RecurringRule): string {
    let base: string;
    if (r.frequency === 'custom' && r.months?.length) {
      // monthName is capitalised and language-aware; the short form is its first 3 letters.
      base = r.months.map((m) => monthName(m).slice(0, 3)).join(', ');
    } else if (r.frequency === 'custom' && r.interval) {
      const { every, unit } = r.interval;
      base = every === 1
        ? t(unit === 'months' ? 'recurring.everyMonth' : 'recurring.everyWeek')
        : fill(t(unit === 'months' ? 'recurring.everyMonths' : 'recurring.everyWeeks'), { n: every });
    } else base = t(FREQ_LABEL[r.frequency]);
    return `${base}${r.dayOfMonth ? ` · ${t('recurring.dayShort')} ${r.dayOfMonth}` : ''}${!r.isActive ? ` · ${t('recurring.paused')}` : ''}`;
  }

  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setCreating(true);
      const next = new URLSearchParams(params);
      next.delete('nuevo');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  async function handleSave(rule: RecurringRule) {
    if (editing) {
      // Also carries the edit to the pending copies already generated.
      const { updated, removed } = await saveRecurringRule(rule);
      const n = updated + removed;
      if (n > 0) setNotice(n === 1 ? t('recurring.updatedOne') : fill(t('recurring.updatedN'), { n }));
    } else {
      await localRepository.saveRecurringRule(rule);
    }
    setEditing(null);
    setCreating(false);
    await materializeRecurringRules(); // generates the future instances right away
  }

  async function handleDelete() {
    if (!editing) return;
    await localRepository.deleteRecurringRule(editing.id);
    setConfirmDelete(false);
    setEditing(null);
  }

  return (
    <Screen title={t('recurring.title')} subtitle={t('recurring.subtitle')}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        {t('nav.backToSettingsArrow')}
      </button>

      {rules.length === 0 ? (
        <EmptyState title={t('recurring.emptyTitle')} body={t('recurring.emptyBody')} />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '4px 14px', marginBottom: 16 }}>
          {rules.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing(r)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', opacity: r.isActive ? 1 : 0.5 }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                  {describe(r)}
                </span>
              </span>
              <span className="figures" style={{ fontWeight: 600, color: r.type === 'income' ? 'var(--positive-text)' : 'var(--text)' }}>
                {r.type === 'income' ? '+' : ''}{formatMoney(r.amount)}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        style={{ width: '100%', minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px dashed var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
      >
        {t('recurring.newOne')}
      </button>

      {(editing || creating) && (
        <RecurringRuleForm
          existing={editing}
          categories={categories}
          paymentMethods={paymentMethods}
          onSave={handleSave}
          onDelete={editing ? () => setConfirmDelete(true) : undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
      {notice && (
        <p role="status" style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 'var(--radius-s)', background: 'var(--q10-soft)', color: 'var(--text)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {notice}
        </p>
      )}

      {confirmDelete && editing && (
        <ConfirmDeleteRule name={editing.name} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </Screen>
  );
}

function ConfirmDeleteRule({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={fill(t('recurring.deleteQuestion'), { name })}
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 70,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
        <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>{fill(t('recurring.deleteQuestion'), { name })}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-normal)' }}>{t('recurring.deleteBody')}</p>
        <button type="button" onClick={onConfirm} style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: 'var(--danger)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 8 }}>
          {t('transactions.yesDelete')}
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)', fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
          {t('action.cancel')}
        </button>
      </div>
    </div>
  );
}
