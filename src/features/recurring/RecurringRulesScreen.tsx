import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { localRepository } from '@/data/local/localRepository';
import { materializeRecurringRules } from '@/data/local/materialize';
import { formatMoney } from '@/domain/money/format';
import type { RecurringRule } from '@/domain/types';
import { RecurringRuleForm } from './RecurringRuleForm';
import { EMPTY } from '@/lib/empty';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';

const FREQ_LABEL: Record<RecurringRule['frequency'], TextKey> = {
  monthly: 'recurring.monthly', weekly: 'recurring.weekly',
  biweekly: 'recurring.biweekly', yearly: 'recurring.yearly',
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

  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setCreating(true);
      const next = new URLSearchParams(params);
      next.delete('nuevo');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  async function handleSave(rule: RecurringRule) {
    await localRepository.saveRecurringRule(rule);
    setEditing(null);
    setCreating(false);
    await materializeRecurringRules(); // generates the future instances right away
  }

  async function handleDelete() {
    if (!editing) return;
    await localRepository.deleteRecurringRule(editing.id);
    setEditing(null);
  }

  return (
    <Screen title={t('action.newRecurring')} subtitle={t('recurring.subtitle')}>
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
                  {t(FREQ_LABEL[r.frequency])}{r.dayOfMonth ? ` · ${t('recurring.dayShort')} ${r.dayOfMonth}` : ''}{!r.isActive ? ` · ${t('recurring.paused')}` : ''}
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
          onDelete={editing ? handleDelete : undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </Screen>
  );
}
