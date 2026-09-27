import { useT } from '@/i18n/language';
import { IconBuildingBank, IconCash, IconCreditCard } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { formatMoney } from '@/domain/money/format';
import { calculateAvailableCredit } from '@/domain/credit-card/availableCredit';
import type { PaymentMethod } from '@/domain/types';
import { PaymentMethodForm } from './PaymentMethodForm';
import { todayISO } from '@/lib/todayISO';
import { EMPTY } from '@/lib/empty';

const TYPE_LABEL: Record<PaymentMethod['type'], string> = {
  debit: 'Débito', credit: 'Crédito', cash: 'Efectivo', transfer: 'Transferencia',
};

export function PaymentMethodsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const methods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayISO();

  const usageByMethod = useMemo(() => {
    const account = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.paymentMethodId) continue;
      account.set(tx.paymentMethodId, (account.get(tx.paymentMethodId) ?? 0) + 1);
    }
    return account;
  }, [transactions]);

  async function handleSave(method: PaymentMethod) {
    await localRepository.savePaymentMethod(method);
    setEditing(null);
    setCreating(false);
  }

  async function handleDelete() {
    if (!editing) return;
    await localRepository.deletePaymentMethod(editing.id);
    setEditing(null);
  }

  return (
    <Screen title={t('methods.title')}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        ← {t('nav.backToSettings')}
      </button>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '4px 14px', marginBottom: 16 }}>
        {methods.map((m) => {
          const disp = m.type === 'credit'
            ? calculateAvailableCredit(m, transactions, today)
            : null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setEditing(m)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span
                aria-hidden
                style={{
                  flex: 'none', width: 36, height: 36, borderRadius: 12, display: 'grid',
                  placeItems: 'center', background: 'var(--surface-sunken)', color: 'var(--text-muted)',
                }}
              >
                {m.type === 'credit' ? <IconCreditCard size={19} stroke={1.75} />
                  : m.type === 'cash' ? <IconCash size={19} stroke={1.75} />
                  : <IconBuildingBank size={19} stroke={1.75} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                  {TYPE_LABEL[m.type]}
                  {m.type === 'credit' && m.cutoffDay && m.paymentDay
                    ? ` · corte ${m.cutoffDay}, paga ${m.paymentDay}`
                    : ''}
                </span>
              </span>
              {disp && (
                <span style={{ textAlign: 'right', flex: 'none' }}>
                  <span className="figures" style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-base)', color: disp.available >= 0 ? 'var(--text)' : 'var(--danger-text)' }}>
                    {formatMoney(disp.available)}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>{t('cards.available')}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setCreating(true)}
        style={{ width: '100%', minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px dashed var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
      >
        {t('cards.newMethod')}
      </button>

      {(editing || creating) && (
        <PaymentMethodForm
          existing={editing}
          relatedTransactions={editing ? usageByMethod.get(editing.id) ?? 0 : 0}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </Screen>
  );
}
